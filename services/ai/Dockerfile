# syntax=docker/dockerfile:1
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# opencv-python-headless (Prompt 6b, POST /verify) precisa dessas libs de
# sistema mesmo na build "headless" — sem isso, `import cv2` falha com
# "ImportError: libGL.so.1". Camada isolada, cacheável independente do código.
RUN apt-get update && apt-get install -y --no-install-recommends libglib2.0-0 libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Camada de dependências separada do código-fonte para cache de build eficiente.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY app ./app

ENV PATH="/app/.venv/bin:$PATH" \
    AI_SERVICE_PORT=8000

RUN useradd --create-home --uid 1000 appuser
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=5 \
  CMD python -c "import os, urllib.request; urllib.request.urlopen('http://localhost:' + os.environ.get('AI_SERVICE_PORT', '8000') + '/health')" || exit 1

CMD ["python", "-m", "app.run"]
