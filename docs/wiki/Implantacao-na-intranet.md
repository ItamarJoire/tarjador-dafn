# Implantação na intranet

> **Situação:** a aplicação está pronta para rodar em container ([Implantação com Docker](Implantacao-com-Docker.md)). Falta a parte de infraestrutura com a TI: servidor, endereço, HTTPS e o deploy em si.

Para uso local, cada pessoa continua podendo rodar o Tarjador na própria máquina (API em `127.0.0.1`, ver [Desenvolvimento](Desenvolvimento.md)).

## Antes de tudo: uma decisão

Num servidor, os PDFs **trafegam da máquina da pessoa até o servidor do ITI**, são processados lá e voltam tarjados. Não saem da rede do órgão, mas saem da máquina de quem usa. Há dois caminhos:

| Caminho | Como fica | Esforço |
|---|---|---|
| **Servidor na intranet** (recomendado, já preparado) | A arquitetura atual, num container num servidor do ITI. Ninguém instala nada. | Baixo: infraestrutura (abaixo) |
| **Tarjamento no navegador** | Nada sai da máquina; o servidor só entrega a página. O motor (PyMuPDF e OCR) teria de rodar no navegador via WebAssembly. | Alto: reescrita do motor, mais lento e pesado em PDFs grandes |

O texto do FAQ e das mensagens já considera o servidor na intranet.

## Endereço

Sugestão: **`tarjador.iti.gov.br`**, cadastrado só no DNS interno, para abrir apenas de dentro da rede ou pela VPN. Alternativas: seguir o padrão de nomes da TI (por exemplo `tarjador.dafn.iti.gov.br`) ou `intranet.iti.gov.br/tarjador`. Esta última exige adaptar a tela e a API para responderem sob `/tarjador`. Quem decide e cadastra é a TI do ITI.

## O que já está pronto

| Item | Como |
|---|---|
| Rodar em container | `Dockerfile` e `compose.yaml` na raiz: uma imagem com tela e API |
| Escutar na rede | `TARJADOR_HOST=0.0.0.0` na imagem |
| Servidor de produção com um processo só | Waitress (`TARJADOR_PRODUCAO=1`), com threads para as requisições |
| Limpeza periódica dos lotes expirados | Verificação a cada minuto (antes, só a cada novo envio) |
| Encerramento limpo | `docker stop` apaga a pasta temporária antes de sair |
| Reiniciar sozinho | `restart: unless-stopped` no Compose, e `HEALTHCHECK` na imagem |
| Respeitar o limite de CPU | A API lê o limite do container para dimensionar o OCR |
| Sem conexão para fora | Telemetria do ONNX Runtime desligada; os modelos de OCR vêm na imagem |
| Usuário sem privilégio | UID 10001, grupo 0 (compatível com OpenShift) |

## O que falta, com a TI

| Item | Por quê |
|---|---|
| **Servidor com Docker** (ou a plataforma de containers do órgão) | Onde a imagem vai rodar. Sugestão: 4 CPUs e 4 GB de memória para o container |
| **Endereço no DNS interno** | Ver acima |
| **HTTPS no servidor web da frente**, com limite de envio de 520 MB e tempo limite de 300 s | Os PDFs trafegam com dados pessoais. Exemplo de Nginx em [Implantação com Docker](Implantacao-com-Docker.md#https-e-servidor-web-na-frente) |
| **Registro da imagem** (se a plataforma exigir) | Publicar a imagem no registro interno em vez de construir no servidor |
| **Medir de novo a estimativa de tempo** | A estimativa da tela foi medida na máquina de desenvolvimento (`SEGUNDOS_POR_PAGINA_COM_OCR` em `web/src/components/Redator/PainelEnvio/PainelEnvio.tsx`) |
| **Controle de acesso** (opcional) | Hoje não há login: quem tiver o id de um lote consegue acessá-lo enquanto existir |
| **Registro de uso sem conteúdo** (opcional) | Saber volume e erros sem registrar dado pessoal |

## Atualizar uma versão

```bash
git pull
docker compose up -d --build
```

Os lotes em andamento se perdem na troca: faça fora do horário de uso.
