# Motor de detecção

O motor é o `redator.py` (versão 1.4). Ele encontra os dados, decide o que precisa de conferência e aplica a tarja. Funciona sozinho pela linha de comando (ver [Desenvolvimento](Desenvolvimento.md#linha-de-comando)), e a API o usa como biblioteca.

## As três camadas

| Camada | Quando roda | Como encontra |
|---|---|---|
| **1. Texto digital** | Sempre | Lê o texto do PDF com a posição de cada caractere (PyMuPDF) e aplica os padrões. A tarja cai exatamente sobre os caracteres do dado. |
| **2. OCR** | Página com imagem relevante (a partir de 1% da área) e OCR ligado | Renderiza a página a 300 DPI, lê o texto com o RapidOCR e aplica os mesmos padrões, com correção de confusões típicas (O→0, l→1, S→5...). Em página densa, repete a leitura em blocos 2×2 para achar letra miúda. A posição da tarja é estimada dentro da caixa de cada linha lida. |
| **3. Códigos** | QR Code ou código de barras marcados | OpenCV procura e decodifica QR Codes e códigos de barras na imagem da página. |

As detecções que se sobrepõem são unificadas, para não sair tarja duplicada.

## Os tipos de dado

| Tipo | Como é reconhecido | Validação |
|---|---|---|
| CPF | `000.000.000-00` com ou sem pontuação | Dígito verificador. Se falhar, **tarja mesmo assim** e manda para a conferência (pode ser erro do OCR). |
| CPF parcial | CPF cortado na borda do scan ou com dígito comido (`091.580.337-2`) | Vai sempre para a conferência. Ligado junto com "CPF". |
| RG, CNH e outras identidades | Número perto de "RG", "identidade", "CNH", "PIS/PASEP", "NIT", "título de eleitor", "matrícula", "inscrição"; ou no formato `00.000.000-0` | Descarta datas e números curtos. |
| E-mail | `nome@dominio.tld`, tolerando espaço do OCR em volta do `@` | — |
| Telefone | Fixo e celular, com ou sem DDD e +55 | — |
| Endereço postal | Começa por rua, avenida, quadra, SQN/SHIS etc. ou por "logradouro:", "bairro:", "complemento:" | Heurística: vai sempre para a conferência. |
| CEP | `00000-000`, `00.000-000` ou "CEP" seguido de 8 dígitos | — |
| Agência e conta | Número depois de "agência", "conta corrente", "c/c" | — |
| Cartão de pagamento | 16 dígitos em grupos de 4 | Algoritmo de Luhn. **Sem Luhn válido não tarja.** |
| Chave PIX | Depois de "PIX"/"chave PIX", ou chave aleatória (UUID) | — |
| IBAN | `BR` + 2 dígitos + 21 a 27 caracteres | — |
| QR Code e código de barras | Na imagem da página | — |
| CNPJ (desmarcado) | `00.000.000/0000-00` | Dígito verificador. |

**Valor pelo rótulo.** Em formulários e carteiras de identidade, o número costuma ficar na linha de baixo ou ao lado do rótulo ("RG", "E-mail", "Telefone"), sem um padrão reconhecível sozinho. O motor procura o valor perto do rótulo e só aceita se tiver o formato do tipo (por exemplo, pelo menos 5 dígitos para RG). Essas tarjas vão para a conferência.

**CPF quebrado em duas linhas.** Também é procurado, juntando o fim de uma linha com o começo da seguinte.

## Scan de baixa qualidade (modo agressivo)

Com a opção ligada, se uma linha cita "CPF", "RG", "e-mail" ou "telefone" e nenhum dado foi lido nela, o motor tarja a linha **a partir da palavra até o fim**. Serve para scans borrados, em que o OCR lê o rótulo mas não o número. Cobre mais do que o necessário, e cada tarja desse tipo vai para a conferência.

## Por que uma página vai para a conferência

Dois tipos de sinal:

**Sinal na página:**

- a página menciona um tipo (CPF, RG, e-mail, telefone, endereço, dados bancários) pelo menos 2 vezes, e nenhuma tarja daquele tipo saiu, ou saíram pelo menos 3 a menos que as menções;
- a página é uma imagem (quase sem texto digital) e o OCR não achou nenhum dado.

**Sinal numa tarja:**

| Motivo | Por quê |
|---|---|
| Tarja do modo agressivo | Pode ter apagado texto demais. |
| Valor achado pelo rótulo | Confirmar que a tarja caiu no campo certo. |
| CPF parcial | Confirmar que cobre o número inteiro. |
| CPF com dígito inválido | Erro de leitura do OCR ou outro número (protocolo, matrícula). |
| Endereço | Detectado por heurística: pode ser endereço institucional. |
| OCR com confiança abaixo de 0,90 | Confirmar que a tarja cobre o dado inteiro. |
| Código de barras pela heurística | Mancha que nenhum leitor decodificou (só na linha de comando). |

Tarjas confiáveis (CPF válido no texto digital, e-mail digitado) não aparecem na conferência.

**Avisos do arquivo inteiro:** PDF com arquivos anexados embutidos (a tarja não entra neles) e marcadores do sumário que contêm CPF, e-mail, telefone, cartão ou CNPJ (a tarja não alcança marcadores).

## Como a tarja apaga

A tarja usa o recurso de *redaction* do PyMuPDF/MuPDF, que reescreve o conteúdo da página. É feita em **dois passos por página**:

1. **Apaga o texto.** Numa tarja da camada de texto horizontal, o apagamento é feito só pela **faixa central** do retângulo. A caixa de cada caractere vem da fonte inteira, mais alta que a letra. Em linhas apertadas, como no carimbo de assinatura digital, apagar pelo retângulo todo arrancaria caracteres da linha de baixo ou do lado. Texto girado e tarjas do OCR apagam pelo retângulo inteiro.
2. **Cobre e limpa.** Pinta o retângulo inteiro de preto, **zera os pixels** das imagens embaixo e remove o desenho vetorial coberto. O texto não é mexido de novo: o que sobrou ali é vizinho, não dado.

Depois, os **metadados** do documento (autor, título, assunto, programa, XMP) são apagados e o arquivo é regravado com limpeza completa (`garbage=4`, `clean=True`). Isso descarta objetos órfãos que ainda poderiam guardar o conteúdo antigo.

A **tarja à mão** usa o mesmo apagamento definitivo (texto removido, pixels zerados, desenho coberto removido), aplicado sobre o PDF já tarjado. As coordenadas vêm da página como ela aparece na tela e são convertidas para as do PDF, o que funciona também em páginas giradas.

## Desempenho

- As páginas de um arquivo são analisadas **em paralelo**, em processos separados: metade dos núcleos da máquina, até 4 processos, com as threads do OCR repartidas entre eles.
- O OCR é a parte cara (cerca de 13 s por página cheia de texto na máquina de desenvolvimento). Por isso só roda em páginas com imagem relevante, e a opção **PDF 100% digital** desliga.
- O cancelamento é verificado 4 vezes por segundo, e os processos de OCR são encerrados na hora.
