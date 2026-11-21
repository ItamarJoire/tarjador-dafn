# Por que o Tarjador

## O problema

Documentos de processos administrativos carregam dados pessoais de servidores, cidadãos e terceiros: CPF, identidade, endereço, telefone, conta bancária. Para publicar ou compartilhar esses documentos sem descumprir a LGPD, os dados precisam ser cobertos.

Fazer isso à mão tem três problemas:

1. **É lento.** Um processo do SEI pode ter centenas de páginas.
2. **Escapa dado.** Um CPF no meio de um parágrafo, um RG no carimbo da margem, um número numa página escaneada torta.
3. **A tarja costuma ser falsa.** Desenhar um retângulo preto num editor de PDF não apaga o texto embaixo. Basta selecionar e copiar, ou extrair o texto, para recuperar o dado. Muitos vazamentos acontecem assim.

## O que o Tarjador resolve

- **Encontra os dados automaticamente**, inclusive em páginas digitalizadas (OCR) e em QR Codes e códigos de barras.
- **Apaga de verdade.** O texto sob a tarja sai do conteúdo do PDF, os pixels da imagem embaixo são zerados e os metadados do arquivo (autor, título, programa) são limpos. Ver [Motor de detecção](Motor-de-deteccao.md#como-a-tarja-apaga).
- **Mostra onde olhar.** Em vez de pedir que alguém releia o documento inteiro, aponta as páginas com sinal de que algo escapou e explica o motivo.
- **Deixa a pessoa corrigir.** Na conferência dá para aprovar cada página e tarjar à mão o que faltou, com o mesmo apagamento definitivo.

## Decisões de projeto, e por quê

### Nada de nuvem nem serviço de terceiros

Os PDFs têm dados pessoais. Mandá-los para um serviço externo de OCR ou de IA seria criar o problema que o Tarjador existe para evitar. Por isso **todo o processamento acontece na própria máquina** que roda a API: PyMuPDF para ler e apagar, RapidOCR para o OCR (os modelos vêm no próprio pacote) e OpenCV para os códigos.

### Nada fica guardado

Não há banco de dados. Um lote existe só na memória da API e numa pasta temporária. O original é apagado assim que é processado. O tarjado fica disponível por um tempo para ser baixado e depois é apagado. Ver [Segurança e privacidade](Seguranca-e-privacidade.md).

### Regras explicáveis em vez de "caixa-preta"

A detecção usa padrões (expressões regulares) com validação: dígito verificador de CPF e CNPJ, algoritmo de Luhn para cartão. Cada tarja tem um motivo que dá para explicar, e cada dúvida vira uma mensagem clara na conferência. Um modelo de IA poderia achar mais coisas, mas não diria por que tarjou ou deixou de tarjar, e exigiria muito mais da máquina.

### Errar para o lado de tarjar

Na dúvida, o Tarjador prefere cobrir. CPF com dígito inválido ainda é tarjado (pode ser erro de leitura do OCR) e vai para a conferência. Um CPF cortado na borda do scan também é tarjado. A exceção é o cartão de pagamento: sem Luhn válido não tarja, porque números de 16 dígitos sem essa validação costumam ser matrícula ou protocolo.

### A pessoa continua no controle

A ferramenta não promete 100%. Scans ruins, letra de mão e layouts estranhos existem. Por isso a conferência faz parte do fluxo, e não é um extra: as páginas suspeitas são apontadas, a pessoa aprova e, se precisar, tarja à mão.

### Simples de usar

Uma tela só: enviar, acompanhar, conferir e baixar no mesmo lugar. Tutorial guiado, perguntas frequentes e um fluxograma de como o sistema opera ficam no cabeçalho.

## O que ficou de fora, de propósito

- **Nomes de pessoas.** Detectar nome próprio com segurança exige modelos de linguagem e gera muito falso positivo (nomes de ruas, órgãos, cargos). Quando necessário, use a tarja à mão.
- **CNPJ ligado por padrão.** CNPJ não é dado pessoal pela LGPD. Está no checklist, desmarcado, para quem precisar.
- **Desfazer uma tarja.** Seria a mesma coisa que a tarja não ser definitiva. Para refazer, tarje de novo a partir do original.
- **Arquivos anexados dentro do PDF e marcadores (sumário).** A tarja não chega neles. O Tarjador avisa quando existem. Ver [Segurança e privacidade](Seguranca-e-privacidade.md#o-que-a-tarja-não-alcança).
