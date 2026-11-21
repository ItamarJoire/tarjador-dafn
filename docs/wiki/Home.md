# Tarjador

O **Tarjador** cobre dados pessoais em PDFs antes de eles serem publicados ou compartilhados: CPF, RG/CNH, e-mail, telefone, endereço, dados bancários, QR Code e código de barras. Funciona em PDFs digitais e em páginas digitalizadas, cujo texto é lido por OCR.

A tarja é **destrutiva**: o dado embaixo dela é apagado do arquivo, e não só escondido atrás de um retângulo preto.

Mantido pela **COIAP/DAFN** do ITI.

## Para quem é

Para quem precisa entregar ou publicar documentos de processos (SEI, certidões, contratos) sem expor dados pessoais, conforme a LGPD. Quem usa não precisa saber nada de tecnologia: escolhe os PDFs, marca o que tarjar, confere e baixa.

## Páginas deste wiki

| Página | O que explica |
|---|---|
| [Por que o Tarjador](Por-que-o-Tarjador.md) | O problema, as decisões de projeto e o que ficou de fora de propósito |
| [Como funciona](Como-funciona.md) | O caminho de um PDF, do envio ao download, visto por quem usa |
| [Motor de detecção](Motor-de-deteccao.md) | Como os dados são encontrados (texto, OCR, códigos) e como a tarja apaga |
| [Arquitetura e tecnologias](Arquitetura-e-tecnologias.md) | As três partes do sistema, as tecnologias e por que cada uma |
| [Referência da API](Referencia-da-API.md) | Rotas, formatos e erros da API |
| [Front-end](Front-end.md) | Organização da tela em React: pastas, estado, armazenamento e tutorial |
| [Segurança e privacidade](Seguranca-e-privacidade.md) | Onde cada dado fica, por quanto tempo, e o que a tarja não alcança |
| [Desenvolvimento](Desenvolvimento.md) | Instalar, rodar, depurar, testar e usar pela linha de comando |
| [Implantação na intranet](Implantacao-na-intranet.md) | O que falta para o Tarjador rodar num servidor do ITI |
| [Limitações e próximos passos](Limitacoes-e-proximos-passos.md) | O que ainda não está resolvido e as decisões pendentes |

## Em uma frase, como funciona

O navegador envia os PDFs para a API do Tarjador. A API encontra os dados em cada página (texto digital, OCR e leitura de códigos), apaga o que encontrou e devolve o PDF tarjado. As páginas com sinal de que algo pode ter escapado vão para a conferência humana, onde dá para aprovar a página ou tarjar à mão o que faltou.

## Contato

Dúvidas, problemas ou sugestões: equipe responsável **COIAP/DAFN**.

- Alessandro Dias: alessandro.dias@iti.gov.br
- Itamar Joire: itamar.nascimento@iti.gov.br
- Karen Macedo: karen.macedo@iti.gov.br

Não envie por e-mail PDFs com dados pessoais.
