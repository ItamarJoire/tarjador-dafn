# Limitações e próximos passos

O que já se sabe que não está resolvido, em ordem de importância.

## Sem testes automatizados

As mudanças foram verificadas com PDFs de teste e com o navegador controlado por script, mas esses testes não estão no repositório. Próximo passo sugerido:

- **Motor:** testes com PDFs sintéticos gerados na hora (nunca PDFs reais), cobrindo cada tipo, página girada, scan e a tarja à mão, e conferindo que o texto sumiu do PDF;
- **API:** envio, fila, cancelamento, expiração e erros;
- **Tela:** fluxo de envio, conferência e download.

## Detecção

- **Nomes de pessoas não são detectados.** Use a tarja à mão.
- **Letra de mão, scan muito ruim e números por extenso** podem escapar. A conferência aponta parte desses casos (página que cita CPF sem tarja, imagem sem nada lido), mas não todos.
- **Endereço** é detectado por heurística e pode pegar endereço institucional ou deixar escapar formatos incomuns. A linha de comando aceita `--lista-branca` para o endereço do próprio órgão; a tela ainda não.
- **Anexos embutidos e marcadores** não são tarjados; há aviso.

## Operação

- **Estado só na memória:** reiniciar a API (ou atualizar o container) perde os lotes em andamento. Pelo mesmo motivo, roda com **uma réplica só**.
- **Um arquivo por vez na fila:** num servidor compartilhado, um PDF grande segura a fila enquanto processa (os menores passam na frente entre um arquivo e outro, não no meio).
- **Sem login:** quem tiver o id de um lote acessa enquanto ele existir.
- **Estimativa de tempo** medida na máquina de desenvolvimento.

## Restos do template

- A rota `/login` e a página `pages/Login` vêm do template do design system e não são usadas.
- Os componentes `ui/Datepicker`, `ui/Timepicker` e `ui/DateTimePicker` têm os 3 erros de lint conhecidos e também não são usados.

## Decisões pendentes

| Decisão | Opções | Quem |
|---|---|---|
| Onde o tarjamento roda | Servidor do ITI na intranet (recomendado) ou tudo no navegador. Ver [Implantação](Implantacao-na-intranet.md#antes-de-tudo-uma-decisão) | COIAP/DAFN |
| Endereço | `tarjador.iti.gov.br` ou padrão da TI | COIAP/DAFN com a TI |
| Controle de acesso | Sem login (só intranet) ou com autenticação | COIAP/DAFN com a TI |

## Ideias para depois

- Lista branca na tela (ex.: dados do próprio órgão que não devem ser tarjados).
- Termos extras para tarjar na tela (como o `--termo` da linha de comando).
- Relatório de tarjamento para anexar ao processo (quantas tarjas, de que tipo, por página; sem os valores).
- Auditoria do tarjado na tela (como o `auditar` da linha de comando).
