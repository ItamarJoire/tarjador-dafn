#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
redator.py — Tarja (redacao) automatica de dados pessoais em PDFs.

Tres camadas de deteccao:
  1. Camada de texto do PDF  -> regex com coordenada exata por caractere.
  2. Imagens / paginas digitalizadas -> OCR (RapidOCR, 100% pip) + regex.
  3. QR Code e codigo de barras -> OpenCV.

A tarja e DESTRUTIVA de verdade: usa PyMuPDF apply_redactions(), que remove o
texto do conteudo do PDF e zera os pixels dentro da area nas imagens. Nao e um
retangulo preto por cima (que qualquer um remove com Ctrl+C ou extracao).

Uso tipico (fluxo em dois passos):

    # 1) gera PDF de conferencia + relatorio, sem alterar nada
    python redator.py revisar entrada -o saida

    # 2) confere os *_REVISAO.pdf e o saida/revisao_manual.json; marca
    #    "ignorar": true no que nao devia ser tarjado e aplica de verdade
    python redator.py aplicar entrada -o saida --decisoes saida/revisao_manual.json

    # 3) confere que nao sobrou nada no resultado
    python redator.py auditar saida

Instalacao:
    pip install pymupdf numpy
    pip install rapidocr-onnxruntime==1.4.4 --ignore-requires-python

    (o --ignore-requires-python e necessario no Python 3.13: o pacote declara
    suporte so ate o 3.12, mas funciona normalmente no 3.13. Sem a flag o pip
    instala silenciosamente uma versao antiga de 2022.)

Autor: gerado para fluxo de analise LGPD (ITI/DAFN).
Licenca: uso interno livre.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
import unicodedata
from concurrent.futures import FIRST_COMPLETED, ProcessPoolExecutor, as_completed, wait
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Iterable, Optional, Sequence

if sys.version_info < (3, 10):
    sys.exit("Este script precisa de Python 3.10 ou mais novo "
             f"(voce esta usando {sys.version.split()[0]}).")

# O ONNX Runtime (motor do OCR) traz um coletor de telemetria da Microsoft
# (OneCollector, mobile.events.data.microsoft.com). Os documentos tem dado
# pessoal e o Tarjador nao abre conexao para fora: desliga antes de o modulo
# ser carregado. Vale para este processo e para os processos de OCR, que
# herdam o ambiente e importam este modulo.
os.environ["ORT_DISABLE_TELEMETRY"] = "1"

try:
    import pymupdf  # PyMuPDF >= 1.24
except ImportError:  # pragma: no cover
    try:
        import fitz as pymupdf  # PyMuPDF < 1.24
    except ImportError:
        sys.exit("Faltou o PyMuPDF.  Rode:  pip install pymupdf")

VERSAO = "1.4"

# Caixa de cada caractere com a altura da fonte, e nao do ascendente ao
# descendente da fonte inteira. Com a caixa "alta", a tarja de uma linha
# invade a linha de cima e a de baixo. Vale tambem para os processos que
# analisam paginas em paralelo, porque cada um importa este modulo.
pymupdf.TOOLS.set_small_glyph_heights(True)

# ---------------------------------------------------------------------------
# 1. VALIDADORES
# ---------------------------------------------------------------------------


def so_digitos(s: str) -> str:
    return re.sub(r"\D", "", s)


def cpf_valido(s: str) -> bool:
    """Confere os dois digitos verificadores do CPF."""
    d = [int(c) for c in so_digitos(s)]
    if len(d) != 11 or len(set(d)) == 1:
        return False
    for pos in (9, 10):
        soma = sum(d[i] * ((pos + 1) - i) for i in range(pos))
        dv = (soma * 10) % 11
        dv = 0 if dv == 10 else dv
        if d[pos] != dv:
            return False
    return True


def cnpj_valido(s: str) -> bool:
    d = [int(c) for c in so_digitos(s)]
    if len(d) != 14 or len(set(d)) == 1:
        return False
    pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    pesos2 = [6] + pesos1
    for pesos, pos in ((pesos1, 12), (pesos2, 13)):
        soma = sum(d[i] * pesos[i] for i in range(pos))
        dv = soma % 11
        dv = 0 if dv < 2 else 11 - dv
        if d[pos] != dv:
            return False
    return True


def luhn_valido(s: str) -> bool:
    """Valida numero de cartao (algoritmo de Luhn)."""
    d = [int(c) for c in so_digitos(s)]
    if not (13 <= len(d) <= 19):
        return False
    total = 0
    for i, x in enumerate(reversed(d)):
        if i % 2:
            x *= 2
            if x > 9:
                x -= 9
        total += x
    return total % 10 == 0


def tem_digito(s: str) -> bool:
    return any(c.isdigit() for c in s)


_ROTULO_ENDERECO = re.compile(
    r"(?i)\s*(?:logradouro|complemento|bairro|apto|apartamento|resid|domic)")


def filtro_endereco(v: str) -> bool:
    """Endereco so conta se tiver numero, for um campo nomeado de formulario
    ("Bairro: ...") ou vier no formato rotulo-dois-pontos ("Avenida: ...").
    Isso derruba mencoes soltas em prosa ("na rua em frente")."""
    return (tem_digito(v)
            or _ROTULO_ENDERECO.match(v) is not None
            or re.match(r"(?i)\s*[A-Za-zÀ-ÿ.]{2,14}\s*:\s*\S", v) is not None)


def sem_acento_minusculo(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.lower()


# ---------------------------------------------------------------------------
# 2. PADROES
# ---------------------------------------------------------------------------


@dataclass
class Padrao:
    id: str
    rotulo: str
    regexes: list[str]
    prioridade: int = 50
    grupo: int = 0              # grupo da regex que vira a tarja (0 = tudo)
    exclusivo: bool = True      # disputa espaco com outros padroes exclusivos
    numerico: bool = False      # tambem roda sobre o texto do OCR com O->0, l->1...
    validador: Optional[Callable[[str], bool]] = None
    exige_validacao: bool = False   # se True, descarta quando o validador falha
    filtro: Optional[Callable[[str], bool]] = None
    compiladas: list[re.Pattern] = field(default_factory=list, repr=False)

    def __post_init__(self):
        self.compiladas = [re.compile(r) for r in self.regexes]


PADROES: list[Padrao] = [
    Padrao(
        id="cpf",
        rotulo="CPF",
        regexes=[
            r"(?<![\d./-])\d{3}[.\s]?\d{3}[.\s]?\d{3}[-.\s]?\d{2}(?![\d./-])",
        ],
        prioridade=10,
        numerico=True,
        validador=cpf_valido,
    ),
    Padrao(
        id="cpf_parcial",
        rotulo="CPF (parcial/cortado)",
        # pega CPF truncado pela borda do scan ou com digito comido pelo OCR:
        # "091.580.337-2", "096.821.8", "081.933.887-"
        regexes=[
            r"(?<![\d./-])\d{3}[.\s]\d{3}[.\s]\d{1,3}(?:[-.\s]\d{1,2})?(?![\d./-])",
        ],
        prioridade=12,
        numerico=True,
    ),
    Padrao(
        id="cnpj",
        rotulo="CNPJ",
        regexes=[
            r"(?<![\d./-])\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-.\s]?\d{2}(?![\d./-])",
        ],
        prioridade=15,
        numerico=True,
        validador=cnpj_valido,
    ),
    Padrao(
        id="cartao",
        rotulo="Cartão de pagamento",
        regexes=[r"(?<![\d.-])(?:\d{4}[ .-]?){3}\d{4}(?![\d.-])"],
        prioridade=18,
        numerico=True,
        validador=luhn_valido,
        exige_validacao=True,   # sem Luhn valido, nao tarja (evita matricula/protocolo)
    ),
    Padrao(
        id="cep",
        rotulo="CEP",
        regexes=[
            r"(?i)\bCEP\.?[:\s]*\d{2}\.?\d{3}[-.\s]?\d{3}\b",
            r"(?<![\d.-])\d{5}-\d{3}(?![\d-])",
            r"(?<![\d.-])\d{2}\.\d{3}-\d{3}(?![\d-])",
        ],
        prioridade=20,
        numerico=True,
    ),
    Padrao(
        id="telefone",
        rotulo="Telefone",
        regexes=[
            r"(?<![\d./-])(?:\+?55[\s.-]?)?(?:\(\d{2}\)\s?|\d{2}[\s.-])9?\d{4}[\s.-]?\d{4}(?![\d./-])",
            r"(?<![\d./-])9?\d{4}[\s.-]\d{4}(?![\d./-])",
            r"(?<![\d./-])(?:1[1-9]|[2-9][1-9])9\d{8}(?![\d./-])",
        ],
        prioridade=30,
        numerico=True,
    ),
    Padrao(
        id="rg",
        rotulo="RG / CNH / identidade",
        regexes=[
            # palavras longas: SEM \b no inicio, porque o OCR cola as palavras
            # ("portadoradacarteiradeidentidaden0167264") e o \b nunca casaria
            r"(?i)(?:registro\s*geral|c[eé]dula\s*de\s*identidade|"
            r"carteira\s*de\s*identidade|identidade|habilita[cç][aã]o|"
            # inscricao estadual/municipal e de empresa, nao de pessoa
            r"inscri[cç][aã]o(?!\s*(?:estadual|municipal))|matr[ií]cula|t[ií]tulo\s*de\s*eleitor)"
            r"[^\n\d]{0,25}(\d[\d.\-/ ]{4,15}\d)",
            # siglas curtas: com \b, senao geram falso positivo
            r"(?i)\b(?:RG|R\.G\.|CNH|PIS|PASEP|NIT|n[ºo°]\s*registro)\b"
            r"[^\n\d]{0,25}(\d[\d.\-/ ]{4,15}\d)",
            r"(?<![\d.-])\d{2}\.\d{3}\.\d{3}-[\dxX](?![\d.-])",
            # "n° 11772923-6" solto: em carteira e certidao o rotulo costuma
            # ficar na linha de cima, longe do numero
            r"(?i)\bn[.ºo°]{1,2}\s?(\d{7,11}-?[\dxX]?)(?![\d])",
        ],
        prioridade=35,
        grupo=1,
        numerico=True,
        filtro=lambda v: not re.fullmatch(r"\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}", v.strip())
        and len(so_digitos(v)) >= 5,
    ),
    Padrao(
        id="agencia",
        rotulo="Agência bancária",
        regexes=[r"(?i)\bag[eê]ncia\b\s*:?\s*n?[ºo°.]?\s*(\d{3,5}(?:-\s?\d)?)"],
        prioridade=22,
        grupo=1,
        numerico=True,
    ),
    Padrao(
        id="conta",
        rotulo="Conta bancária",
        regexes=[
            r"(?i)\b(?:conta(?:\s+(?:corrente|poupan[cç]a))?|c/c|c\.\s?c\.)\b"
            r"\s*:?\s*n?[ºo°.]?\s*([\d.]{3,12}-?\s?[\dxX])",
        ],
        prioridade=24,
        grupo=1,
        numerico=True,
    ),
    Padrao(
        id="iban",
        rotulo="IBAN",
        regexes=[r"\bBR\d{2}[A-Z0-9]{21,27}\b"],
        prioridade=26,
    ),
    # --- nao exclusivos: podem se sobrepor aos de cima sem competir ---
    Padrao(
        id="email",
        rotulo="E-mail",
        regexes=[r"[A-Za-z0-9._%+\-]+\s?@\s?[A-Za-z0-9.\-]+\.[A-Za-z]{2,}"],
        prioridade=5,
        exclusivo=False,
    ),
    Padrao(
        id="pix",
        rotulo="Chave PIX",
        regexes=[
            r"(?i)\b(?:chave\s+)?pix\b\s*:?\s*([^\s;,]{5,80})",
            r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",
        ],
        prioridade=28,
        grupo=1,
        exclusivo=False,
    ),
    Padrao(
        id="endereco",
        rotulo="Endereço postal",
        regexes=[
            # exigir espaco ou dois-pontos depois da palavra evita casar "aV.Sa"
            r"(?i)\b(?:rua|avenida|av|travessa|alameda|rodovia|rod|estrada|"
            r"pra[cç]a|largo|quadra|qd|conjunto|lote|bloco|"
            r"shis|shin|sqn|sqs|qnl|qng|cln|cls|scn|scs|sepn|sgan|"
            r"al\.|tv\.|cj\.)(?:\s*:\s*|\.?\s+)[^\n;|]{3,70}",
            # componentes do endereco em formulario
            r"(?i)\b(?:logradouro|complemento|bairro|apto\.?|apartamento|"
            r"resid[eê]ncia|domic[ií]lio)\s*:\s*[^\n;|]{2,50}",
        ],
        prioridade=60,
        exclusivo=False,
        filtro=filtro_endereco,
    ),
]

PADROES_POR_ID = {p.id: p for p in PADROES}

# tipos ativados por padrao na linha de comando
TIPOS_PADRAO = [
    "cpf", "cpf_parcial", "email", "telefone", "rg", "cep", "endereco",
    "agencia", "conta", "cartao", "pix", "iban", "qrcode", "codigo_barras",
]
TIPOS_EXTRA = ["cnpj"]           # existem, mas so entram se pedidos
TIPOS_VISUAIS = {"qrcode", "codigo_barras"}
TODOS_TIPOS = TIPOS_PADRAO + TIPOS_EXTRA

ROTULOS = {p.id: p.rotulo for p in PADROES}
ROTULOS["qrcode"] = "QR Code"
ROTULOS["codigo_barras"] = "Código de barras"
ROTULOS["termo"] = "Termo manual"
ROTULOS["regex"] = "Regex do usuario"

# Confusoes tipicas de OCR: usado so nos padroes numericos, preservando o
# tamanho da string (1 caractere por 1 caractere) para o indice continuar valido.
TABELA_OCR = str.maketrans({
    "O": "0", "o": "0", "D": "0", "Q": "0",
    "l": "1", "I": "1", "|": "1", "!": "1",
    "S": "5", "s": "5", "B": "8", "Z": "2", "z": "2", "G": "6",
})


def normaliza_ocr(texto: str) -> str:
    return texto.translate(TABELA_OCR)


# Rotulos de formulario / carteira de identidade: o valor costuma estar na
# LINHA DE BAIXO ou logo a direita, sem nenhum padrao reconhecivel sozinho
# (ex.: o campo "RG" de uma carteira da OAB, o campo "E-mail" de um protocolo).
ROTULOS_CAMPO: list[tuple[re.Pattern, str]] = [
    (re.compile(r"(?i)^\W*(?:cpf(?:/mf)?|c\.p\.f\.?|n[ºo°.]?\s*(?:de\s*)?inscri[cç][aã]o)\W*$"), "cpf"),
    (re.compile(r"(?i)^\W*(?:rg|r\.g\.|registro\s+geral|identidade|"
                r"doc(?:umento)?\.?\s*(?:de\s*)?identidade|c[eé]dula\s+de\s+identidade|"
                r"cnh|habilita[cç][aã]o|n[ºo°.]?\s*registro)\W*$"), "rg"),
    (re.compile(r"(?i)^\W*(?:e-?mail|endere[cç]o\s+eletr[oô]nico|correio\s+eletr[oô]nico)\W*$"), "email"),
    (re.compile(r"(?i)^\W*(?:telefone|celular|fone|tel|contato|whats\s?app)\W*$"), "telefone"),
    (re.compile(r"(?i)^\W*(?:endere[cç]o|logradouro|resid[eê]ncia|domic[ií]lio)\W*$"), "endereco"),
    (re.compile(r"(?i)^\W*ag[eê]ncia\W*$"), "agencia"),
    (re.compile(r"(?i)^\W*conta(?:\s+corrente|\s+poupan[cç]a)?\W*$"), "conta"),
    (re.compile(r"(?i)^\W*(?:chave\s+)?pix\W*$"), "pix"),
]

# O valor encontrado ao lado/abaixo do rotulo so vale se tiver a cara do tipo.
# Sem isso o campo "E-mail" vazio de um formulario captura a linha seguinte.
FORMATO_VALOR: dict[str, Callable[[str], bool]] = {
    "cpf": lambda v: len(so_digitos(v)) >= 8,
    "rg": lambda v: len(so_digitos(v)) >= 5,
    "telefone": lambda v: 8 <= len(so_digitos(v)) <= 15,
    "cep": lambda v: len(so_digitos(v)) == 8,
    "email": lambda v: "@" in v or (
        " " not in v.strip() and re.search(r"\w\.\w", v) is not None and len(v.strip()) > 6),
    "endereco": lambda v: tem_digito(v) and len(v.strip()) >= 10,
    "agencia": lambda v: 3 <= len(so_digitos(v)) <= 8,
    "conta": lambda v: 3 <= len(so_digitos(v)) <= 14,
    "pix": lambda v: len(v.strip()) >= 6,
}

# Palavras que denunciam dado sensivel na linha (usadas no aviso de conferencia
# e no modo --agressivo).
GATILHOS = {
    "cpf": re.compile(r"(?i)\bcpf\b"),
    "rg": re.compile(r"(?i)\b(?:rg|identidade|cnh|registro\s+geral)\b"),
    "email": re.compile(r"(?i)\b(?:e-?mail|endere[cç]o\s+eletr[oô]nico)\b"),
    "telefone": re.compile(r"(?i)\b(?:telefone|celular|fone)\b"),
    "endereco": re.compile(r"(?i)\b(?:endere[cç]o|logradouro|CEP)\b"),
    "conta": re.compile(r"(?i)\b(?:conta\s+corrente|ag[eê]ncia|chave\s+pix)\b"),
}


# ---------------------------------------------------------------------------
# 3. ESTRUTURAS
# ---------------------------------------------------------------------------


@dataclass
class Achado:
    """Casamento de um padrao dentro de uma string."""
    tipo: str
    valor: str
    ini: int
    fim: int
    prioridade: int
    exclusivo: bool
    valido: Optional[bool] = None
    metodo: str = "padrao"      # padrao | manual | agressivo


@dataclass
class Deteccao:
    """Achado ja posicionado na pagina."""
    arquivo: str
    pagina: int          # 1-based
    tipo: str
    valor: str
    origem: str          # texto | ocr | visual | termo
    x0: float
    y0: float
    x1: float
    y1: float
    score: float = 1.0
    valido: Optional[bool] = None
    id: str = ""
    metodo: str = "padrao"   # padrao | rotulo | quebrado | agressivo | heuristica | manual

    def __post_init__(self):
        if not self.id:
            crua = (f"{Path(self.arquivo).name}|{self.pagina}|{self.tipo}|"
                    f"{self.valor}|{round(self.x0)}|{round(self.y0)}")
            self.id = (f"p{self.pagina}-"
                       f"{hashlib.sha1(crua.encode('utf-8')).hexdigest()[:6]}")

    @property
    def rect(self) -> "pymupdf.Rect":
        return pymupdf.Rect(self.x0, self.y0, self.x1, self.y1)

    def como_dict(self) -> dict:
        return {
            "id": self.id,
            "arquivo": Path(self.arquivo).name,
            "pagina": self.pagina,
            "tipo": self.tipo,
            "rotulo": ROTULOS.get(self.tipo, self.tipo),
            "origem": self.origem,
            "valor_mascarado": mascarar(self.valor),
            "valor": self.valor,
            "confianca": round(self.score, 3),
            "metodo": self.metodo,
            "validado": "" if self.valido is None else ("sim" if self.valido else "nao"),
            "x0": round(self.x0, 1), "y0": round(self.y0, 1),
            "x1": round(self.x1, 1), "y1": round(self.y1, 1),
        }


def mascarar(valor: str, visiveis: int = 2) -> str:
    valor = valor.replace("\n", " ").strip()
    if len(valor) <= visiveis * 2:
        return "*" * len(valor)
    return valor[:visiveis] + "*" * (len(valor) - visiveis * 2) + valor[-visiveis:]


@dataclass
class Config:
    tipos: set[str]
    dpi: int = 300
    ocr: bool = True
    ocr_tudo: bool = False
    area_min_imagem: float = 0.01
    ocr_linha_inteira: bool = False
    ocr_score_min: float = 0.30
    margem_texto: float = 1.2
    margem_ocr: float = 2.5
    validar_cpf: bool = False
    lista_branca: tuple[str, ...] = ()
    termos: tuple[str, ...] = ()
    regexes_extra: tuple[str, ...] = ()
    ignorar: frozenset = frozenset()
    paginas: Optional[tuple[int, ...]] = None
    motor_ocr: str = "auto"
    usar_rotulos: bool = True
    agressivo: bool = False
    barras_heuristica: bool = False
    ocr_blocos: int = 0          # 0 = automatico
    threads_ocr: int = 0         # 0 = o onnxruntime decide (todos os nucleos)


# ---------------------------------------------------------------------------
# 4. BUSCA DE PADROES EM UMA STRING
# ---------------------------------------------------------------------------


def buscar_padroes(texto: str, cfg: Config, do_ocr: bool = False) -> list[Achado]:
    if not texto.strip():
        return []

    variantes = [(texto, False)]
    if do_ocr:
        norm = normaliza_ocr(texto)
        if norm != texto:
            variantes.append((norm, True))

    brutos: list[Achado] = []
    vistos: set[tuple] = set()

    ativos = [p for p in PADROES if p.id in cfg.tipos]

    for pad in ativos:
        for alvo, eh_norm in variantes:
            if eh_norm and not pad.numerico:
                continue
            for rx in pad.compiladas:
                usa_grupo = bool(pad.grupo) and rx.groups >= pad.grupo
                for m in rx.finditer(alvo):
                    g = pad.grupo if usa_grupo and m.group(pad.grupo) is not None else 0
                    ini, fim = m.span(g)
                    if ini < 0 or fim <= ini:
                        continue
                    valor_orig = texto[ini:fim]
                    valor_teste = m.group(g)

                    if pad.filtro and not pad.filtro(valor_teste):
                        continue

                    valido = None
                    if pad.validador:
                        valido = pad.validador(valor_teste)
                        if not valido:
                            if pad.exige_validacao:
                                continue
                            if pad.id == "cpf" and cfg.validar_cpf:
                                continue

                    if na_lista_branca(valor_orig, cfg.lista_branca):
                        continue

                    chave = (pad.id, ini, fim)
                    if chave in vistos:
                        continue
                    vistos.add(chave)
                    brutos.append(Achado(pad.id, valor_orig, ini, fim,
                                         pad.prioridade, pad.exclusivo, valido))

    # termos literais informados pelo usuario
    for termo in cfg.termos:
        if not termo:
            continue
        for m in re.finditer(re.escape(termo), texto, re.IGNORECASE):
            brutos.append(Achado("termo", m.group(0), m.start(), m.end(), 1, False,
                             metodo="manual"))

    for padrao_extra in cfg.regexes_extra:
        try:
            for m in re.finditer(padrao_extra, texto, re.IGNORECASE):
                brutos.append(Achado("regex", m.group(0), m.start(), m.end(), 1, False,
                                     metodo="manual"))
        except re.error:
            pass

    # resolucao de conflito: entre os "exclusivos", quem tem prioridade menor
    # (mais forte) fica com o espaco; assim um CPF nao vira telefone pela metade.
    exclusivos = sorted([a for a in brutos if a.exclusivo],
                        key=lambda a: (a.prioridade, -(a.fim - a.ini)))
    aceitos: list[Achado] = []
    for a in exclusivos:
        if any(not (a.fim <= b.ini or a.ini >= b.fim) for b in aceitos):
            continue
        aceitos.append(a)

    livres = [a for a in brutos if not a.exclusivo]
    # remove um "livre" totalmente contido em outro "livre" maior do mesmo tipo
    livres.sort(key=lambda a: -(a.fim - a.ini))
    finais_livres: list[Achado] = []
    for a in livres:
        if any(a.tipo == b.tipo and a.ini >= b.ini and a.fim <= b.fim for b in finais_livres):
            continue
        finais_livres.append(a)

    return aceitos + finais_livres


def na_lista_branca(valor: str, lista: Sequence[str]) -> bool:
    if not lista:
        return False
    alvo = sem_acento_minusculo(valor)
    return any(item and item in alvo for item in lista)


# ---------------------------------------------------------------------------
# 5. CAMADA 1 — TEXTO DO PDF (coordenada por caractere)
# ---------------------------------------------------------------------------


def linhas_com_caracteres(page) -> Iterable[list[tuple[str, "pymupdf.Rect"]]]:
    """Devolve, por linha, a lista (caractere, bbox)."""
    dados = page.get_text("rawdict")
    for bloco in dados.get("blocks", []):
        if bloco.get("type") != 0:
            continue
        for linha in bloco.get("lines", []):
            chars: list[tuple[str, pymupdf.Rect]] = []
            for span in linha.get("spans", []):
                for ch in span.get("chars", []):
                    chars.append((ch["c"], pymupdf.Rect(ch["bbox"])))
            if chars:
                yield chars


def rect_dos_caracteres(chars, ini: int, fim: int, margem: float) -> "pymupdf.Rect":
    r = pymupdf.Rect()
    r.x0, r.y0, r.x1, r.y1 = 1e9, 1e9, -1e9, -1e9
    for _, bb in chars[ini:fim]:
        if bb.is_empty and bb.width == 0 and bb.height == 0:
            continue
        r.x0 = min(r.x0, bb.x0); r.y0 = min(r.y0, bb.y0)
        r.x1 = max(r.x1, bb.x1); r.y1 = max(r.y1, bb.y1)
    if r.x1 <= r.x0 or r.y1 <= r.y0:
        return pymupdf.Rect(0, 0, 0, 0)
    r.x0 -= margem; r.y0 -= margem * 0.6
    r.x1 += margem; r.y1 += margem * 0.6
    return r


def detectar_texto(page, cfg: Config, arquivo: str):
    """Devolve (deteccoes, linhas) da camada de texto nativa do PDF."""
    out: list[Deteccao] = []
    linhas: list[tuple["pymupdf.Rect", str, float]] = []
    chars_das_linhas: list = []          # alinhado com `linhas`
    npag = page.number + 1
    for chars in linhas_com_caracteres(page):
        texto = "".join(c for c, _ in chars)
        r_linha = rect_dos_caracteres(chars, 0, len(chars), 0.0)
        if not r_linha.is_empty:
            linhas.append((r_linha, texto, 1.0))
            chars_das_linhas.append(chars)
        for a in buscar_padroes(texto, cfg, do_ocr=False):
            r = rect_dos_caracteres(chars, a.ini, a.fim, cfg.margem_texto)
            if r.is_empty:
                continue
            out.append(Deteccao(arquivo, npag, a.tipo, a.valor, "texto",
                                r.x0, r.y0, r.x1, r.y1, 1.0, a.valido,
                                metodo=a.metodo))

    def rect_trecho(k: int, ini: int, fim: int) -> "pymupdf.Rect":
        return rect_dos_caracteres(chars_das_linhas[k], ini, fim, cfg.margem_texto)

    out.extend(detectar_cpf_quebrado(linhas, rect_trecho, cfg, arquivo, npag, "texto"))
    return out, linhas


# ---------------------------------------------------------------------------
# 5b. CAMPOS ROTULADOS ("CPF" numa linha, o numero na linha de baixo)
# ---------------------------------------------------------------------------


def detectar_por_rotulo(linhas, cfg: Config, arquivo: str, npag: int,
                        origem: str) -> list[Deteccao]:
    """Acha valor pelo rotulo vizinho: util em formularios e carteiras de
    identidade, onde o numero sozinho nao tem padrao reconhecivel."""
    if not cfg.usar_rotulos or not linhas:
        return []

    eh_rotulo = [None] * len(linhas)
    for i, (_, texto, _) in enumerate(linhas):
        t = texto.strip()
        if not t or len(t) > 40:
            continue
        for rx, tipo in ROTULOS_CAMPO:
            if rx.match(t):
                eh_rotulo[i] = tipo
                break

    out: list[Deteccao] = []
    for i, tipo in enumerate(eh_rotulo):
        if tipo is None or tipo not in cfg.tipos:
            continue
        r_rot, txt_rot, _ = linhas[i]
        altura = max(r_rot.height, 4.0)
        melhor, melhor_dist = None, 1e9

        cabe = FORMATO_VALOR.get(tipo)
        for j, (r_v, txt_v, sc) in enumerate(linhas):
            if j == i or eh_rotulo[j] is not None or not txt_v.strip():
                continue
            if tipo != "endereco" and len(txt_v.strip()) > 90:
                continue
            if cabe and not cabe(txt_v):
                continue

            # (a) valor na linha de baixo, com sobreposicao horizontal
            abaixo = r_v.y0 >= r_rot.y1 - altura * 0.35
            dy = r_v.y0 - r_rot.y1
            sobrepoe_x = (min(r_rot.x1, r_v.x1) - max(r_rot.x0, r_v.x0)) > \
                         min(r_rot.width, r_v.width) * 0.30
            if abaixo and dy <= altura * 1.8 and sobrepoe_x:
                dist = dy
            # (b) valor a direita, na mesma linha
            elif (r_v.x0 >= r_rot.x1 - 1
                    and (min(r_rot.y1, r_v.y1) - max(r_rot.y0, r_v.y0)) > altura * 0.5
                    and r_v.x0 - r_rot.x1 < altura * 12):
                dist = (r_v.x0 - r_rot.x1) * 0.5
            else:
                continue

            if dist < melhor_dist:
                melhor, melhor_dist = (r_v, txt_v, sc), dist

        if melhor is None:
            continue
        r_v, txt_v, sc = melhor
        if na_lista_branca(txt_v, cfg.lista_branca):
            continue
        margem = cfg.margem_ocr if origem == "ocr" else cfg.margem_texto
        r = pymupdf.Rect(r_v) + (-margem, -margem * 0.6, margem, margem * 0.6)
        out.append(Deteccao(arquivo, npag, tipo, txt_v.strip()[:90],
                            origem, r.x0, r.y0, r.x1, r.y1, sc, metodo="rotulo"))
    return out


# ---------------------------------------------------------------------------
# 5c. CPF QUEBRADO EM DUAS OU TRES LINHAS
# ---------------------------------------------------------------------------
# Caso classico: carimbo de assinatura digital ICP-Brasil. O titular do
# certificado aparece como NOME:CPF em letra grande e o CPF quebra na margem:
#
#     VANESSA
#     VIEIRA
#     CAMPOS:97654      <- fim da linha e numero
#     418191            <- comeco da linha de baixo e numero
#
# Linha a linha, nenhum pedaco tem cara de CPF. Aqui o fim numerico de uma
# linha e juntado com o comeco numerico da linha logo abaixo (ate tres
# linhas) e so vira tarja se os 11 digitos fecharem o digito verificador:
# a validacao e o que impede de juntar dois numeros quaisquer.

_RX_FIM_NUMERICO = re.compile(r"(?<![\d])(\d[\d.\-]*)\s*$")
_RX_INICIO_NUMERICO = re.compile(r"^\s*([\d.\-]*\d)(?![\d])")


def _linha_logo_abaixo(linhas, i: int, usadas: set[int]) -> Optional[int]:
    """Indice da linha imediatamente abaixo de linhas[i], na mesma coluna e
    com letra do mesmo tamanho; None se nao houver."""
    r = linhas[i][0]
    h = max(r.height, 1.0)
    melhor, melhor_dist = None, 1e9
    for j, (r_j, texto_j, _) in enumerate(linhas):
        if j in usadas or j == i or not texto_j.strip():
            continue
        if r_j.y0 < r.y0 + h * 0.5:            # precisa estar abaixo
            continue
        dy = r_j.y0 - r.y1
        if dy > h * 1.2:                        # e logo abaixo
            continue
        if abs(r_j.height - h) > h * 0.5:       # mesma letra
            continue
        if min(r.x1, r_j.x1) - max(r.x0, r_j.x0) <= 0:   # mesma coluna
            continue
        dist = dy + abs(r_j.x0 - r.x0) * 0.1
        if dist < melhor_dist:
            melhor, melhor_dist = j, dist
    return melhor


def _variantes_da_linha(texto: str, origem: str) -> list[str]:
    """No OCR tambem tenta com as confusoes tipicas trocadas (O->0, l->1...)."""
    if origem != "ocr":
        return [texto]
    norm = normaliza_ocr(texto)
    return [texto] if norm == texto else [texto, norm]


def detectar_cpf_quebrado(linhas, rect_trecho, cfg: Config, arquivo: str, npag: int,
                          origem: str) -> list[Deteccao]:
    """CPF partido entre linhas (ver comentario da secao).

    linhas: [(rect, texto, score)] da pagina, como devolvem detectar_texto e
    detectar_ocr. rect_trecho(k, ini, fim): retangulo de linhas[k][1][ini:fim].
    """
    if "cpf" not in cfg.tipos or len(linhas) < 2:
        return []
    out: list[Deteccao] = []
    for i, (_, texto_i, score_i) in enumerate(linhas):
        for var_i in _variantes_da_linha(texto_i, origem):
            m = _RX_FIM_NUMERICO.search(var_i)
            if not m:
                continue
            digitos = so_digitos(m.group(1))
            if not 1 <= len(digitos) <= 10:
                continue
            pedacos = [(i, m.start(1), m.end(1))]
            scores = [score_i]
            atual, usadas = i, {i}
            while len(digitos) < 11 and len(pedacos) < 3:
                j = _linha_logo_abaixo(linhas, atual, usadas)
                if j is None:
                    break
                mj = None
                for var_j in _variantes_da_linha(linhas[j][1], origem):
                    mj = _RX_INICIO_NUMERICO.match(var_j)
                    if mj:
                        break
                if not mj:
                    break
                digitos += so_digitos(mj.group(1))
                pedacos.append((j, mj.start(1), mj.end(1)))
                scores.append(linhas[j][2])
                usadas.add(j)
                atual = j
                # terceira linha so se esta for inteira numero (o CPF continua)
                if len(digitos) < 11 and var_j[mj.end(1):].strip():
                    break
            if len(pedacos) < 2 or len(digitos) != 11 or not cpf_valido(digitos):
                continue
            if na_lista_branca(digitos, cfg.lista_branca):
                break
            for k, ini, fim in pedacos:
                r = rect_trecho(k, ini, fim)
                if r is None or r.is_empty:
                    continue
                out.append(Deteccao(arquivo, npag, "cpf", digitos, origem,
                                    r.x0, r.y0, r.x1, r.y1, min(scores), True,
                                    metodo="quebrado"))
            break
    return out


# ---------------------------------------------------------------------------
# 6. CAMADA 2 — OCR
# ---------------------------------------------------------------------------

_MOTOR_OCR = None
_MOTOR_NOME = None


def obter_motor_ocr(preferencia: str = "auto", threads: int = 0):
    """Carrega o motor de OCR uma unica vez por processo.

    threads > 0 limita o onnxruntime. Sem isso, com 4 processos em paralelo
    numa maquina de 8 nucleos, cada um tenta usar os 8 e o conjunto fica
    MAIS lento que um processo sozinho.
    """
    global _MOTOR_OCR, _MOTOR_NOME
    if _MOTOR_OCR is not None:
        return _MOTOR_OCR, _MOTOR_NOME

    erros = []
    # Reforco da variavel ORT_DISABLE_TELEMETRY (ver o inicio do modulo)
    try:
        import onnxruntime  # type: ignore
        if hasattr(onnxruntime, "disable_telemetry_events"):
            onnxruntime.disable_telemetry_events()
    except Exception:  # noqa: BLE001 - sem onnxruntime, o erro aparece logo abaixo
        pass

    if preferencia in ("auto", "rapidocr"):
        # rapidocr-onnxruntime (1.x) - o recomendado
        try:
            from rapidocr_onnxruntime import RapidOCR  # type: ignore
            motor = None
            if threads > 0:
                try:
                    motor = RapidOCR(intra_op_num_threads=threads, inter_op_num_threads=1)
                except Exception:  # noqa: BLE001
                    motor = None
            _MOTOR_OCR, _MOTOR_NOME = (motor or RapidOCR()), "rapidocr_onnxruntime"
            return _MOTOR_OCR, _MOTOR_NOME
        except Exception as e:  # noqa: BLE001
            erros.append(f"rapidocr_onnxruntime: {e}")
        # rapidocr >= 2 (pacote "rapidocr")
        try:
            from rapidocr import RapidOCR  # type: ignore
            _MOTOR_OCR, _MOTOR_NOME = RapidOCR(), "rapidocr"
            return _MOTOR_OCR, _MOTOR_NOME
        except Exception as e:  # noqa: BLE001
            erros.append(f"rapidocr: {e}")

    if preferencia in ("auto", "tesseract"):
        try:
            import pytesseract  # type: ignore
            pytesseract.get_tesseract_version()
            _MOTOR_OCR, _MOTOR_NOME = pytesseract, "tesseract"
            return _MOTOR_OCR, _MOTOR_NOME
        except Exception as e:  # noqa: BLE001
            erros.append(f"tesseract: {e}")

    raise RuntimeError(
        "Nenhum motor de OCR disponivel. Instale com:\n"
        "    pip install rapidocr-onnxruntime==1.4.4 --ignore-requires-python\n"
        "Detalhes: " + " | ".join(erros)
    )


def _ocr_linhas(img, preferencia: str, threads: int = 0) -> list[tuple[list[tuple[float, float]], str, float]]:
    """Normaliza a saida dos motores para [(quad, texto, score)]."""
    motor, nome = obter_motor_ocr(preferencia, threads)

    if nome == "tesseract":
        import pytesseract
        from PIL import Image
        dados = pytesseract.image_to_data(
            Image.fromarray(img), lang="por+eng",
            output_type=pytesseract.Output.DICT)
        agrupado: dict[tuple, list[int]] = {}
        for i, txt in enumerate(dados["text"]):
            if not txt.strip():
                continue
            chave = (dados["block_num"][i], dados["par_num"][i], dados["line_num"][i])
            agrupado.setdefault(chave, []).append(i)
        linhas = []
        for idxs in agrupado.values():
            x0 = min(dados["left"][i] for i in idxs)
            y0 = min(dados["top"][i] for i in idxs)
            x1 = max(dados["left"][i] + dados["width"][i] for i in idxs)
            y1 = max(dados["top"][i] + dados["height"][i] for i in idxs)
            txt = " ".join(dados["text"][i] for i in idxs)
            conf = [float(dados["conf"][i]) for i in idxs if float(dados["conf"][i]) >= 0]
            score = (sum(conf) / len(conf) / 100.0) if conf else 0.0
            linhas.append(([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], txt, score))
        return linhas

    saida = motor(img)

    # rapidocr 2.x/3.x -> objeto com .boxes/.txts/.scores
    if hasattr(saida, "txts") and saida.txts is not None:
        linhas = []
        caixas = saida.boxes if saida.boxes is not None else []
        escores = saida.scores if saida.scores is not None else [1.0] * len(saida.txts)
        for quad, txt, sc in zip(caixas, saida.txts, escores):
            linhas.append(([(float(p[0]), float(p[1])) for p in quad], str(txt), float(sc)))
        return linhas

    # rapidocr-onnxruntime 1.x -> (lista, tempos)
    if isinstance(saida, tuple):
        saida = saida[0]
    if not saida:
        return []
    linhas = []
    for item in saida:
        quad, txt, sc = item[0], item[1], item[2]
        linhas.append(([(float(p[0]), float(p[1])) for p in quad], str(txt), float(sc)))
    return linhas


# Largura relativa aproximada de cada caractere, para converter posicao no
# texto -> posicao em pixels. Interpolar linearmente (todo caractere com a
# mesma largura) desalinha a tarja e deixa digito de CPF aparecendo.
_LARGURA_ESTREITA = set(".,:;'`|!ilIjft()[]{}-/\\r ")
_LARGURA_LARGA = set("mwMW@%&QOGD")


def _pesos_largura(texto: str) -> list[float]:
    pesos = []
    for c in texto:
        if c == " ":
            pesos.append(0.45)
        elif c in _LARGURA_ESTREITA:
            pesos.append(0.5)
        elif c in _LARGURA_LARGA:
            pesos.append(1.45)
        elif c.isupper() or c.isdigit():
            pesos.append(1.1)
        else:
            pesos.append(1.0)
    return pesos


def _expandir_para_token(texto: str, ini: int, fim: int, limite: int = 45) -> tuple[int, int]:
    """Estica o trecho ate o espaco em branco mais proximo.

    Vantagem colateral importante: quando o OCR come os espacos
    ("identidade n00797536800,expedida"), o token fica grande e a tarja cobre
    mais - que e exatamente o comportamento seguro nesse caso.
    """
    i, j = ini, fim
    while i > 0 and not texto[i - 1].isspace() and ini - i < limite:
        i -= 1
    while j < len(texto) and not texto[j].isspace() and j - fim < limite:
        j += 1
    return i, j


def _rect_trecho_ocr(texto: str, ini: int, fim: int, caixa, cfg: Config,
                     ox: float, oy: float, zoom: float) -> "pymupdf.Rect":
    """Retangulo, em coordenadas da pagina, de texto[ini:fim] numa linha do OCR.

    O OCR so devolve a caixa da linha inteira; a posicao do trecho e estimada
    pela largura tipica de cada caractere. caixa = (px0, py0, px1, py1, ang)
    em pixels da imagem.
    """
    px0, py0, px1, py1, ang = caixa
    ini, fim = _expandir_para_token(texto, ini, fim)
    n = max(len(texto), 1)
    inteiro = (cfg.ocr_linha_inteira or ang > 4.0 or n <= 12
               or (fim - ini) / n >= 0.5)
    if inteiro:
        sx0, sx1 = px0, px1
    else:
        largura = max(px1 - px0, 1.0)
        pesos = _pesos_largura(texto)
        total_peso = sum(pesos) or 1.0
        sx0 = px0 + largura * (sum(pesos[:ini]) / total_peso)
        sx1 = px0 + largura * (sum(pesos[:fim]) / total_peso)
        # folga de ~1,5 caractere de cada lado, para absorver erro de
        # estimativa de largura do OCR
        folga = largura / total_peso * 1.5 + 2
        sx0, sx1 = max(px0, sx0 - folga), min(px1, sx1 + folga)
    r = pymupdf.Rect(ox + sx0 / zoom, oy + py0 / zoom,
                     ox + sx1 / zoom, oy + py1 / zoom)
    return r + (-cfg.margem_ocr, -cfg.margem_ocr, cfg.margem_ocr, cfg.margem_ocr)


def _ocr_pagina(img, cfg: Config):
    """OCR da pagina inteira e, quando vale a pena, tambem em blocos.

    O detector do RapidOCR reduz a imagem antes de procurar texto, entao em
    certidao digitalizada com letra miuda ele simplesmente PULA linhas
    inteiras. Rodando de novo em blocos (com sobreposicao) o texto fica
    proporcionalmente maior e essas linhas aparecem. Custa mais tempo, por
    isso o modo automatico so faz isso em pagina densa.
    """
    import numpy as np

    linhas = _ocr_linhas(img, cfg.motor_ocr, cfg.threads_ocr)
    n = cfg.ocr_blocos
    if n <= 0:                       # automatico
        n = 2 if len(linhas) >= 15 else 1
    if n <= 1:
        return linhas

    # sobreposicao generosa: sem ela um CPF cai bem na divisa e cada bloco
    # enxerga so metade dele
    h, w = img.shape[:2]
    folga_y, folga_x = int(h * 0.10), int(w * 0.10)
    for i in range(n):
        for j in range(n):
            y0 = max(0, i * h // n - folga_y)
            y1 = min(h, (i + 1) * h // n + folga_y)
            x0 = max(0, j * w // n - folga_x)
            x1 = min(w, (j + 1) * w // n + folga_x)
            if y1 - y0 < 40 or x1 - x0 < 40:
                continue
            bloco = np.ascontiguousarray(img[y0:y1, x0:x1])
            for quad, txt, sc in _ocr_linhas(bloco, cfg.motor_ocr, cfg.threads_ocr):
                linhas.append(([(p[0] + x0, p[1] + y0) for p in quad], txt, sc))
    return linhas


def _quad_para_rect(quad) -> tuple[float, float, float, float, float]:
    xs = [p[0] for p in quad]
    ys = [p[1] for p in quad]
    dx = quad[1][0] - quad[0][0]
    dy = quad[1][1] - quad[0][1]
    import math
    ang = abs(math.degrees(math.atan2(dy, dx)))
    ang = min(ang, 180 - ang)
    return min(xs), min(ys), max(xs), max(ys), ang


def regioes_para_ocr(page, cfg: Config) -> list["pymupdf.Rect"]:
    """Onde vale a pena rodar OCR.

    Numa pagina digital com dois logotipos, OCR da folha inteira e desperdicio:
    basta olhar os logotipos. Numa pagina digitalizada a imagem ocupa tudo e
    a regiao vira a pagina inteira.
    """
    if cfg.ocr_tudo:
        return [page.rect]
    try:
        infos = page.get_image_info()
    except Exception:  # noqa: BLE001
        return [page.rect]

    area_pag = abs(page.rect.get_area()) or 1.0
    rects: list[pymupdf.Rect] = []
    for info in infos:
        r = pymupdf.Rect(info["bbox"]) & page.rect
        if r.is_empty or abs(r.get_area()) / area_pag < cfg.area_min_imagem:
            continue
        rects.append(r + (-6, -6, 6, 6))
    if not rects:
        return []

    # junta regioes que se tocam, para nao fatiar texto no meio
    juntou = True
    while juntou:
        juntou = False
        for i in range(len(rects)):
            for j in range(i + 1, len(rects)):
                if not (rects[i] & rects[j]).is_empty or \
                        abs(rects[i].y0 - rects[j].y0) < 8:
                    rects[i] = rects[i] | rects[j]
                    del rects[j]
                    juntou = True
                    break
            if juntou:
                break

    total = sum(abs(r.get_area()) for r in rects)
    if total / area_pag > 0.55 or len(rects) > 6:
        return [page.rect]
    return [r & page.rect for r in rects]


def detectar_ocr(page, pix, cfg: Config, arquivo: str):
    """Devolve (deteccoes, linhas, texto_ocr) da camada de imagem."""
    import numpy as np

    regioes = regioes_para_ocr(page, cfg)
    if not regioes:
        return [], [], ""

    img_pag = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
        pix.height, pix.width, pix.n)
    if pix.n == 4:
        img_pag = img_pag[:, :, :3]

    zoom = cfg.dpi / 72.0
    ox, oy = page.rect.x0, page.rect.y0

    linhas_ocr: list = []
    for reg in regioes:
        rx0 = max(0, int((reg.x0 - ox) * zoom))
        ry0 = max(0, int((reg.y0 - oy) * zoom))
        rx1 = min(pix.width, int((reg.x1 - ox) * zoom))
        ry1 = min(pix.height, int((reg.y1 - oy) * zoom))
        if rx1 - rx0 < 24 or ry1 - ry0 < 12:
            continue
        recorte = np.ascontiguousarray(img_pag[ry0:ry1, rx0:rx1])
        try:
            for quad, txt, sc in _ocr_pagina(recorte, cfg):
                linhas_ocr.append(([(p[0] + rx0, p[1] + ry0) for p in quad], txt, sc))
        except RuntimeError as e:
            print(f"  [aviso] {e}", file=sys.stderr)
            return [], [], ""

    npag = page.number + 1
    out: list[Deteccao] = []
    linhas: list[tuple["pymupdf.Rect", str, float]] = []
    caixas: list[tuple] = []             # alinhado com `linhas`, em pixels
    partes_texto: list[str] = []

    for quad, texto, score in linhas_ocr:
        if score < cfg.ocr_score_min or not texto.strip():
            continue
        px0, py0, px1, py1, ang = _quad_para_rect(quad)
        r_linha = pymupdf.Rect(ox + px0 / zoom, oy + py0 / zoom,
                               ox + px1 / zoom, oy + py1 / zoom)
        # o OCR em blocos rele linhas que a passada da pagina inteira ja leu;
        # para o aviso de cobertura cada linha fisica conta uma vez so
        repetida = any(
            abs((r_linha & r).get_area()) > 0.5 * min(abs(r_linha.get_area()), abs(r.get_area()))
            for r, _, _ in linhas if not (r_linha & r).is_empty)
        linhas.append((r_linha, texto, score))
        caixas.append((px0, py0, px1, py1, ang))
        if not repetida:
            partes_texto.append(texto)

        achados = buscar_padroes(texto, cfg, do_ocr=True)

        if cfg.agressivo:
            achados = _completar_agressivo(texto, achados, cfg)
        if not achados:
            continue

        for a in achados:
            r = _rect_trecho_ocr(texto, a.ini, a.fim, caixas[-1], cfg, ox, oy, zoom)
            out.append(Deteccao(arquivo, npag, a.tipo, a.valor, "ocr",
                                r.x0, r.y0, r.x1, r.y1, score, a.valido,
                                metodo=a.metodo))

    def rect_trecho(k: int, ini: int, fim: int) -> "pymupdf.Rect":
        return _rect_trecho_ocr(linhas[k][1], ini, fim, caixas[k], cfg, ox, oy, zoom)

    out.extend(detectar_cpf_quebrado(linhas, rect_trecho, cfg, arquivo, npag, "ocr"))
    return out, linhas, "\n".join(partes_texto)


def _completar_agressivo(texto: str, achados: list[Achado], cfg: Config) -> list[Achado]:
    """Modo --agressivo: se a linha cita CPF/RG/e-mail/telefone e nada foi
    reconhecido ali, tarja do gatilho ate o fim da linha."""
    ja = {a.tipo for a in achados}
    extras: list[Achado] = []
    for tipo, rx in GATILHOS.items():
        if tipo not in cfg.tipos or tipo in ja:
            continue
        m = rx.search(texto)
        if not m:
            continue
        if any(a.ini < len(texto) and a.fim > m.end() for a in achados):
            continue
        extras.append(Achado(tipo, texto[m.start():], m.start(), len(texto),
                             99, False, metodo="agressivo"))
    return achados + extras


# ---------------------------------------------------------------------------
# 7. CAMADA 3 — QR CODE / CODIGO DE BARRAS
# ---------------------------------------------------------------------------


def detectar_visuais(page, pix, cfg: Config, arquivo: str) -> list[Deteccao]:
    if not (TIPOS_VISUAIS & cfg.tipos):
        return []
    try:
        import cv2
        import numpy as np
    except ImportError:
        return []

    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    if pix.n == 4:
        img = img[:, :, :3]
    cinza = cv2.cvtColor(np.ascontiguousarray(img), cv2.COLOR_RGB2GRAY)

    zoom = cfg.dpi / 72.0
    ox, oy = page.rect.x0, page.rect.y0
    npag = page.number + 1
    out: list[Deteccao] = []

    def registrar(pontos, tipo, conteudo="", metodo="padrao"):
        xs = [float(p[0]) for p in pontos]
        ys = [float(p[1]) for p in pontos]
        r = pymupdf.Rect(ox + min(xs) / zoom, oy + min(ys) / zoom,
                         ox + max(xs) / zoom, oy + max(ys) / zoom)
        r += (-3, -3, 3, 3)
        out.append(Deteccao(arquivo, npag, tipo, conteudo or "(conteudo nao lido)",
                            "visual", r.x0, r.y0, r.x1, r.y1, 1.0, metodo=metodo))

    if "qrcode" in cfg.tipos:
        try:
            det = cv2.QRCodeDetector()
            ok, infos, pontos, _ = det.detectAndDecodeMulti(cinza)
            if ok and pontos is not None:
                for i, quad in enumerate(pontos):
                    txt = infos[i] if infos is not None and i < len(infos) else ""
                    registrar(quad, "qrcode", (txt or "")[:120])
            else:
                ok2, pontos2 = det.detectMulti(cinza)
                if ok2 and pontos2 is not None:
                    for quad in pontos2:
                        registrar(quad, "qrcode")
        except cv2.error:
            pass

    if "codigo_barras" in cfg.tipos:
        achou_barras = False

        # 1) pyzbar (opcional) le QR e codigo de barras muito melhor que o OpenCV.
        #    No Windows o wheel ja traz a DLL; no Linux precisa de libzbar0.
        try:
            from pyzbar import pyzbar  # type: ignore
            for s in pyzbar.decode(cinza):
                x, y, w, h = s.rect
                registrar([(x, y), (x + w, y), (x + w, y + h), (x, y + h)],
                          "codigo_barras" if s.type != "QRCODE" else "qrcode",
                          s.data.decode("utf-8", "replace")[:120])
                achou_barras = True
        except Exception:  # noqa: BLE001
            pass

        # 2) detector nativo do OpenCV
        if hasattr(cv2, "barcode"):
            try:
                bdet = cv2.barcode.BarcodeDetector()
                resultado = bdet.detectAndDecodeWithType(cinza)
                ok = resultado[0]
                infos = resultado[1] if len(resultado) > 1 else []
                pontos = resultado[3] if len(resultado) > 3 else None
                if ok and pontos is not None:
                    for i, quad in enumerate(pontos):
                        txt = infos[i] if i < len(infos) else ""
                        registrar(quad, "codigo_barras", (txt or "")[:120])
                        achou_barras = True
            except Exception:  # noqa: BLE001
                pass

        # 3) rede de seguranca: acha a MANCHA de barras verticais mesmo quando
        #    nenhum decodificador consegue ler (scan torto, foto com reflexo).
        if cfg.barras_heuristica and not achou_barras:
            for quad in _manchas_de_barras(cinza, cv2, np):
                registrar(quad, "codigo_barras", "(barras detectadas por imagem)",
                          metodo="heuristica")

    return out


def _manchas_de_barras(cinza, cv2, np) -> list[list[tuple[float, float]]]:
    """Localiza regioes com muitas transicoes verticais (cara de codigo de
    barras). Nao decodifica - so devolve onde tarjar."""
    gx = cv2.Sobel(cinza, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(cinza, cv2.CV_32F, 0, 1, ksize=3)
    grad = cv2.convertScaleAbs(cv2.subtract(np.absolute(gx), np.absolute(gy)))
    grad = cv2.blur(grad, (9, 9))
    _, bin_ = cv2.threshold(grad, 200, 255, cv2.THRESH_BINARY)
    nucleo = cv2.getStructuringElement(cv2.MORPH_RECT, (41, 9))
    fechado = cv2.morphologyEx(bin_, cv2.MORPH_CLOSE, nucleo)
    fechado = cv2.erode(fechado, None, iterations=4)
    fechado = cv2.dilate(fechado, None, iterations=4)
    contornos, _ = cv2.findContours(fechado, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    area_img = cinza.shape[0] * cinza.shape[1]
    saida = []
    for c in contornos:
        x, y, w, h = cv2.boundingRect(c)
        area = w * h
        if h == 0 or area < area_img * 0.0008 or area > area_img * 0.25:
            continue
        if not (1.8 <= w / h <= 14):
            continue
        saida.append([(x, y), (x + w, y), (x + w, y + h), (x, y + h)])
    return saida


# ---------------------------------------------------------------------------
# 8. PROCESSAMENTO DE UM PDF
# ---------------------------------------------------------------------------


def abrir_documento(caminho):
    """Abre o PDF ja 'achatado'.

    Campo de formulario e anotacao NAO sao conteudo da pagina: o
    apply_redactions passa por cima deles e o valor digitado continua no
    arquivo, extraivel com Ctrl+C. bake() transforma esses objetos em
    conteudo normal da pagina, ai a tarja apaga de verdade.
    """
    doc = pymupdf.open(caminho)
    precisa = False
    try:
        precisa = bool(doc.is_form_pdf)
    except Exception:  # noqa: BLE001
        pass
    if not precisa:
        for page in doc:
            if page.first_annot is not None:
                precisa = True
                break
    if precisa:
        try:
            doc.bake()
        except Exception:  # noqa: BLE001
            pass
    return doc


def riscos_do_arquivo(doc, cfg: Optional["Config"] = None) -> list[str]:
    """Coisas que a tarja nao resolve e o revisor precisa saber."""
    avisos = []
    try:
        if doc.embfile_count():
            avisos.append(f"o PDF tem {doc.embfile_count()} arquivo(s) anexado(s) "
                          f"embutido(s) - a tarja não entra neles")
    except Exception:  # noqa: BLE001
        pass
    # marcador (sumario) nao e conteudo de pagina: a tarja nao chega nele.
    # So avisa se algum titulo tiver cara de dado pessoal - todo PDF do SEI tem
    # marcadores, e avisar sempre viraria ruido.
    if cfg is not None:
        try:
            for _, titulo, pagina, *_ in doc.get_toc():
                # so padroes de alta precisao: titulo de marcador do SEI traz
                # numero de documento, que o padrao de RG confundiria
                achados = [x for x in buscar_padroes(titulo, cfg)
                           if x.tipo in ("cpf", "email", "telefone", "cartao", "cnpj")]
                if achados:
                    tipos = sorted({ROTULOS.get(x.tipo, x.tipo) for x in achados})
                    avisos.append(f"o marcador (sumário) \"{mascarar(titulo, 6)}\" da "
                                  f"pág. {pagina} contém {', '.join(tipos)} - a tarja "
                                  f"não alcança marcadores; edite-o no leitor de PDF")
        except Exception:  # noqa: BLE001
            pass
    return avisos


def pagina_tem_imagem_relevante(page, area_min: float) -> bool:
    try:
        infos = page.get_image_info()
    except Exception:  # noqa: BLE001
        return bool(page.get_images(full=True))
    area_pagina = abs(page.rect.get_area()) or 1.0
    for info in infos:
        r = pymupdf.Rect(info["bbox"])
        if abs(r.get_area()) / area_pagina >= area_min:
            return True
    return False


def dedup_por_rect(dets: list[Deteccao], limite: float = 0.55) -> list[Deteccao]:
    """Remove deteccoes de OCR que repetem uma deteccao da camada de texto."""
    saida: list[Deteccao] = []
    ordem = {"texto": 0, "visual": 1, "termo": 1, "ocr": 2}
    for d in sorted(dets, key=lambda x: (x.pagina, ordem.get(x.origem, 3))):
        repetida = False
        for j in saida:
            if j.pagina != d.pagina or j.tipo != d.tipo:
                continue
            inter = j.rect & d.rect
            if inter.is_empty:
                continue
            menor = min(abs(j.rect.get_area()), abs(d.rect.get_area())) or 1.0
            if abs(inter.get_area()) / menor >= limite:
                repetida = True
                break
        if not repetida:
            saida.append(d)
    return saida


DESCRICAO_GATILHO = {
    "cpf": "CPF", "rg": "RG/identidade/CNH", "email": "e-mail",
    "telefone": "telefone", "endereco": "endereço/CEP",
    "conta": "dados bancários",
}


def _avisos_de_cobertura(npag: int, texto: str, dets: list[Deteccao],
                         cfg: Config) -> list[str]:
    """Se a pagina diz 'CPF' cinco vezes e so saiu uma tarja de CPF, algo
    escapou (scan borrado, coluna cortada). Isso vira aviso no relatorio."""
    avisos: list[str] = []
    equivalentes = {"cpf": {"cpf", "cpf_parcial"}, "conta": {"conta", "agencia", "pix"}}
    for tipo, rx in GATILHOS.items():
        if tipo not in cfg.tipos:
            continue
        mencoes = len(rx.findall(texto))
        if mencoes < 2:
            continue
        alvos = equivalentes.get(tipo, {tipo})
        achadas = sum(1 for d in dets if d.tipo in alvos)
        if achadas == 0 or mencoes - achadas >= 3:
            avisos.append(
                f"pag. {npag}: a página menciona {DESCRICAO_GATILHO[tipo]} {mencoes}x "
                f"e só {achadas} tarja(s) desse tipo foram aplicadas - pode haver "
                f"dado que o OCR não leu, ou o campo pode estar vazio")
    return avisos


def processar_pagina(page, cfg: Config, arq: str) -> tuple[list[Deteccao], list[str]]:
    """Roda as tres camadas de deteccao em uma pagina."""
    npag = page.number + 1
    avisos: list[str] = []
    dets_pag: list[Deteccao] = []

    dets_txt, linhas_txt = detectar_texto(page, cfg, arq)
    dets_pag.extend(dets_txt)
    dets_pag.extend(detectar_por_rotulo(linhas_txt, cfg, arq, npag, "texto"))
    texto_pagina = page.get_text()

    quer_ocr = cfg.ocr and (cfg.ocr_tudo or
                            pagina_tem_imagem_relevante(page, cfg.area_min_imagem))
    precisa_pixel = quer_ocr or bool(TIPOS_VISUAIS & cfg.tipos)

    if precisa_pixel:
        mat = pymupdf.Matrix(cfg.dpi / 72.0, cfg.dpi / 72.0)
        pix = page.get_pixmap(matrix=mat, colorspace=pymupdf.csRGB, alpha=False)

        if quer_ocr:
            dets_ocr, linhas_ocr, texto_ocr = detectar_ocr(page, pix, cfg, arq)
            dets_pag.extend(dets_ocr)
            dets_pag.extend(detectar_por_rotulo(linhas_ocr, cfg, arq, npag, "ocr"))
            texto_pagina += "\n" + texto_ocr
            if len(page.get_text().strip()) < 120 and not dets_ocr:
                avisos.append(
                    f"pag. {npag}: a página é uma imagem e o OCR não achou nenhum "
                    f"dado - confira se há documento, assinatura ou número ilegível")

        dets_pag.extend(detectar_visuais(page, pix, cfg, arq))
        del pix

    avisos.extend(_avisos_de_cobertura(npag, texto_pagina, dets_pag, cfg))
    return dets_pag, avisos


_DOC_DO_WORKER: dict = {}


def _doc_do_worker(caminho: str):
    """Mantem o PDF aberto (e ja achatado) entre paginas no mesmo processo."""
    doc = _DOC_DO_WORKER.get(caminho)
    if doc is None:
        for antigo in _DOC_DO_WORKER.values():
            antigo.close()
        _DOC_DO_WORKER.clear()
        doc = abrir_documento(caminho)
        _DOC_DO_WORKER[caminho] = doc
    return doc


def _worker_pagina(args) -> tuple[int, list[Deteccao], list[str]]:
    caminho, cfg, n = args
    doc = _doc_do_worker(caminho)
    d, a = processar_pagina(doc[n - 1], cfg, caminho)
    return n, d, a


def _fmt_tempo(seg: float) -> str:
    seg = int(seg)
    return f"{seg // 60}min{seg % 60:02d}s" if seg >= 60 else f"{seg}s"


class Progresso:
    """Linha de progresso que se atualiza no lugar (\\r)."""

    def __init__(self, nome: str, total: int, ativo: bool):
        self.nome, self.total, self.ativo = nome, total, ativo
        self.feitas = self.ocorrencias = 0
        self.inicio = time.time()

    def passo(self, qtd: int) -> None:
        self.feitas += 1
        self.ocorrencias += qtd
        if not self.ativo:
            return
        dec = time.time() - self.inicio
        falta = dec / self.feitas * (self.total - self.feitas)
        print(f"\r  {self.nome[:40]}: pagina {self.feitas}/{self.total}"
              f" | {_fmt_tempo(dec)} decorrido, ~{_fmt_tempo(falta)} restante   ",
              end="", flush=True)

    def fim(self) -> None:
        if self.ativo and self.total:
            print("\r" + " " * 110 + "\r", end="", flush=True)


class Cancelado(Exception):
    """O usuario cancelou o processamento no meio (so acontece via API)."""


# De quanto em quanto tempo a analise paralela confere se foi cancelada.
INTERVALO_CANCELAMENTO = 0.25


def analisar_pdf(caminho: Path, cfg: Config, processos: int = 1,
                 mostrar_progresso: bool = False,
                 ao_progredir: Optional[Callable[[int, int], None]] = None,
                 deve_parar: Optional[Callable[[], bool]] = None,
                 ) -> tuple[list[Deteccao], list[str]]:
    """Roda as tres camadas e devolve (deteccoes, avisos).

    ao_progredir(feitas, total) e chamado a cada pagina concluida - e o que a
    API usa para mostrar a barra de progresso no navegador.

    deve_parar() e consultado durante a analise; se devolver True, os
    processos de OCR sao encerrados na hora e sobe Cancelado.
    """
    parar = deve_parar or (lambda: False)
    doc = pymupdf.open(caminho)
    total_pag = doc.page_count
    avisos_arquivo = riscos_do_arquivo(doc, cfg)
    alvo = [n for n in range(1, total_pag + 1)
            if not cfg.paginas or n in cfg.paginas]
    if mostrar_progresso:
        com_img = sum(1 for n in alvo
                      if cfg.ocr and pagina_tem_imagem_relevante(doc[n - 1], cfg.area_min_imagem))
        print(f"  {Path(caminho).name}: {len(alvo)} pagina(s), {com_img} com imagem "
              f"(OCR){' - pode levar alguns minutos' if com_img > 5 else ''}", flush=True)
    doc.close()

    dets: list[Deteccao] = []
    avisos: list[str] = []
    prog = Progresso(Path(caminho).name, len(alvo), mostrar_progresso)

    if processos > 1 and len(alvo) > 1:
        with ProcessPoolExecutor(max_workers=min(processos, len(alvo))) as ex:
            pendentes = {ex.submit(_worker_pagina, (str(caminho), cfg, n)) for n in alvo}
            while pendentes:
                # espera em fatias curtas para atender o cancelamento sem
                # aguardar a pagina (OCR pode levar varios segundos) terminar
                prontos, pendentes = wait(pendentes, timeout=INTERVALO_CANCELAMENTO,
                                          return_when=FIRST_COMPLETED)
                if parar():
                    # mata os processos de OCR; sem isso o "with" esperaria
                    # todas as paginas da fila terminarem
                    ex.kill_workers()
                    raise Cancelado()
                for fut in prontos:
                    _, d, a = fut.result()
                    dets.extend(d)
                    avisos.extend(a)
                    prog.passo(len(d))
                    if ao_progredir:
                        ao_progredir(prog.feitas, prog.total)
    else:
        doc = abrir_documento(caminho)
        for n in alvo:
            if parar():  # sem processos filhos: confere entre uma pagina e outra
                doc.close()
                raise Cancelado()
            d, a = processar_pagina(doc[n - 1], cfg, str(caminho))
            dets.extend(d)
            avisos.extend(a)
            prog.passo(len(d))
            if ao_progredir:
                ao_progredir(prog.feitas, prog.total)
        doc.close()
    prog.fim()

    avisos.sort(key=lambda s: int(re.search(r"\d+", s).group()) if re.search(r"\d+", s) else 0)
    avisos = avisos_arquivo + avisos
    dets = dedup_por_rect(dets)
    dets = [d for d in dets if d.id not in cfg.ignorar]
    dets.sort(key=lambda d: (d.pagina, d.y0, d.x0))
    return dets, avisos


# ---------------------------------------------------------------------------
# 9. ESCRITA DOS PDFs
# ---------------------------------------------------------------------------

CORES = {
    "cpf": (0.85, 0.10, 0.10),
    "email": (0.10, 0.35, 0.85),
    "telefone": (0.90, 0.50, 0.00),
    "rg": (0.60, 0.10, 0.70),
    "cep": (0.00, 0.55, 0.45),
    "endereco": (0.00, 0.55, 0.45),
    "agencia": (0.35, 0.35, 0.10),
    "conta": (0.35, 0.35, 0.10),
    "cartao": (0.35, 0.35, 0.10),
    "pix": (0.35, 0.35, 0.10),
    "iban": (0.35, 0.35, 0.10),
    "qrcode": (0.10, 0.10, 0.10),
    "codigo_barras": (0.10, 0.10, 0.10),
}


def gerar_pdf_revisao(entrada: Path, saida: Path, dets: list[Deteccao]) -> None:
    doc = abrir_documento(entrada)
    por_pagina: dict[int, list[Deteccao]] = {}
    for d in dets:
        por_pagina.setdefault(d.pagina, []).append(d)

    for npag, lista in por_pagina.items():
        page = doc[npag - 1]
        for d in lista:
            cor = CORES.get(d.tipo, (0.9, 0.2, 0.2))
            page.draw_rect(d.rect, color=cor, width=0.9,
                           fill=cor, fill_opacity=0.28, overlay=True)
            rotulo = f"{d.id} {d.tipo}"
            y = max(d.rect.y0 - 1.5, 6)
            try:
                page.insert_text((d.rect.x0, y), rotulo, fontsize=4.5,
                                 color=cor, overlay=True)
            except Exception:  # noqa: BLE001
                pass
    doc.save(saida, garbage=3, deflate=True)
    doc.close()


def _nucleo_do_texto(r: "pymupdf.Rect", margem: float) -> "pymupdf.Rect":
    """Faixa central de uma tarja da camada de texto: so ela apaga o texto.

    O MuPDF apaga todo caractere cuja caixa encoste na tarja, e essa caixa vem
    da fonte inteira (bem mais alta que a letra). Em linhas apertadas, como no
    carimbo de assinatura digital, a caixa de uma linha invade a vizinha: a
    tarja do CPF arrancava "024.12.02" de "Dados: 2024.12.02" na linha de
    baixo. A faixa central encosta em todos os caracteres do dado e em nenhum
    vizinho, nem nos da mesma linha (o ":" antes do CPF fica).
    """
    x0, x1 = r.x0 + margem, r.x1 - margem
    y0, y1 = r.y0 + margem * 0.6, r.y1 - margem * 0.6
    w, h = x1 - x0, y1 - y0
    if w <= 1 or h <= 1:          # caixa degenerada: apaga pela tarja inteira
        return pymupdf.Rect(r)
    dx = min(0.5, w * 0.25)
    return pymupdf.Rect(x0 + dx, y0 + h * 0.35, x1 - dx, y1 - h * 0.35)


def _texto_horizontal(page, r: "pymupdf.Rect") -> bool:
    """Todo texto sob a tarja corre na horizontal? Em texto girado (carimbo
    vertical na margem, marca d'agua diagonal) a faixa central nao encostaria
    em todos os caracteres, entao ali a tarja apaga pelo retangulo inteiro."""
    try:
        dados = page.get_text("rawdict", clip=r)
    except Exception:  # noqa: BLE001
        return False
    for bloco in dados.get("blocks", []):
        for linha in bloco.get("lines", []):
            cos, sen = linha.get("dir", (1.0, 0.0))
            if abs(sen) > 0.02 or cos <= 0:
                return False
    return True


def aplicar_tarjas(entrada: Path, saida: Path, dets: list[Deteccao],
                   limpar_metadados: bool = True, margem_texto: float = 1.2) -> None:
    """Tarja destrutiva, em dois passos por pagina.

    1. Apaga o texto. Tarja da camada de texto horizontal apaga so pela faixa
       central (_nucleo_do_texto). Texto girado e tarja do OCR apagam pelo
       retangulo inteiro (a camada de texto invisivel de um scan pode estar
       desalinhada da imagem).
    2. Pinta o retangulo inteiro de preto, zera os pixels de imagem embaixo e
       remove desenho coberto. Aqui o texto nao e mexido: o que sobrou e
       vizinho, nao dado.

    margem_texto tem que ser a mesma usada na deteccao (Config.margem_texto).
    """
    doc = abrir_documento(entrada)
    por_pagina: dict[int, list[Deteccao]] = {}
    for d in dets:
        por_pagina.setdefault(d.pagina, []).append(d)

    for npag, lista in por_pagina.items():
        page = doc[npag - 1]
        for d in lista:
            if d.origem == "texto" and _texto_horizontal(page, d.rect):
                alvo = _nucleo_do_texto(d.rect, margem_texto)
            else:
                alvo = d.rect
            page.add_redact_annot(alvo, fill=False)
        page.apply_redactions(
            images=getattr(pymupdf, "PDF_REDACT_IMAGE_NONE", 0),
            graphics=getattr(pymupdf, "PDF_REDACT_LINE_ART_NONE", 0),
            text=getattr(pymupdf, "PDF_REDACT_TEXT_REMOVE", 0),
        )
        for d in lista:
            page.add_redact_annot(d.rect, fill=(0, 0, 0))
        page.apply_redactions(
            images=pymupdf.PDF_REDACT_IMAGE_PIXELS,   # zera os pixels da imagem
            graphics=getattr(pymupdf, "PDF_REDACT_LINE_ART_REMOVE_IF_COVERED", 1),
            text=getattr(pymupdf, "PDF_REDACT_TEXT_NONE", 1),
        )

    if limpar_metadados:
        doc.set_metadata({})
        try:
            doc.del_xml_metadata()
        except Exception:  # noqa: BLE001
            pass

    doc.save(saida, garbage=4, deflate=True, clean=True)
    doc.close()


# ---------------------------------------------------------------------------
# 10. RELATORIO
# ---------------------------------------------------------------------------

NOME_REVISAO = "revisao_manual.json"
LIMIAR_OCR_INCERTO = 0.90


def motivo_para_conferir(r: dict) -> Optional[str]:
    """Diz por que uma tarja merece olho humano. None = tarja confiavel,
    fica fora do JSON (ex.: CPF valido na camada de texto, e-mail digitado)."""
    tipo, origem, metodo = r["tipo"], r["origem"], r.get("metodo", "padrao")
    if metodo == "agressivo":
        return ("tarja larga do modo agressivo (da palavra 'CPF', 'RG'... até o fim "
                "da linha): confira se não apagou texto demais")
    if metodo == "heuristica":
        return ("mancha com cara de código de barras que nenhum leitor decodificou: "
                "confira se era mesmo um código")
    if metodo == "rotulo":
        return ("valor achado pelo rótulo vizinho (ex.: 'RG' na linha de cima): "
                "confira se a tarja caiu no campo certo")
    if tipo == "cpf_parcial":
        return ("CPF incompleto (cortado na borda do scan ou mal lido): confira se a "
                "tarja cobre o número inteiro")
    if tipo == "cpf" and r.get("validado") == "nao":
        return ("formato de CPF com dígito verificador inválido: erro de leitura do "
                "OCR ou outro número (protocolo, matrícula)")
    if tipo == "endereco":
        return ("endereço é detectado por heurística: confira se é endereço pessoal "
                "e não institucional")
    if origem == "ocr" and r["confianca"] < LIMIAR_OCR_INCERTO:
        return (f"OCR leu com confiança baixa ({r['confianca']:.2f}): confira se a "
                f"tarja cobre o dado inteiro")
    return None


def revisao_do_arquivo(res: dict, mostrar_valores: bool = False) -> dict:
    """O que um arquivo tem para conferir. res = {arquivo, dets, avisos, destino}
    (dets ja como dict). Devolve as tres listas, possivelmente vazias."""
    tarjas = []
    for r in sorted(res["dets"], key=lambda r: (r["pagina"], r["y0"])):
        motivo = motivo_para_conferir(r)
        if motivo:
            tarjas.append({
                "id": r["id"],
                "pagina": r["pagina"],
                "tipo": r["rotulo"],
                "valor": r["valor"] if mostrar_valores else r["valor_mascarado"],
                "motivo": motivo,
                "ignorar": False,
            })
    paginas, gerais = [], []
    for av in res["avisos"]:
        m = re.match(r"pag\. (\d+): (.*)", av)
        if m:
            paginas.append({"pagina": int(m.group(1)), "motivo": m.group(2)})
        else:
            gerais.append(av)
    return {"avisos_do_arquivo": gerais, "paginas_para_conferir": paginas,
            "tarjas_para_conferir": tarjas}


def escrever_revisao(destino: Path, resultados: list[dict],
                     mostrar_valores: bool) -> int:
    """Grava so o que vale a pena o usuario conferir. Devolve quantos itens."""
    arquivos_json, sem_pendencia, total = [], [], 0
    for res in sorted(resultados, key=lambda r: r["arquivo"]):
        rev = revisao_do_arquivo(res, mostrar_valores)
        gerais, paginas, tarjas = (rev["avisos_do_arquivo"], rev["paginas_para_conferir"],
                                   rev["tarjas_para_conferir"])
        if not (tarjas or paginas or gerais):
            sem_pendencia.append(res["arquivo"])
            continue
        item = {"arquivo": res["arquivo"]}
        if res.get("destino"):
            item["resultado"] = Path(res["destino"]).name
        item["tarjas_aplicadas"] = len(res["dets"])
        if gerais:
            item["avisos_do_arquivo"] = gerais
        if paginas:
            item["paginas_para_conferir"] = paginas
        if tarjas:
            item["tarjas_para_conferir"] = tarjas
        total += len(gerais) + len(paginas) + len(tarjas)
        arquivos_json.append(item)

    payload = {
        "como_usar": (
            "Abra o PDF indicado em 'resultado' e confira as páginas listadas. "
            "Tarja que não devia existir: troque \"ignorar\" para true e rode de novo "
            "com --decisoes apontando para este arquivo. Dado que ficou sem tarja: "
            "rode de novo com --termo \"texto\" ou --agressivo."),
        "gerado_em": time.strftime("%Y-%m-%d %H:%M:%S"),
        "versao": VERSAO,
        "itens_para_conferir": total,
        "arquivos": arquivos_json,
        "arquivos_sem_pendencia": sem_pendencia,
    }
    with open(destino, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return total


def ler_decisoes(caminho: Path) -> set[str]:
    """IDs a ignorar: do revisao_manual.json ("ignorar": true) ou de um .txt
    com um ID por linha (IDs aparecem nos *_REVISAO.pdf)."""
    ids: set[str] = set()
    if not caminho.exists():
        sys.exit(f"Arquivo de decisoes nao encontrado: {caminho}")
    if caminho.suffix.lower() == ".json":
        dados = json.loads(caminho.read_text(encoding="utf-8"))
        for arq in dados.get("arquivos", []):
            for t in arq.get("tarjas_para_conferir", []):
                if t.get("ignorar") is True or str(t.get("ignorar")).lower() in ("true", "sim", "x"):
                    ids.add(str(t.get("id", "")).strip())
    else:
        for linha in caminho.read_text(encoding="utf-8").splitlines():
            linha = linha.split("#", 1)[0].strip()
            if linha:
                ids.add(linha)
    return ids


# ---------------------------------------------------------------------------
# 11. ORQUESTRACAO
# ---------------------------------------------------------------------------


def _trabalho(args) -> tuple[str, list[dict], list[str], str]:
    caminho, cfg, acao, pasta_saida, limpar_meta, proc_pagina, progresso = args
    caminho = Path(caminho)
    try:
        dets, avisos = analisar_pdf(caminho, cfg, proc_pagina, progresso)
        destino = ""
        if acao == "revisar":
            destino = str(Path(pasta_saida) / f"{caminho.stem}_REVISAO.pdf")
            gerar_pdf_revisao(caminho, Path(destino), dets)
        elif acao == "aplicar":
            destino = str(Path(pasta_saida) / f"{caminho.stem}_TARJADO.pdf")
            aplicar_tarjas(caminho, Path(destino), dets, limpar_meta,
                           margem_texto=cfg.margem_texto)
        return str(caminho), [d.como_dict() for d in dets], avisos, destino
    except Exception as e:  # noqa: BLE001
        return str(caminho), [], [f"ERRO: {type(e).__name__}: {e}"], ""


def coletar_pdfs(entradas: Sequence[str], recursivo: bool,
                 pular: tuple[str, ...] = ("_TARJADO", "_REVISAO")) -> list[Path]:
    """Expande arquivos, pastas e curingas em uma lista de PDFs.

    Pula os arquivos que o proprio script gerou (*_TARJADO.pdf, *_REVISAO.pdf),
    para nao reprocessar a saida quando ela fica dentro da pasta de entrada.
    """
    achados: list[Path] = []
    for item in entradas:
        p = Path(item)
        if p.is_dir():
            candidatos = p.rglob("*") if recursivo else p.iterdir()
            achados.extend(sorted(c for c in candidatos if c.is_file()))
        elif p.is_file():
            achados.append(p)
        else:
            achados.extend(sorted(Path().glob(item)))
    vistos, unicos = set(), []
    for p in achados:
        if p.suffix.lower() != ".pdf" or p.stem.upper().endswith(pular):
            continue
        rp = p.resolve()
        if rp not in vistos:
            vistos.add(rp)
            unicos.append(p)
    return unicos


def montar_config(a) -> Config:
    tipos = set(TIPOS_PADRAO)
    if a.tipos:
        pedidos = {t.strip().lower() for t in a.tipos.split(",") if t.strip()}
        desconhecidos = pedidos - set(TODOS_TIPOS)
        if desconhecidos:
            sys.exit(f"Tipo desconhecido: {', '.join(sorted(desconhecidos))}.\n"
                     f"Disponiveis: {', '.join(TODOS_TIPOS)}")
        tipos = pedidos
    for t in (a.sem or "").split(","):
        tipos.discard(t.strip().lower())

    branca: list[str] = []
    if a.lista_branca:
        for linha in Path(a.lista_branca).read_text(encoding="utf-8").splitlines():
            linha = linha.strip()
            if linha and not linha.startswith("#"):
                branca.append(sem_acento_minusculo(linha))

    termos = list(a.termo or [])
    if getattr(a, "termos_arquivo", None):
        for linha in Path(a.termos_arquivo).read_text(encoding="utf-8").splitlines():
            linha = linha.strip()
            if linha and not linha.startswith("#"):
                termos.append(linha)

    ignorar = set(a.ignorar or [])
    if getattr(a, "decisoes", None):
        ignorar |= ler_decisoes(Path(a.decisoes))

    paginas = None
    if getattr(a, "paginas", None):
        paginas = set()
        for parte in a.paginas.split(","):
            parte = parte.strip()
            if "-" in parte:
                ini, fim = parte.split("-", 1)
                paginas.update(range(int(ini), int(fim) + 1))
            elif parte:
                paginas.add(int(parte))
        paginas = tuple(sorted(paginas))

    return Config(
        tipos=tipos,
        dpi=a.dpi,
        ocr=not a.sem_ocr,
        ocr_tudo=a.ocr_tudo,
        area_min_imagem=a.area_min_imagem,
        ocr_linha_inteira=a.ocr_linha_inteira,
        ocr_score_min=a.ocr_confianca_min,
        validar_cpf=a.validar_cpf,
        lista_branca=tuple(branca),
        termos=tuple(termos),
        regexes_extra=tuple(a.regex or []),
        ignorar=frozenset(ignorar),
        paginas=paginas,
        motor_ocr=a.ocr_motor,
        usar_rotulos=not a.sem_rotulos,
        agressivo=a.agressivo,
        barras_heuristica=a.barras_heuristica,
        ocr_blocos=(0 if a.ocr_blocos == "auto" else int(a.ocr_blocos)),
    )


def definir_paralelismo(cfg: Config, processos: int = 0, nucleos: int = 0) -> int:
    """processos=0 escolhe sozinho (metade dos nucleos, ate 4) e reparte as
    threads do OCR entre eles. nucleos=0 usa os da maquina; num container com
    limite de CPU, quem chama deve passar o limite (os.cpu_count ve o host)."""
    nucleos = nucleos if nucleos > 0 else (os.cpu_count() or 2)
    processos = processos if processos > 0 else max(1, min(4, nucleos // 2))
    if processos > 1:
        cfg.threads_ocr = max(1, nucleos // processos)
    return processos


def preparar_execucao(a, cfg: Config) -> tuple[int, str]:
    """Decide quantos processos usar, reparte os nucleos entre eles e
    confere ANTES de comecar se o OCR esta instalado - melhor parar agora do
    que gerar um PDF 'tarjado' em que as imagens nem foram lidas."""
    processos = definir_paralelismo(cfg, a.processos)

    nome_motor = "-"
    if cfg.ocr:
        try:
            _, nome_motor = obter_motor_ocr(cfg.motor_ocr, cfg.threads_ocr)
        except RuntimeError as e:
            sys.exit(f"{e}\n\nOu rode com --sem-ocr se os PDFs forem 100% digitais "
                     f"(sem digitalizacao) - mas ai dado dentro de imagem NAO e tarjado.")
    return processos, nome_motor


def executar(a, acao: str) -> int:
    arquivos = coletar_pdfs(a.arquivos, a.recursivo)
    if not arquivos:
        sys.exit("Nenhum PDF encontrado em: " + ", ".join(a.arquivos) + "\n"
                 "Crie a pasta, coloque os PDFs dentro e rode de novo. Ex.:\n"
                 f"  mkdir entrada   (e copie os PDFs para ela)\n"
                 f"  python {Path(sys.argv[0]).name} aplicar entrada -o saida")

    cfg = montar_config(a)
    pasta = Path(a.saida)
    pasta.mkdir(parents=True, exist_ok=True)
    processos, motor = preparar_execucao(a, cfg)

    print(f"redator {VERSAO}  |  acao: {acao}  |  {len(arquivos)} PDF(s)"
          f"  |  {processos} processo(s)", flush=True)
    print(f"tipos: {', '.join(sorted(cfg.tipos))}")
    print(f"OCR: {'desligado' if not cfg.ocr else f'{motor} ({cfg.dpi} dpi)'}"
          f"  |  saida: {pasta.resolve()}")
    print("Ctrl+C cancela.  " + "-" * 55, flush=True)

    # com um unico PDF o paralelismo vai para as paginas; com varios, para os
    # arquivos (assim o motor de OCR e carregado uma vez por processo)
    varios_em_paralelo = processos > 1 and len(arquivos) > 1
    por_pagina = processos if len(arquivos) == 1 else 1
    tarefas = [(str(p), cfg, acao, str(pasta), not a.manter_metadados, por_pagina,
                not varios_em_paralelo)
               for p in arquivos]
    resultados: list[dict] = []
    inicio = time.time()

    if varios_em_paralelo:
        print(f"  processando {len(arquivos)} arquivos em paralelo; cada um aparece "
              f"aqui quando terminar...", flush=True)
        with ProcessPoolExecutor(max_workers=processos) as ex:
            futuros = {ex.submit(_trabalho, t): t[0] for t in tarefas}
            for fut in as_completed(futuros):
                _relatar(fut.result(), resultados)
    else:
        for t in tarefas:
            _relatar(_trabalho(t), resultados)

    registros = [r for res in resultados for r in res["dets"]]
    destino_rev = pasta / NOME_REVISAO
    n_revisar = escrever_revisao(destino_rev, resultados, a.mostrar_valores)

    print("-" * 72)
    resumo: dict[str, int] = {}
    for r in registros:
        resumo[r["rotulo"]] = resumo.get(r["rotulo"], 0) + 1
    for rotulo, qtd in sorted(resumo.items(), key=lambda kv: -kv[1]):
        print(f"  {qtd:5d}  {rotulo}")
    print(f"\nTotal: {len(registros)} ocorrencia(s) em {len(arquivos)} arquivo(s) "
          f"- {_fmt_tempo(time.time() - inicio)}")
    if n_revisar:
        print(f"Para conferir manualmente: {n_revisar} item(ns) -> {destino_rev}")
    else:
        print("Nada que precise de conferencia manual.")
    if acao == "revisar":
        print("\nConfira os *_REVISAO.pdf (cada tarja aparece com um ID). Para desfazer uma")
        print(f"tarja, marque \"ignorar\": true no {NOME_REVISAO} (ou liste o ID num .txt) e rode:")
        print(f"  python {Path(sys.argv[0]).name} aplicar ... --decisoes {destino_rev}")
    return 0


def _relatar(resultado, resultados: list[dict]) -> None:
    arquivo, dets, avisos, destino = resultado
    nome = Path(arquivo).name
    resultados.append({"arquivo": nome, "dets": dets, "avisos": avisos,
                       "destino": destino})
    marca = "!" if any(av.startswith("ERRO") for av in avisos) else " "
    print(f"{marca} {nome}: {len(dets)} ocorrencia(s)"
          + (f" -> {Path(destino).name}" if destino else ""), flush=True)
    for av in avisos:
        print(f"    . {av}")


def auditar(a) -> int:
    """Reabre PDFs ja tarjados e confere se sobrou dado sensivel."""
    arquivos = coletar_pdfs(a.arquivos, a.recursivo, pular=("_REVISAO",))
    if not arquivos:
        sys.exit("Nenhum PDF encontrado.")
    cfg = montar_config(a)
    processos, _ = preparar_execucao(a, cfg)
    print(f"Auditando {len(arquivos)} PDF(s)"
          f"{' (com OCR)' if cfg.ocr else ' (so camada de texto)'}...", flush=True)
    total = 0
    for p in arquivos:
        dets, _ = analisar_pdf(p, cfg, processos, mostrar_progresso=True)
        total += len(dets)
        if dets:
            print(f"\n! {p.name}: {len(dets)} residuo(s)")
            for d in dets[:40]:
                print(f"    pag {d.pagina:3d}  {ROTULOS.get(d.tipo, d.tipo):22s} "
                      f"{d.origem:6s}  {mascarar(d.valor)}")
            if len(dets) > 40:
                print(f"    ... e mais {len(dets) - 40}")
        else:
            print(f"  {p.name}: limpo")
    print(f"\nTotal de residuos: {total}")
    return 1 if total else 0


# ---------------------------------------------------------------------------
# 12. CLI
# ---------------------------------------------------------------------------


def adicionar_opcoes_comuns(sp) -> None:
    sp.add_argument("arquivos", nargs="+",
                    help="PDFs, pastas ou padroes (ex.: entrada)")
    sp.add_argument("-o", "--saida", default="saida_tarjada",
                    help="pasta de saida (padrao: saida_tarjada)")
    sp.add_argument("-r", "--recursivo", action="store_true",
                    help="varrer subpastas")
    sp.add_argument("-j", "--processos", type=int, default=0,
                    help="processos em paralelo (padrao: automatico, metade dos "
                         "nucleos, ate 4). Com varios PDFs, 1 PDF por processo; "
                         "com um PDF so, divide as paginas")
    sp.add_argument("--tipos", default="",
                    help="lista separada por virgula. Disponiveis: "
                         + ", ".join(TODOS_TIPOS))
    sp.add_argument("--sem", default="",
                    help="tipos a desligar, separados por virgula (ex.: endereco,telefone)")
    sp.add_argument("--dpi", type=int, default=300,
                    help="resolucao do OCR/QR (padrao 300; 400 para scan ruim)")
    sp.add_argument("--sem-ocr", action="store_true",
                    help="nao rodar OCR (rapido, so para PDFs 100%% digitais)")
    sp.add_argument("--ocr-tudo", action="store_true",
                    help="rodar OCR em todas as paginas, tenham imagem ou nao")
    sp.add_argument("--ocr-motor", choices=["auto", "rapidocr", "tesseract"],
                    default="auto", help="motor de OCR (padrao: auto)")
    sp.add_argument("--ocr-blocos", choices=["auto", "1", "2", "3"], default="auto",
                    help="repetir o OCR em NxN blocos para achar letra miuda "
                         "(auto = 2x2 em pagina densa; 1 = desliga; mais blocos "
                         "= mais lento e mais sensivel)")
    sp.add_argument("--ocr-linha-inteira", action="store_true",
                    help="tarjar a linha inteira do OCR (mais seguro, mais feio)")
    sp.add_argument("--ocr-confianca-min", type=float, default=0.30,
                    help="descartar linhas de OCR abaixo desta confianca")
    sp.add_argument("--area-min-imagem", type=float, default=0.01,
                    help="fracao da pagina a partir da qual a imagem justifica OCR")
    sp.add_argument("--barras-heuristica", action="store_true",
                    help="tarjar manchas com cara de codigo de barras mesmo sem "
                         "conseguir decodificar (util em foto/scan ruim)")
    sp.add_argument("--sem-rotulos", action="store_true",
                    help="nao usar o rotulo vizinho (CPF:/RG:) para achar o valor")
    sp.add_argument("--agressivo", action="store_true",
                    help="em scans ruins: tarja do gatilho (CPF, RG, e-mail...) "
                         "ate o fim da linha quando nada for reconhecido ali")
    sp.add_argument("--validar-cpf", action="store_true",
                    help="so tarjar CPF com digito verificador valido "
                         "(cuidado: OCR erra digito e o CPF escapa)")
    sp.add_argument("--termo", action="append",
                    help="texto literal extra para tarjar (pode repetir)")
    sp.add_argument("--termos-arquivo",
                    help="arquivo .txt com um termo por linha")
    sp.add_argument("--regex", action="append",
                    help="regex extra para tarjar (pode repetir)")
    sp.add_argument("--lista-branca",
                    help="arquivo .txt com trechos que NAO devem ser tarjados "
                         "(ex.: endereco do proprio orgao)")
    sp.add_argument("--ignorar", action="append",
                    help="ID de deteccao a ignorar (pode repetir)")
    sp.add_argument("--decisoes",
                    help=f"{NOME_REVISAO} com \"ignorar\": true nos itens a desfazer, "
                         "ou .txt com um ID por linha (IDs aparecem nos *_REVISAO.pdf)")
    sp.add_argument("--paginas",
                    help="restringir a paginas, ex.: 1-10,42,50-51")
    sp.add_argument("--mostrar-valores", action="store_true",
                    help=f"gravar o valor completo no {NOME_REVISAO} (padrao: mascarado). "
                         "Cuidado: o arquivo passa a conter dado pessoal")
    sp.add_argument("--manter-metadados", action="store_true",
                    help="nao limpar metadados/XMP do PDF de saida")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(
        prog=f"python {Path(sys.argv[0]).name}",
        description="Tarja automatica de dados pessoais em PDFs "
                    "(texto, imagens digitalizadas e QR Code).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(f"Exemplos (coloque os PDFs numa pasta, ex.: entrada/):\n"
                f"  python {Path(sys.argv[0]).name} aplicar entrada -o saida\n"
                f"  python {Path(sys.argv[0]).name} revisar entrada -o saida\n"
                f"  python {Path(sys.argv[0]).name} aplicar entrada -o saida "
                f"--decisoes saida/{NOME_REVISAO}\n"
                f"  python {Path(sys.argv[0]).name} auditar saida\n"))
    sub = ap.add_subparsers(dest="comando", required=True)

    sp1 = sub.add_parser("revisar", help="gera PDF de conferencia + relatorio (nao altera)")
    adicionar_opcoes_comuns(sp1)

    sp2 = sub.add_parser("aplicar", help="aplica a tarja de verdade (destrutiva)")
    adicionar_opcoes_comuns(sp2)

    sp3 = sub.add_parser("auditar", help="verifica se sobrou dado sensivel em um PDF")
    adicionar_opcoes_comuns(sp3)

    for fluxo in (sys.stdout, sys.stderr):
        try:
            fluxo.reconfigure(errors="replace")
        except Exception:  # noqa: BLE001
            pass
    a = ap.parse_args(argv)
    if a.comando == "auditar":
        return auditar(a)
    return executar(a, a.comando)


if __name__ == "__main__":
    raise SystemExit(main())
