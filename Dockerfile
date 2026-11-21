# syntax=docker/dockerfile:1
#
# Tarjador: uma imagem só, com a tela compilada e a API.
# A API serve a tela e as rotas /api no mesmo endereço (porta 5000).
#
#   docker compose up -d --build      # sobe em http://localhost:8080
#
# Não há banco de dados nem volume: os PDFs ficam numa pasta temporária dentro
# do container, só durante o tarjamento (ver docs/wiki/Implantacao-com-Docker.md).

# ---------------------------------------------------------------------------
# 1. Tela: compila o front (web/dist)
# ---------------------------------------------------------------------------
FROM node:22-trixie-slim AS tela
WORKDIR /web
# Dependências primeiro: a camada só é refeita quando o package-lock muda
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# 2. API + motor
# ---------------------------------------------------------------------------
FROM python:3.14-slim-trixie AS app

# ORT_DISABLE_TELEMETRY: desliga o coletor de telemetria da Microsoft que vem
# no ONNX Runtime (motor do OCR). O redator.py também desliga; aqui fica
# explícito para quem audita a imagem.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    ORT_DISABLE_TELEMETRY=1

# tini: repassa o SIGTERM do docker stop e recolhe os processos de OCR encerrados.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --ignore-requires-python: o RapidOCR declara suporte só até o Python 3.12,
# mas funciona nos mais novos (sem a flag, o pip instala uma versão de 2022).
# O RapidOCR puxa o OpenCV com interface gráfica (~290 MB, e exige libgl do
# sistema, mais ~220 MB). No servidor não há tela: troca pela versão
# "headless", na mesma versão, com a mesma API (inclusive QR Code e barras).
COPY requirements.txt ./
RUN pip install -r requirements.txt --ignore-requires-python \
 && VERSAO_OPENCV="$(pip show opencv-python | sed -n 's/^Version: //p')" \
 && pip uninstall -y opencv-python \
 && pip install "opencv-python-headless==${VERSAO_OPENCV}" \
 && python -c "import cv2; cv2.QRCodeDetector(); cv2.barcode.BarcodeDetector()"

COPY redator.py api.py ./
COPY --from=tela /web/dist ./web/dist

# Usuário sem privilégio. Grupo 0 e pasta gravável pelo grupo: funciona também
# em plataformas que rodam o container com um UID aleatório (OpenShift).
RUN useradd --system --uid 10001 --gid 0 --home-dir /app --no-create-home tarjador \
 && mkdir -p /tmp/tarjador \
 && chown 10001:0 /tmp/tarjador \
 && chmod 770 /tmp/tarjador
USER 10001

ENV TARJADOR_HOST=0.0.0.0 \
    TARJADOR_PORTA=5000 \
    TARJADOR_PRODUCAO=1 \
    TARJADOR_PASTA_TEMP=/tmp/tarjador

EXPOSE 5000

# A primeira consulta carrega o modelo de OCR: start-period dá tempo para isso
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/api/saude', timeout=8)"]

ENTRYPOINT ["tini", "--"]
CMD ["python", "api.py"]
