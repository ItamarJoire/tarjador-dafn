# Implantação na intranet

> **Situação:** planejado, ainda não feito. Hoje cada pessoa roda o Tarjador na própria máquina (API em `127.0.0.1`). Esta página reúne o que falta para ele rodar num servidor do ITI, acessado pela intranet.

## Antes de tudo: uma decisão

Num servidor, os PDFs **trafegam da máquina da pessoa até o servidor do ITI**, são processados lá e voltam tarjados. Não saem da rede do órgão, mas saem da máquina de quem usa. Há dois caminhos:

| Caminho | Como fica | Esforço |
|---|---|---|
| **Servidor na intranet** (recomendado) | A arquitetura atual, num servidor do ITI. Ninguém instala nada. | Baixo: configuração e infraestrutura (abaixo) |
| **Tarjamento no navegador** | Nada sai da máquina; o servidor só entrega a página. O motor (PyMuPDF e OCR) teria de rodar no navegador via WebAssembly. | Alto: reescrita do motor, mais lento e pesado em PDFs grandes |

O texto do FAQ e das mensagens já considera o servidor na intranet.

## Endereço

Sugestão: **`tarjador.iti.gov.br`**, cadastrado só no DNS interno, para abrir apenas de dentro da rede ou pela VPN. Alternativas: seguir o padrão de nomes da TI (por exemplo `tarjador.dafn.iti.gov.br`) ou `intranet.iti.gov.br/tarjador`. Esta última exige adaptar a tela e a API para responderem sob `/tarjador`. Quem decide e cadastra é a TI do ITI.

## O que precisa mudar ou ser providenciado

| Item | Por quê | Onde |
|---|---|---|
| **Escutar na rede, atrás de um servidor web** (Nginx/IIS como proxy reverso) | Hoje a API só aceita conexões da própria máquina | `api.py`: `app.run(host="127.0.0.1", ...)` |
| **Servidor WSGI de produção** (ex.: Waitress no Windows, Gunicorn no Linux) com **um processo só** | O `app.run` do Flask é para desenvolvimento. O estado dos lotes e a fila ficam na memória de um processo: com vários processos, um lote criado num não existiria no outro | Inicialização da API |
| **HTTPS** com certificado da TI | Os PDFs trafegam com dados pessoais. Alguns recursos do navegador (como copiar e-mail) só funcionam em HTTPS | Servidor web |
| **Limite de envio no proxy** igual ou maior que 500 MB, e tempo limite de leitura generoso | O envio é um único POST com todos os PDFs | Servidor web |
| **Limpeza periódica dos lotes expirados** | Hoje a limpeza só roda a cada novo envio (ver [Limitações](Limitacoes-e-proximos-passos.md#limpeza-dos-lotes-expirados)) | `api.py` |
| **Pasta temporária em disco local**, com acesso só da conta do serviço, fora de backup e antivírus agressivo | Guarda PDFs com dados pessoais durante o processamento | Servidor |
| **Máquina com CPU suficiente** | O OCR é a parte cara (≈13 s por página cheia numa máquina de desenvolvimento). A fila processa um arquivo por vez, com até 4 processos de OCR em paralelo | Servidor |
| **Serviço que reinicia sozinho** (serviço do Windows ou systemd) | Se a API cair, os lotes em andamento se perdem; ela precisa voltar sem intervenção | Servidor |
| **Medir de novo a estimativa de tempo** | A estimativa mostrada na tela foi medida na máquina de desenvolvimento | `SEGUNDOS_POR_PAGINA_COM_OCR` em `web/src/components/Redator/PainelEnvio/PainelEnvio.tsx` |
| **Controle de acesso** (opcional) | Hoje não há login: quem tiver o id de um lote consegue acessá-lo enquanto existir | A definir com a TI |
| **Registro de uso sem conteúdo** (opcional) | Saber volume e erros sem registrar dado pessoal | `api.py` |

## Atualizar uma versão

1. `git pull` no servidor.
2. `pip install -r requirements.txt --ignore-requires-python` (se mudou).
3. `cd web && npm ci && npm run build`.
4. Reiniciar o serviço. Os lotes em andamento se perdem: faça fora do horário de uso.
