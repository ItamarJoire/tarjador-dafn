# Referência da API

API HTTP em Flask (`api.py`). Todas as rotas ficam sob `/api`; as demais servem a tela compilada (`web/dist`). Erros voltam como JSON `{ "erro": "mensagem em português" }`.

Hoje a API escuta só em `127.0.0.1` (porta 5000 por padrão, ou `--porta`). Ver [Implantação na intranet](Implantacao-na-intranet.md).

## Rotas

| Método | Rota | O que faz | Resposta |
|---|---|---|---|
| GET | `/api/saude` | Versão do motor e OCR disponível | `{ ok, versao, motorOcr, cancelamento }` |
| GET | `/api/tipos` | Checklist "O que tarjar" | `{ grupos: [{ id, rotulo, descricao, itens: [{ id, rotulo, padrao }] }] }` |
| POST | `/api/lotes` | Envia PDFs e cria um lote | 202 + lote |
| GET | `/api/lotes/<id>` | Andamento e conferência do lote | lote |
| GET | `/api/lotes/<id>/arquivos/<i>/tarjado` | Baixa o PDF tarjado | `application/pdf`, `<nome>_TARJADO.pdf` |
| GET | `/api/lotes/<id>/arquivos/<i>/paginas/<n>?largura=1100` | Imagem PNG da página **tarjada** (300 a 2400 px de largura) | `image/png` |
| POST | `/api/lotes/<id>/arquivos/<i>/paginas/<n>/tarjas` | Aplica tarjas desenhadas à mão | lote |
| DELETE | `/api/lotes/<id>` | Apaga o lote; se estiver na fila ou processando, cancela antes | 204 |

`<i>` é o índice do arquivo no lote (0, 1, 2...) e `<n>` é o número da página (a partir de 1).

## POST /api/lotes

`multipart/form-data`:

| Campo | Obrigatório | Valor |
|---|---|---|
| `arquivos` | sim | Um ou mais PDFs (o campo se repete) |
| `tipos` | não | Ids do checklist separados por vírgula (`cpf,rg,email`). Sem o campo, usa os marcados por padrão. Presente e vazio é erro. |
| `agressivo` | não | `true` liga o Scan de baixa qualidade |
| `semOcr` | não | `true` pula o OCR |

Arquivos que não são PDF (pela extensão e pela assinatura `%PDF-`) ficam de fora e voltam em `ignorados`. Limite: 500 MB por envio.

```bash
curl -F arquivos=@contrato.pdf -F tipos=cpf,email http://127.0.0.1:5000/api/lotes
```

## O lote

```json
{
  "id": "ae4666f05374",
  "estado": "concluido",
  "tipos": ["cpf", "email"],
  "ignorados": [],
  "arquivos": [
    {
      "indice": 0,
      "nome": "contrato.pdf",
      "estado": "concluido",
      "paginasTotal": 2,
      "paginasFeitas": 2,
      "tarjasAplicadas": 3,
      "tarjasManuais": 1,
      "versao": 1,
      "avisosDoArquivo": [],
      "paginasParaConferir": [{ "pagina": 2, "motivo": "a página menciona CPF 3x e ..." }],
      "tarjasParaConferir": [{ "id": "...", "pagina": 1, "tipo": "CPF (parcial/cortado)", "valor": "(mascarado)", "motivo": "CPF incompleto ..." }],
      "erro": null
    }
  ]
}
```

- `estado` do lote: `na_fila`, `processando`, `concluido` ou `cancelado`.
- `estado` do arquivo: `na_fila`, `processando`, `concluido` ou `erro` (com `erro` preenchido).
- `versao` aumenta a cada tarja à mão; serve para buscar a imagem nova da página.
- Em `tarjasParaConferir`, `tipo` é o rótulo legível e o `valor` vem **mascarado**: a API nunca devolve o dado inteiro.
- `paginasParaConferir` traz o motivo de cada página; `avisosDoArquivo`, o que vale para o arquivo inteiro (anexos embutidos, marcadores).

## POST .../paginas/<n>/tarjas

JSON com os retângulos em **proporção da página como ela aparece** (0 a 1, origem no canto superior esquerdo):

```json
{ "retangulos": [{ "x0": 0.24, "y0": 0.22, "x1": 0.31, "y1": 0.24 }] }
```

- Até 200 retângulos por vez. Valores fora de 0 a 1 são cortados; retângulos menores que 0,2% da página são ignorados.
- Só funciona em arquivo concluído. O apagamento é definitivo.

## Erros

| Código | Quando |
|---|---|
| 400 | Nenhum arquivo, nenhum PDF válido, checklist vazio ou com tipo desconhecido, tarja inválida |
| 404 | Lote, arquivo ou página não existe (o lote pode ter expirado) |
| 409 | Arquivo ainda não processado, ou PDF em uso durante a tarja à mão (tente de novo) |
| 413 | Envio maior que 500 MB |
