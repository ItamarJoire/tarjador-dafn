# Implantação com Docker

O Tarjador roda inteiro em **um container**: a imagem tem a tela já compilada e a API, que serve as duas coisas no mesmo endereço. Não há banco de dados nem volume.

## Resumo para a TI

| Item | Valor |
|---|---|
| Imagem | Construída pelo `Dockerfile` da raiz (`docker compose build`) |
| Porta no container | `5000` (HTTP) |
| Saúde | `GET /api/saude` responde 200 (também é o `HEALTHCHECK` da imagem) |
| Usuário | Sem privilégio (UID 10001, grupo 0); funciona com UID aleatório (OpenShift) |
| Dados persistentes | **Nenhum.** Não monte volume |
| Réplicas | **Uma.** A fila e os lotes ficam na memória do processo |
| Recursos sugeridos | 4 CPUs e 4 GB de memória (o OCR é a parte pesada) |
| Saída para a internet | **Nenhuma necessária.** A telemetria do ONNX Runtime vem desligada |
| Na frente | Servidor web do órgão com HTTPS, encaminhando para a porta do container |

## Subir

```bash
docker compose up -d --build     # compila a imagem e sobe
docker compose logs -f           # acompanha
docker compose down              # para e remove o container
```

Abre em **http://localhost:8080**. Para outra porta na máquina:

```bash
TARJADOR_PORTA_EXTERNA=8090 docker compose up -d    # bash
$env:TARJADOR_PORTA_EXTERNA=8090; docker compose up -d   # PowerShell
```

Sem o Compose:

```bash
docker build -t tarjador .
docker run -d --name tarjador -p 8080:5000 --cpus 4 --memory 4g --restart unless-stopped tarjador
```

## Como a imagem é montada

Dois estágios, no `Dockerfile`:

1. **`tela`** (`node:22-trixie-slim`): `npm ci` e `npm run build`, gerando `web/dist`. Só o resultado passa para a imagem final.
2. **`app`** (`python:3.14-slim-trixie`):
   - instala as dependências do `requirements.txt`;
   - troca o OpenCV com interface gráfica pela versão **headless**, na mesma versão. O servidor não tem tela, e isso economiza uns 500 MB, incluindo as bibliotecas gráficas do sistema;
   - copia `api.py`, `redator.py` e a tela compilada;
   - roda com usuário sem privilégio, sob o `tini`, que repassa o sinal de parada e recolhe os processos de OCR encerrados.

A imagem final tem cerca de 960 MB. A maior parte é do motor: PyMuPDF, ONNX Runtime, OpenCV e NumPy.

O `.dockerignore` deixa de fora PDFs, `entrada/`, `saida/`, `.env`, `.venv`, `node_modules` e `.git`. **Nenhum PDF entra na imagem.**

## Variáveis de ambiente

| Variável | Padrão na imagem | Para quê |
|---|---|---|
| `TARJADOR_HOST` | `0.0.0.0` | Endereço em que a API escuta dentro do container |
| `TARJADOR_PORTA` | `5000` | Porta dentro do container |
| `TARJADOR_PRODUCAO` | `1` | Usa o Waitress (servidor de produção) |
| `TARJADOR_THREADS` | `8` | Requisições atendidas ao mesmo tempo (envio, consulta, download). O tarjamento em si roda na fila |
| `TARJADOR_PASTA_TEMP` | `/tmp/tarjador` | Onde ficam os PDFs durante o tarjamento |
| `TARJADOR_NUCLEOS` | (vazio) | Núcleos para o OCR. Vazio: usa o limite de CPU do container |
| `ORT_DISABLE_TELEMETRY` | `1` | Desliga a telemetria do ONNX Runtime. **Não remova** |
| `TARJADOR_PORTA_EXTERNA` | `8080` | Só no `compose.yaml`: porta na máquina |

## Produção

### HTTPS e servidor web na frente

O container fala HTTP. O servidor web do órgão faz o HTTPS e encaminha. Pontos de atenção:

- **Tamanho do envio:** até 500 MB num único POST. No Nginx: `client_max_body_size 520m;`.
- **Tempo:** envios grandes demoram para subir. No Nginx: `proxy_read_timeout 300s; proxy_send_timeout 300s;`.
- **Buffer:** com `proxy_request_buffering off;` o envio vai direto ao container, sem cópia extra em disco no proxy.

Exemplo mínimo de Nginx:

```nginx
server {
    listen 443 ssl;
    server_name tarjador.iti.gov.br;
    # ssl_certificate ...; ssl_certificate_key ...;   (certificado da TI)

    client_max_body_size 520m;
    proxy_request_buffering off;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Uma réplica só

Os lotes e a fila ficam na memória do processo. Com duas réplicas atrás de um balanceador, um lote criado numa não existe na outra. Para mais capacidade, dê mais CPU ao container: o OCR usa até 4 processos em paralelo, conforme os núcleos disponíveis.

### Recursos

O OCR é a parte pesada: cerca de 13 segundos por página cheia de texto, com um núcleo por processo. O `compose.yaml` limita a 4 CPUs e 4 GB. A API lê o limite de CPU do container (cgroup v1 e v2) para não abrir processos de OCR demais. `TARJADOR_NUCLEOS` força um valor.

### Dados

- Os PDFs ficam em `/tmp/tarjador`, **dentro do container**: o original é apagado ao ser processado, e o tarjado quando é concluído, apagado, cancelado ou 30 minutos depois de pronto. Uma verificação roda a cada minuto.
- Ao parar (`docker stop`), a API apaga a pasta temporária antes de sair.
- `docker compose down` remove o container e tudo o que havia nele.
- **Não monte volume** em `/tmp/tarjador`: os arquivos sobreviveriam ao container, o que não é desejado.

### Atualizar

```bash
git pull
docker compose up -d --build
```

Os lotes em andamento se perdem na troca: atualize fora do horário de uso.

## Verificado

Testado no Docker Desktop (Windows, Linux em WSL2), imagem `python:3.14-slim-trixie`:

- container saudável, tela e API no mesmo endereço, usuário sem privilégio;
- OCR de PDF escaneado: CPF, e-mail e telefone tarjados, e a auditoria do PDF baixado não acha resíduo;
- fluxo completo no navegador: envio, conferência, tarja à mão (o texto sai do PDF), aprovação e F5;
- cancelamento no meio do OCR: processos encerrados e pasta do lote apagada;
- `docker stop` em cerca de 2 s, com a pasta temporária apagada;
- limite de 4 CPUs respeitado pelo OCR;
- telemetria do ONNX Runtime desligada (sem o aviso do coletor no log).
