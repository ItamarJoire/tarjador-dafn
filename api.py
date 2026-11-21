#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
api.py - API local do Tarjador (Flask).

Liga o front-end React ao redator.py. Roda so em 127.0.0.1: nenhum outro
computador da rede consegue acessar, e nenhum PDF sai da maquina.

    python api.py                 # sobe em http://127.0.0.1:5000
    python api.py --porta 5050

Se a pasta web/dist existir (front ja compilado com `npm run build`), a propria
API serve a tela - ai basta abrir http://127.0.0.1:5000 no navegador.

Rotas:
    GET    /api/saude                               versao e motor de OCR
    GET    /api/tipos                               checklist "O que tarjar" (grupos e itens)
    POST   /api/lotes                               envia PDFs (multipart "arquivos";
                                                    "tipos" = ids do checklist separados
                                                    por virgula; sem o campo, usa o padrao)
    GET    /api/lotes/<id>                          progresso e revisao manual
    GET    /api/lotes/<id>/arquivos/<i>/tarjado     baixa o PDF tarjado
    GET    /api/lotes/<id>/arquivos/<i>/paginas/<n> imagem PNG da pagina tarjada
    POST   /api/lotes/<id>/arquivos/<i>/paginas/<n>/tarjas
                                                    tarjas desenhadas a mao (JSON
                                                    "retangulos": [{x0,y0,x1,y1}] em
                                                    proporcao da pagina, de 0 a 1)
    DELETE /api/lotes/<id>                          apaga os arquivos do lote; se ainda
                                                    estiver processando, cancela antes
"""

from __future__ import annotations

import argparse
import atexit
import contextlib
import os
import shutil
import sys
import tempfile
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

try:
    from flask import Flask, abort, jsonify, request, send_file, send_from_directory
    from werkzeug.utils import secure_filename
except ImportError:  # pragma: no cover
    sys.exit("Faltou o Flask. Rode:  pip install flask")

import pymupdf

import redator as R

RAIZ = Path(__file__).resolve().parent
WEB_DIST = RAIZ / "web" / "dist"
TEMPO_DE_VIDA_LOTE = 30 * 60             # 30 min: depois disso o lote e apagado
TAMANHO_MAXIMO = 500 * 1024 * 1024        # 500 MB por envio


# ---------------------------------------------------------------------------
# Checklist "O que tarjar"
# ---------------------------------------------------------------------------
# E o que o front mostra. Cada item liga um ou mais tipos do redator: marcar
# "CPF" tambem liga o cpf_parcial (CPF cortado pela borda do scan ou com
# digito comido pelo OCR), que sozinho nao faria sentido para o usuario.

CATALOGO: list[dict] = [
    {"id": "documentos", "rotulo": "Documentos pessoais",
     "descricao": "Identidade inclui CNH, PIS/PASEP, NIT, título de eleitor e matrícula.",
     "itens": [
         {"id": "cpf", "rotulo": "CPF", "tipos": ["cpf", "cpf_parcial"], "padrao": True},
         {"id": "rg", "rotulo": "RG, CNH e outras identidades", "tipos": ["rg"], "padrao": True},
     ]},
    {"id": "contato", "rotulo": "Contato",
     "descricao": "E-mail e telefone, fixo ou celular.",
     "itens": [
         {"id": "email", "rotulo": "E-mail", "tipos": ["email"], "padrao": True},
         {"id": "telefone", "rotulo": "Telefone", "tipos": ["telefone"], "padrao": True},
     ]},
    {"id": "localizacao", "rotulo": "Endereço",
     "descricao": "Logradouro, quadra, bairro, complemento e CEP.",
     "itens": [
         {"id": "endereco", "rotulo": "Endereço postal", "tipos": ["endereco"], "padrao": True},
         {"id": "cep", "rotulo": "CEP", "tipos": ["cep"], "padrao": True},
     ]},
    {"id": "bancarios", "rotulo": "Dados bancários",
     "descricao": "Número de cartão só é tarjado quando é válido.",
     "itens": [
         {"id": "agencia", "rotulo": "Agência", "tipos": ["agencia"], "padrao": True},
         {"id": "conta", "rotulo": "Conta", "tipos": ["conta"], "padrao": True},
         {"id": "cartao", "rotulo": "Cartão de pagamento", "tipos": ["cartao"], "padrao": True},
         {"id": "pix", "rotulo": "Chave PIX", "tipos": ["pix"], "padrao": True},
         {"id": "iban", "rotulo": "IBAN", "tipos": ["iban"], "padrao": True},
     ]},
    {"id": "codigos", "rotulo": "Códigos na imagem",
     "descricao": "Podem levar a CPF, nome ou ao próprio documento.",
     "itens": [
         {"id": "qrcode", "rotulo": "QR Code", "tipos": ["qrcode"], "padrao": True},
         {"id": "codigo_barras", "rotulo": "Código de barras", "tipos": ["codigo_barras"],
          "padrao": True},
     ]},
    {"id": "empresa", "rotulo": "Pessoa jurídica",
     "descricao": "CNPJ não é dado pessoal pela LGPD. Marque só se precisar esconder.",
     "itens": [
         {"id": "cnpj", "rotulo": "CNPJ", "tipos": ["cnpj"], "padrao": False},
     ]},
]
ITENS_CATALOGO: dict[str, dict] = {i["id"]: i for g in CATALOGO for i in g["itens"]}
ITENS_PADRAO: list[str] = [i for i, item in ITENS_CATALOGO.items() if item["padrao"]]

_tipos_sem_redator = {t for item in ITENS_CATALOGO.values() for t in item["tipos"]} - set(R.TODOS_TIPOS)
if _tipos_sem_redator:  # erro de digitacao no catalogo: melhor falhar ao subir
    raise RuntimeError(f"Catálogo cita tipo que o redator não conhece: {sorted(_tipos_sem_redator)}")


def catalogo_publico() -> dict:
    """O checklist como o front precisa: sem os tipos internos do redator."""
    return {"grupos": [
        {"id": g["id"], "rotulo": g["rotulo"], "descricao": g.get("descricao"),
         "itens": [{"id": i["id"], "rotulo": i["rotulo"], "padrao": i["padrao"]}
                   for i in g["itens"]]}
        for g in CATALOGO
    ]}


# ---------------------------------------------------------------------------
# Estado em memoria
# ---------------------------------------------------------------------------


@dataclass
class Arquivo:
    indice: int
    nome: str
    original: Path
    estado: str = "na_fila"            # na_fila | processando | concluido | erro
    paginas_total: int = 0
    paginas_feitas: int = 0
    tarjas_aplicadas: int = 0
    tarjas_manuais: int = 0            # desenhadas pela pessoa na visualização da página
    versao: int = 0                    # muda a cada tarja manual: o front troca a imagem em cache
    revisao: Optional[dict] = None
    tarjado: Optional[Path] = None
    erro: Optional[str] = None


@dataclass
class Lote:
    id: str
    pasta: Path
    arquivos: list[Arquivo]
    agressivo: bool = False
    sem_ocr: bool = False
    itens: list[str] = field(default_factory=lambda: list(ITENS_PADRAO))  # ids do checklist
    tipos: set[str] = field(default_factory=set)          # tipos do redator que eles ligam
    ignorados: list[str] = field(default_factory=list)   # enviados que nao eram PDF
    estado: str = "na_fila"            # na_fila | processando | concluido | cancelado
    criado_em: float = field(default_factory=time.time)
    concluido_em: Optional[float] = None   # o prazo de 30 min conta daqui
    cancelar: threading.Event = field(default_factory=threading.Event)


LOTES: dict[str, Lote] = {}
TRAVA = threading.Lock()
PASTA_BASE: Optional[Path] = None

# Fila: um ARQUIVO por vez (o paralelismo fica dentro do redator, paginas em
# paralelo), escolhido entre todos os lotes pendentes: o de menos paginas
# primeiro. Assim um lote pequeno espera no maximo o arquivo em andamento, e
# nao o lote grande inteiro. Para o grande nao esperar para sempre, cada minuto
# na fila conta como PESO_DA_ESPERA paginas a menos.
PESO_DA_ESPERA = 10
ATIVOS: list[Lote] = []                  # lotes com arquivo por tarjar ou por limpar
SINAL = threading.Condition(TRAVA)       # acorda o agendador (lote novo ou cancelado)


# ---------------------------------------------------------------------------
# Processamento
# ---------------------------------------------------------------------------


def apagar_pasta(pasta: Path, tentativas: int = 20, espera: float = 0.25) -> bool:
    """Apaga a pasta do lote, insistindo enquanto o Windows segura algum arquivo.

    Depois de um cancelamento, os processos de OCR acabaram de ser mortos e o
    sistema leva um instante para liberar os PDFs que eles tinham abertos;
    antivirus e indexador tambem travam arquivo recem-escrito. Como a pasta
    tem dado pessoal, desistir na primeira falha nao serve.
    """
    for _ in range(tentativas):
        shutil.rmtree(pasta, ignore_errors=True)
        if not pasta.exists():
            return True
        time.sleep(espera)
    print(f"AVISO: nao consegui apagar {pasta}; sera apagada ao encerrar a API.", flush=True)
    return False


def _prioridade(lote: Lote, arq: Arquivo, agora: float) -> tuple:
    """Menor primeiro: paginas do arquivo, descontada a espera do lote."""
    espera_min = (agora - lote.criado_em) / 60
    return (arq.paginas_total - PESO_DA_ESPERA * espera_min, lote.criado_em, arq.indice)


def _proximo_arquivo() -> Optional[tuple[Lote, Arquivo]]:
    """Escolhe e marca o proximo arquivo a tarjar. Chamar com a TRAVA."""
    agora = time.time()
    pendentes = [(lote, arq) for lote in ATIVOS if not lote.cancelar.is_set()
                 for arq in lote.arquivos if arq.estado == "na_fila"]
    if not pendentes:
        return None
    lote, arq = min(pendentes, key=lambda par: _prioridade(par[0], par[1], agora))
    lote.estado = "processando"
    arq.estado = "processando"
    return lote, arq


def _lotes_terminados() -> list[Lote]:
    """Tira de ATIVOS os lotes cancelados ou sem arquivo pendente. Chamar com a
    TRAVA. Como o agendador tarja um arquivo por vez e so chama isto entre um e
    outro, nenhum desses lotes tem arquivo em andamento."""
    terminados = [lote for lote in ATIVOS if lote.cancelar.is_set()
                  or all(a.estado in ("concluido", "erro") for a in lote.arquivos)]
    for lote in terminados:
        ATIVOS.remove(lote)
    return terminados


def agendador() -> None:
    """Thread unica que tarja os arquivos, um por vez, na ordem de _prioridade."""
    while True:
        with SINAL:
            terminados = _lotes_terminados()
            trabalho = None if terminados else _proximo_arquivo()
            while not terminados and trabalho is None:
                SINAL.wait()
                terminados = _lotes_terminados()
                trabalho = None if terminados else _proximo_arquivo()
        for lote in terminados:
            _encerrar_lote(lote)
        if trabalho:
            _processar_arquivo(*trabalho)


def _encerrar_lote(lote: Lote) -> None:
    """Marca o fim do lote. Se foi cancelado, apaga tudo (originais e tarjados).

    Estado e cancelamento sao lidos sob a TRAVA, a mesma do DELETE: ou o DELETE
    ve o lote concluido e apaga a pasta, ou este ve o pedido de cancelamento e
    apaga. Nunca os dois deixam a pasta para tras.
    """
    with TRAVA:
        cancelado = lote.cancelar.is_set()
        lote.estado = "cancelado" if cancelado else "concluido"
        lote.concluido_em = time.time()
    if cancelado:
        apagar_pasta(lote.pasta)


def _processar_arquivo(lote: Lote, arq: Arquivo) -> None:
    """Tarja um arquivo. Cancelado no meio, para na hora (os processos de OCR
    sao mortos) e o agendador apaga o lote em seguida."""
    cfg = R.Config(tipos=set(lote.tipos), ocr=not lote.sem_ocr,
                   agressivo=lote.agressivo)
    processos = R.definir_paralelismo(cfg)
    try:
        if cfg.ocr:
            try:
                R.obter_motor_ocr(cfg.motor_ocr, cfg.threads_ocr)
            except RuntimeError as e:
                raise RuntimeError(str(e).splitlines()[0]
                                   + " (pip install rapidocr-onnxruntime)") from None
        with pymupdf.open(arq.original) as doc:
            arq.paginas_total = doc.page_count

        def progresso(feitas: int, total: int, alvo: Arquivo = arq) -> None:
            alvo.paginas_feitas, alvo.paginas_total = feitas, total

        dets, avisos = R.analisar_pdf(arq.original, cfg, processos,
                                      ao_progredir=progresso,
                                      deve_parar=lote.cancelar.is_set)
        destino = lote.pasta / f"{arq.indice}_{Path(secure_filename(arq.nome) or 'arquivo').stem}_TARJADO.pdf"
        R.aplicar_tarjas(arq.original, destino, dets, limpar_metadados=True,
                         margem_texto=cfg.margem_texto)

        registro = {"arquivo": arq.nome, "dets": [d.como_dict() for d in dets],
                    "avisos": avisos, "destino": str(destino)}
        arq.revisao = R.revisao_do_arquivo(registro)
        arq.tarjas_aplicadas = len(dets)
        arq.tarjado = destino
        arq.paginas_feitas = arq.paginas_total
        arq.estado = "concluido"
    except R.Cancelado:
        pass
    except Exception as e:  # noqa: BLE001
        arq.estado = "erro"
        arq.erro = f"{type(e).__name__}: {e}"
    finally:
        # o original tem dado pessoal: sai do disco assim que nao e mais util.
        # Se o arquivo estiver travado, a pasta inteira e apagada depois.
        with contextlib.suppress(OSError):
            arq.original.unlink(missing_ok=True)


def limpar_lotes_antigos() -> None:
    agora = time.time()
    with TRAVA:
        # conta a partir de quando ficou pronto: um PDF grande pode levar mais
        # de 30 min so para processar, e o tarjado nao pode sumir ao terminar
        velhos = [i for i, l in LOTES.items()
                  if l.estado == "concluido" and l.concluido_em is not None
                  and agora - l.concluido_em > TEMPO_DE_VIDA_LOTE]
        for i in velhos:
            shutil.rmtree(LOTES.pop(i).pasta, ignore_errors=True)


def serializar(lote: Lote) -> dict:
    arquivos = []
    for a in lote.arquivos:
        rev = a.revisao or {}
        arquivos.append({
            "indice": a.indice,
            "nome": a.nome,
            "estado": a.estado,
            "paginasTotal": a.paginas_total,
            "paginasFeitas": a.paginas_feitas,
            "tarjasAplicadas": a.tarjas_aplicadas,
            "tarjasManuais": a.tarjas_manuais,
            "versao": a.versao,
            "avisosDoArquivo": rev.get("avisos_do_arquivo", []),
            "paginasParaConferir": rev.get("paginas_para_conferir", []),
            "tarjasParaConferir": [
                {k: t[k] for k in ("id", "pagina", "tipo", "valor", "motivo")}
                for t in rev.get("tarjas_para_conferir", [])
            ],
            "erro": a.erro,
        })
    return {"id": lote.id, "estado": lote.estado, "arquivos": arquivos,
            "tipos": lote.itens, "ignorados": lote.ignorados}


# ---------------------------------------------------------------------------
# Rotas
# ---------------------------------------------------------------------------

app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = TAMANHO_MAXIMO


def _lote_ou_404(id_lote: str) -> Lote:
    lote = LOTES.get(id_lote)
    if lote is None:
        abort(404, description="Lote não encontrado (pode ter expirado).")
    return lote


def _itens_pedidos(campo: Optional[str]) -> list[str]:
    """Valida o checklist enviado pelo front.

    Campo ausente (cliente antigo, curl) = checklist padrao. Campo presente e
    vazio = o usuario desmarcou tudo, e isso e erro: tarjar "nada" em silencio
    entregaria o PDF com todos os dados.
    """
    if campo is None:
        return list(ITENS_PADRAO)
    pedidos = {p.strip() for p in campo.split(",") if p.strip()}
    if not pedidos:
        abort(400, description="Marque ao menos um tipo de dado para tarjar.")
    desconhecidos = sorted(pedidos - ITENS_CATALOGO.keys())
    if desconhecidos:
        abort(400, description=f"Tipo de dado desconhecido: {', '.join(desconhecidos)}.")
    return [i for i in ITENS_CATALOGO if i in pedidos]   # na ordem do catalogo


def _arquivo_concluido(lote: Lote, indice: int) -> Arquivo:
    if not 0 <= indice < len(lote.arquivos):
        abort(404, description="Arquivo não encontrado no lote.")
    arq = lote.arquivos[indice]
    if arq.estado != "concluido" or not arq.tarjado or not arq.tarjado.exists():
        abort(409, description="Arquivo ainda não foi processado.")
    return arq


@app.errorhandler(400)
@app.errorhandler(404)
@app.errorhandler(409)
@app.errorhandler(413)
def _erro_json(e):
    mensagem = getattr(e, "description", str(e))
    if getattr(e, "code", 500) == 413:
        mensagem = f"Envio maior que {TAMANHO_MAXIMO // (1024 * 1024)} MB."
    return jsonify({"erro": mensagem}), getattr(e, "code", 500)


@app.get("/api/saude")
def saude():
    try:
        _, motor = R.obter_motor_ocr("auto")
    except RuntimeError:
        motor = None
    # "cancelamento": o front usa para avisar quando a API em execucao e de uma
    # versao anterior (que recusa cancelar lote em andamento) e precisa reiniciar
    return jsonify({"ok": True, "versao": R.VERSAO, "motorOcr": motor, "cancelamento": True})


@app.get("/api/tipos")
def tipos():
    return jsonify(catalogo_publico())


@app.post("/api/lotes")
def criar_lote():
    limpar_lotes_antigos()
    enviados = request.files.getlist("arquivos")
    if not enviados:
        abort(400, description="Nenhum arquivo enviado.")
    # valida antes de gravar qualquer arquivo no disco
    itens = _itens_pedidos(request.form.get("tipos"))
    tipos_redator = {t for i in itens for t in ITENS_CATALOGO[i]["tipos"]}

    id_lote = uuid.uuid4().hex[:12]
    pasta = PASTA_BASE / id_lote
    pasta.mkdir(parents=True)

    arquivos: list[Arquivo] = []
    ignorados: list[str] = []
    for arquivo in enviados:
        nome = Path(arquivo.filename or "arquivo.pdf").name
        cabecalho = arquivo.stream.read(5)
        arquivo.stream.seek(0)
        if not nome.lower().endswith(".pdf") or cabecalho != b"%PDF-":
            ignorados.append(nome)
            continue
        indice = len(arquivos)
        disco = pasta / f"{indice}_{secure_filename(nome) or 'arquivo.pdf'}"
        arquivo.save(disco)
        # paginas ja na chegada: e o que ordena a fila (menor primeiro) e o
        # front mostra o total antes de o arquivo comecar
        try:
            with pymupdf.open(disco) as doc:
                paginas = doc.page_count
        except Exception:  # noqa: BLE001 - PDF quebrado: vai para a vez dele e da erro la
            paginas = 0
        arquivos.append(Arquivo(indice=indice, nome=nome, original=disco, paginas_total=paginas))

    if not arquivos:
        shutil.rmtree(pasta, ignore_errors=True)
        abort(400, description="Nenhum dos arquivos enviados é um PDF válido.")

    lote = Lote(id=id_lote, pasta=pasta, arquivos=arquivos,
                agressivo=request.form.get("agressivo") == "true",
                sem_ocr=request.form.get("semOcr") == "true",
                itens=itens, tipos=tipos_redator,
                ignorados=ignorados)
    with SINAL:
        LOTES[id_lote] = lote
        ATIVOS.append(lote)
        SINAL.notify()
    return jsonify(serializar(lote)), 202


@app.get("/api/lotes/<id_lote>")
def ver_lote(id_lote: str):
    return jsonify(serializar(_lote_ou_404(id_lote)))


@app.get("/api/lotes/<id_lote>/arquivos/<int:indice>/tarjado")
def baixar_tarjado(id_lote: str, indice: int):
    arq = _arquivo_concluido(_lote_ou_404(id_lote), indice)
    return send_file(arq.tarjado, mimetype="application/pdf", as_attachment=True,
                     download_name=f"{Path(arq.nome).stem}_TARJADO.pdf")


@app.get("/api/lotes/<id_lote>/arquivos/<int:indice>/paginas/<int:pagina>")
def ver_pagina(id_lote: str, indice: int, pagina: int):
    """Imagem da pagina JA TARJADA - nunca do original."""
    arq = _arquivo_concluido(_lote_ou_404(id_lote), indice)
    largura = min(max(request.args.get("largura", 1100, type=int), 300), 2400)
    with pymupdf.open(arq.tarjado) as doc:
        if not 1 <= pagina <= doc.page_count:
            abort(404, description="Página fora do documento.")
        page = doc[pagina - 1]
        zoom = largura / max(page.rect.width, 1)
        png = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False).tobytes("png")
    from io import BytesIO
    resposta = send_file(BytesIO(png), mimetype="image/png")
    resposta.headers["Cache-Control"] = "private, max-age=600"
    return resposta


MAXIMO_TARJAS_MANUAIS = 200
TRAVA_EDICAO = threading.Lock()   # uma tarja manual por vez (regrava o PDF inteiro)


def _retangulos_pedidos(brutos) -> list[tuple[float, float, float, float]]:
    """Valida os retângulos do front: proporções da página (0 a 1), como a
    pessoa os vê na imagem. Fora da página é cortado; risco minúsculo (um
    clique sem arrastar) é ignorado."""
    if not isinstance(brutos, list) or not brutos:
        abort(400, description="Desenhe ao menos uma tarja na página.")
    if len(brutos) > MAXIMO_TARJAS_MANUAIS:
        abort(400, description=f"No máximo {MAXIMO_TARJAS_MANUAIS} tarjas por vez.")
    retangulos = []
    for bruto in brutos:
        try:
            x0, y0, x1, y1 = (min(max(float(bruto[k]), 0.0), 1.0) for k in ("x0", "y0", "x1", "y1"))
        except (TypeError, KeyError, ValueError):
            abort(400, description="Tarja inválida.")
        x0, x1 = sorted((x0, x1))
        y0, y1 = sorted((y0, y1))
        if x1 - x0 >= 0.002 and y1 - y0 >= 0.002:
            retangulos.append((x0, y0, x1, y1))
    if not retangulos:
        abort(400, description="As tarjas desenhadas são pequenas demais.")
    return retangulos


def _substituir_arquivo(novo: Path, destino: Path, tentativas: int = 20) -> None:
    """Troca o PDF tarjado pela versão nova. No Windows, um download em
    andamento segura o arquivo: insiste um pouco antes de desistir."""
    for _ in range(tentativas):
        try:
            os.replace(novo, destino)
            return
        except PermissionError:
            time.sleep(0.25)
    novo.unlink(missing_ok=True)
    abort(409, description="O PDF está em uso (um download em andamento?). Tente de novo em instantes.")


@app.post("/api/lotes/<id_lote>/arquivos/<int:indice>/paginas/<int:pagina>/tarjas")
def tarjar_pagina(id_lote: str, indice: int, pagina: int):
    """Tarjas desenhadas pela pessoa na visualização da página, para o que o
    tarjamento automático não cobriu (ou cobriu só em parte).

    Mesmo método destrutivo das automáticas: o texto sob a tarja é apagado,
    os pixels da imagem zerados e o desenho coberto removido. Não dá para
    desfazer: o PDF é regravado sem o que estava embaixo.
    """
    lote = _lote_ou_404(id_lote)
    arq = _arquivo_concluido(lote, indice)
    retangulos = _retangulos_pedidos((request.get_json(silent=True) or {}).get("retangulos"))

    with TRAVA_EDICAO:
        novo = arq.tarjado.with_name(f"{arq.tarjado.stem}.editando.pdf")
        with pymupdf.open(arq.tarjado) as doc:
            if not 1 <= pagina <= doc.page_count:
                abort(404, description="Página fora do documento.")
            page = doc[pagina - 1]
            # As proporções valem para a página como aparece (page.rect, já
            # girada, igual à imagem); a tarja é gravada nas coordenadas sem giro
            area = page.rect
            for x0, y0, x1, y1 in retangulos:
                visivel = pymupdf.Rect(area.x0 + x0 * area.width, area.y0 + y0 * area.height,
                                       area.x0 + x1 * area.width, area.y0 + y1 * area.height)
                alvo = visivel * page.derotation_matrix
                alvo.normalize()
                page.add_redact_annot(alvo, fill=(0, 0, 0))
            page.apply_redactions(
                images=pymupdf.PDF_REDACT_IMAGE_PIXELS,
                graphics=getattr(pymupdf, "PDF_REDACT_LINE_ART_REMOVE_IF_COVERED", 1),
                text=getattr(pymupdf, "PDF_REDACT_TEXT_REMOVE", 0),
            )
            doc.save(novo, garbage=4, deflate=True, clean=True)
        _substituir_arquivo(novo, arq.tarjado)
        arq.tarjas_aplicadas += len(retangulos)
        arq.tarjas_manuais += len(retangulos)
        arq.versao += 1

    return jsonify(serializar(lote))


@app.delete("/api/lotes/<id_lote>")
def apagar_lote(id_lote: str):
    """Apaga o lote. Se ainda estiver na fila ou processando, cancela: os
    processos de OCR sao encerrados e o agendador apaga a pasta ao parar."""
    lote = _lote_ou_404(id_lote)
    with SINAL:
        LOTES.pop(id_lote, None)
        em_andamento = lote.estado != "concluido"
        # Nenhum arquivo deste lote rodando agora (so na fila, ou entre um
        # arquivo e outro): sai da fila e e apagado ja, sem esperar o arquivo de
        # outro lote terminar. Rodando: o agendador mata o OCR e apaga ao parar.
        # O agendador so marca arquivo como "processando" com esta mesma trava.
        rodando = any(a.estado == "processando" for a in lote.arquivos)
        if em_andamento:
            lote.cancelar.set()
            if not rodando and lote in ATIVOS:
                ATIVOS.remove(lote)
                lote.estado = "cancelado"
                lote.concluido_em = time.time()
            SINAL.notify()
    if not em_andamento or not rodando:
        apagar_pasta(lote.pasta)
    return "", 204


# Front compilado (web/dist), quando existir
@app.get("/")
@app.get("/<path:caminho>")
def front(caminho: str = ""):
    if caminho.startswith("api/"):
        abort(404, description="Rota não encontrada.")
    if not WEB_DIST.exists():
        return ("<h3>API do Tarjador no ar.</h3><p>O front ainda não foi compilado. "
                "Em desenvolvimento, rode <code>npm run dev</code> na pasta web e abra "
                "<a href='http://localhost:5173'>http://localhost:5173</a>.</p>"), 200
    alvo = WEB_DIST / caminho
    if caminho and alvo.is_file():
        return send_from_directory(WEB_DIST, caminho)
    return send_from_directory(WEB_DIST, "index.html")


# ---------------------------------------------------------------------------


def main() -> None:
    global PASTA_BASE
    ap = argparse.ArgumentParser(description="API local do Tarjador")
    ap.add_argument("--porta", type=int, default=5000)
    a = ap.parse_args()

    PASTA_BASE = Path(tempfile.mkdtemp(prefix="redator_lgpd_"))
    atexit.register(shutil.rmtree, PASTA_BASE, ignore_errors=True)
    threading.Thread(target=agendador, name="agendador", daemon=True).start()

    print(f"Tarjador {R.VERSAO} - API em http://127.0.0.1:{a.porta}")
    if WEB_DIST.exists():
        print(f"Abra http://127.0.0.1:{a.porta} no navegador.")
    else:
        print("Front nao compilado: rode 'npm run dev' na pasta web e abra http://localhost:5173")
    print("Ctrl+C encerra (os arquivos temporarios sao apagados).", flush=True)
    app.run(host="127.0.0.1", port=a.porta, threaded=True, debug=False, use_reloader=False)


if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support()
    main()
