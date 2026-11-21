# Tarjador

Tarja CPF, RG/CNH, e-mail, telefone, endereço, dados bancários, QR Code e
código de barras em PDFs, inclusive dentro de páginas digitalizadas (OCR).
A pessoa escolhe o que tarjar, envia os PDFs e baixa o tarjado. Nada fica
guardado: o original é apagado assim que é processado e o tarjado, em até
30 minutos.

- `redator.py`: o motor (detecção e tarja). Funciona sozinho, pela linha de comando.
- `api.py`: API Flask que liga a tela ao motor e serve o front compilado.
- `web/`: front React + TypeScript (Vite), com os componentes do `componentes-react-dafn`.

## Rodar no VS Code

### Primeira vez

1. **Arquivo > Abrir pasta...** e escolha esta pasta. Aceite as extensões
   recomendadas (Python, Python Debugger e ESLint).
2. **Python.** O projeto usa o ambiente `.venv` desta pasta. Se ele ainda não
   existir, no terminal do VS Code (`Ctrl+'`):

   ```bash
   python -m venv .venv
   .venv/Scripts/python -m pip install -r requirements.txt --ignore-requires-python
   ```

   As barras normais (`/`) funcionam no PowerShell e no Git Bash.

   Depois, `Ctrl+Shift+P` > **Python: Select Interpreter** > `.venv`.
   (O `--ignore-requires-python` é para o RapidOCR instalar no Python 3.13 ou mais novo.)
3. **Front.** `Ctrl+Shift+P` > **Tasks: Run Task** > **Instalar dependências (front)**
   (ou `cd web` e `npm install`). Precisa do Node 20 ou mais novo.

### Dia a dia

- `Ctrl+Shift+B` roda **Tarjador: API + front**: sobe a API (porta 5000) e o
  Vite (porta 5173) em dois terminais. Abra **http://localhost:5173**.
  O Vite recarrega a tela a cada alteração no `web/src` e repassa as chamadas
  `/api` para a API, então não há CORS nem `.env` para configurar.
- Alterou `api.py` ou `redator.py`? Pare a tarefa da API (lixeira do terminal)
  e rode `Ctrl+Shift+B` de novo.
- **Depurar** (`F5`, painel Executar e depurar):
  - **API (depurar)**: breakpoints em `api.py` e `redator.py`.
  - **Tarjador (API depurando + front)**: sobe o Vite, a API em depuração e
    abre o Chrome com breakpoints também no TypeScript.
  - **redator.py: aplicar em entrada/**: roda o motor sozinho nos PDFs da pasta
    `entrada/` e grava em `saida/`.
- Outras tarefas (**Tasks: Run Task**): **Front: lint**, **Front: build (gera web/dist)**.

## Docker (deploy)

A aplicação inteira roda num container: a imagem compila a tela e sobe a API
com o servidor de produção (Waitress). Não precisa de Node nem Python na máquina.

```bash
docker compose up -d --build     # abra http://localhost:8080
docker compose logs -f
docker compose down
```

Detalhes para a TI (variáveis, HTTPS, recursos, atualização):
[docs/wiki/Implantacao-com-Docker.md](docs/wiki/Implantacao-com-Docker.md).
A documentação completa do projeto está em [docs/wiki](docs/wiki/Home.md).

## Uso sem o VS Code

Quem só vai usar a ferramenta não precisa de Node, só do `web/dist` já compilado:

```bash
python api.py
```

e abra **http://127.0.0.1:5000**. A API só aceita conexões desta máquina.

## Onde está cada coisa

| Caminho | O que é |
|---|---|
| `redator.py` | padrões (regex e validadores), OCR, tarja em dois passos, limpeza de metadados |
| `api.py` | rotas `/api/...`, checklist "O que tarjar" (`CATALOGO`), fila de lotes e limpeza dos temporários |
| `web/src/pages/Home` | a tela: envio quando não há lote, conferência quando há |
| `web/src/components/Redator` | `PainelEnvio`, `ChecklistTipos`, `OpcaoChave`, `PainelRevisao`, `ArquivoRevisao`, `PendenciasArquivo`, `PaginaPreview` |
| `web/src/components/Cabecalho` | marca e troca de tema claro/escuro |
| `web/src/contexts/LotesContext` | envia os lotes, consulta o andamento a cada 1 s, aprovações, histórico e tarja à mão |
| `web/src/services/RedatorService` | chamadas à API e tipos do contrato |
| `web/src/ui` | componentes do design system (`componentes-react-dafn`) |

Os 3 erros do `npm run lint` em `ui/Datepicker`, `ui/Timepicker` e
`ui/DateTimePicker` vêm do template do design system; o Tarjador não usa esses componentes.

## Linha de comando

```bash
python redator.py aplicar entrada -o saida      # tarja os PDFs de entrada/
python redator.py revisar entrada -o saida      # só marca, para conferir antes
python redator.py auditar saida                 # confere se sobrou algo nos tarjados
```

`entrada/`, `saida/` e qualquer `.pdf` ficam fora do Git (`.gitignore`): têm dado pessoal.
