# Segurança e privacidade

## Onde os dados passam

| Dado | Onde fica | Por quanto tempo |
|---|---|---|
| PDF original | Pasta temporária da API | Apagado assim que o arquivo é processado (com ou sem erro) |
| PDF tarjado | Pasta temporária da API | Até ser baixado e concluído, o lote ser apagado ou cancelado, ou expirar (30 min depois de pronto; verificado a cada minuto) |
| Imagens das páginas na conferência | Geradas na hora a partir do **tarjado**, nunca do original; o navegador guarda em cache por até 10 minutos | — |
| Estado dos lotes | Memória da API | Até expirar ou a API ser encerrada |
| Pasta temporária inteira | `%TEMP%\redator_lgpd_*` | Apagada ao encerrar a API normalmente (Ctrl+C ou `docker stop`); no Docker fica em `/tmp/tarjador`, dentro do container, e some também com ele |
| Histórico de concluídos | `localStorage` do navegador: nome do arquivo, páginas, número de tarjas e tipos | Até "Limpar lista" |

Não há banco de dados, log com conteúdo de documento nem cópia em outro lugar. A API nunca devolve o valor inteiro de um dado encontrado: na conferência ele vem mascarado.

**Atenção ao nome do arquivo.** Ele aparece no histórico do navegador e no nome do PDF baixado. Se o nome tiver dado pessoal ("CPF 123.456.789-09.pdf"), renomeie antes de enviar.

## Proteções da API

- **Sem conexão para fora.** Nenhuma parte do Tarjador chama serviço externo. O ONNX Runtime (motor do OCR) traz um coletor de telemetria da Microsoft; ele é desligado no início do `redator.py` (`ORT_DISABLE_TELEMETRY=1` e `disable_telemetry_events()`) e na imagem Docker.
- **Endereço em que escuta:** só a própria máquina (`127.0.0.1`) por padrão; no Docker, todas as interfaces do container, com o servidor web do órgão na frente.
- **Só PDF:** confere a extensão e a assinatura `%PDF-` antes de gravar. Os nomes são saneados (`secure_filename`).
- **Limite de 500 MB** por envio.
- **Checklist validado:** um checklist vazio é recusado, para não entregar um PDF "tarjado" sem nenhuma tarja.
- **Ids de lote aleatórios** (12 caracteres de um UUID); não há rota que liste lotes. Não há login: quem tiver o id de um lote consegue acessá-lo enquanto ele existir.
- **Cancelar apaga tudo,** inclusive o que já tinha sido tarjado no lote.
- A pasta temporária é apagada com várias tentativas: no Windows, antivírus e indexador seguram arquivos recém-escritos.

## Proteções da tela

- O pdf.js (contagem de páginas) precisa estar na versão 6.2.108 ou mais nova: as anteriores executavam JavaScript embutido em PDF malicioso. O projeto usa a 6.5.
- O PDF é aberto no navegador só para contar páginas; nada é renderizado nem executado.
- Os ids dos lotes ficam no `sessionStorage` e somem ao fechar a aba.

## O que a tarja não alcança

O Tarjador avisa quando encontra estes casos, mas não os resolve:

- **Arquivos anexados dentro do PDF** (anexos embutidos): a tarja não entra neles.
- **Marcadores (sumário):** não são conteúdo de página. Se um título de marcador tiver CPF, e-mail, telefone, cartão ou CNPJ, há aviso para editá-lo num leitor de PDF.
- **Dados que nenhuma camada leu:** letra de mão, scan muito ruim, número escrito por extenso, nomes de pessoas. Para isso existem a conferência e a tarja à mão.
- **Formulários preenchíveis, comentários e assinaturas digitais** não são tratados à parte. A regravação com limpeza (`garbage=4`, `clean=True`) costuma invalidar assinaturas digitais: o PDF tarjado não deve ser usado como documento assinado.

## Boas práticas para quem usa

1. Confira as páginas apontadas e marque como aprovadas.
2. Na dúvida, tarje à mão: a tarja à mão é definitiva como a automática.
3. Guarde o original no sistema de origem (SEI); o Tarjador não guarda nada.
4. Não envie PDFs com dados pessoais por e-mail, nem para pedir suporte.
