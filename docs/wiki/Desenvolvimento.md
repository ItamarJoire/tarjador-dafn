# Desenvolvimento

O passo a passo detalhado no VS Code está no [README](../../README.md). Aqui vai o resumo, mais o que não cabe lá.

## Pré-requisitos

- **Python 3.10 ou mais novo** (testado até o 3.14)
- **Node 20 ou mais novo** (só para desenvolver a tela)
- VS Code com as extensões recomendadas pelo projeto (Python, Python Debugger, ESLint)

## Instalar

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt --ignore-requires-python
cd web && npm install
```

O `--ignore-requires-python` é necessário porque o RapidOCR declara suporte só até o Python 3.12. Sem ele, o pip instala em silêncio uma versão antiga, de 2022.

## Rodar

| Como | O que sobe | Endereço |
|---|---|---|
| `Ctrl+Shift+B` no VS Code (tarefa **Tarjador: API + front**) | API (5000) e Vite (5173), em dois terminais | http://localhost:5173 |
| `python api.py` e, noutro terminal, `cd web && npm run dev` | O mesmo, à mão | http://localhost:5173 |
| `cd web && npm run build` e depois `python api.py` | Só a API, servindo a tela compilada (`web/dist`) | http://127.0.0.1:5000 |

- O Vite recarrega a tela a cada alteração em `web/src` e repassa `/api` para a API: não há CORS nem `.env` para configurar.
- Alterou `api.py` ou `redator.py`? Reinicie a API.
- `python api.py --porta 5050` sobe noutra porta (o proxy do Vite aponta para a 5000).
- `python api.py --help` lista as opções (endereço, porta, pasta temporária, modo produção) e as variáveis de ambiente equivalentes.

### Com Docker

Para testar como vai rodar no servidor:

```bash
docker compose up -d --build     # http://localhost:8080
docker compose logs -f
docker compose down
```

A imagem compila a tela sozinha; não precisa de Node nem Python na máquina. Ver [Implantação com Docker](Implantacao-com-Docker.md).

## Depurar (F5)

| Configuração | Para quê |
|---|---|
| **API (depurar)** | Breakpoints em `api.py` e `redator.py` |
| **Tarjador (API depurando + front)** | Vite, API em depuração e Chrome com breakpoints também no TypeScript |
| **redator.py: aplicar em entrada/** | Roda o motor sozinho nos PDFs de `entrada/` e grava em `saida/` |
| **Front no Chrome** | Só a tela, com breakpoints no TypeScript |

## Verificar antes de subir

```bash
cd web
npx tsc -b        # tipos: deve terminar sem erro
npm run lint      # só os 3 erros antigos dos pickers do design system
npm run build     # tsc + build de produção em web/dist
```

Não há testes automatizados no repositório. As mudanças foram verificadas com PDFs de teste gerados na hora e com o navegador controlado por script. Ver [Limitações](Limitacoes-e-proximos-passos.md).

**Nunca suba PDF para o repositório.** `entrada/`, `saida/`, `*.pdf` e `.env` estão no `.gitignore`, porque têm dado pessoal.

## Linha de comando

O motor funciona sem a API e sem a tela, útil para lotes grandes, auditoria e ajustes finos:

```bash
python redator.py revisar entrada -o saida    # só marca: gera *_REVISAO.pdf e revisao_manual.json
python redator.py aplicar entrada -o saida    # tarja de verdade
python redator.py auditar saida               # reabre os tarjados e procura resíduos
```

Fluxo em dois passos: `revisar`, conferir os `*_REVISAO.pdf`, marcar `"ignorar": true` no `revisao_manual.json` no que não devia ser tarjado e então `aplicar ... --decisoes saida/revisao_manual.json`.

Opções que a tela não oferece:

| Opção | O que faz |
|---|---|
| `--tipos cpf,email` / `--sem endereco` | Liga só alguns tipos / desliga alguns |
| `--termo "texto"`, `--termos-arquivo lista.txt` | Tarja textos literais extras |
| `--regex "..."` | Tarja um padrão extra |
| `--lista-branca lista.txt` | Trechos que **não** devem ser tarjados (ex.: endereço do próprio órgão) |
| `--paginas 1-10,42` | Só algumas páginas |
| `--dpi 400` | OCR em resolução maior, para scan ruim |
| `--ocr-tudo` | OCR em todas as páginas, com ou sem imagem |
| `--ocr-linha-inteira` | Tarja a linha inteira lida pelo OCR (mais seguro, mais feio) |
| `--barras-heuristica` | Tarja manchas com cara de código de barras mesmo sem decodificar |
| `--validar-cpf` | Só tarja CPF com dígito válido (cuidado: o OCR erra dígito e o CPF escapa) |
| `--ocr-motor tesseract` | Usa o Tesseract, se instalado, no lugar do RapidOCR |
| `-j 2` | Número de processos em paralelo |
| `--mostrar-valores` | Grava o valor completo no `revisao_manual.json` (o arquivo passa a ter dado pessoal) |
| `--manter-metadados` | Não limpa os metadados |

`python redator.py aplicar --help` lista todas.

## Onde mexer para...

| Quero... | Onde |
|---|---|
| Mudar ou criar um padrão de detecção | `PADROES` em `redator.py` (regex, validador, prioridade) |
| Incluir um tipo no checklist da tela | `CATALOGO` em `api.py` (cita os tipos do `redator.py`) |
| Mudar o motivo de uma conferência | `motivo_para_conferir` e `_avisos_de_cobertura` em `redator.py` |
| Mudar o prazo ou o limite de envio | `TEMPO_DE_VIDA_LOTE` e `TAMANHO_MAXIMO` em `api.py` |
| Mudar a equipe responsável | `EQUIPE` em `web/src/services/ambiente.ts` |
| Mudar perguntas frequentes | `web/src/components/Faq/perguntas.tsx` |
| Mudar o fluxograma | `web/src/components/Fluxo/diagramas.ts` (posições em pixels, por centro) |
| Mudar passos do tutorial | `web/src/components/Tutorial/passos.tsx` |
| Mudar o contrato da API | `api.py` (`serializar`) e `web/src/services/RedatorService/types.ts`, sempre juntos |
