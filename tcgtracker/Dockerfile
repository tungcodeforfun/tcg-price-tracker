# syntax=docker/dockerfile:1
# Multi-stage Dockerfile for TCG Price Tracker
FROM ghcr.io/astral-sh/uv:0.12.19 AS uv

FROM python:3.13-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

# Create non-root user
RUN groupadd --gid 1000 appuser && \
    useradd --uid 1000 --gid appuser --shell /bin/bash --create-home appuser

WORKDIR /app

# Builder: resolve the locked runtime environment into /opt/venv
FROM base AS builder

COPY --from=uv /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-install-project

COPY README.md ./
COPY src/ ./src/
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-editable

# Development stage: editable install so bind-mounted src/ is live
FROM base AS development

COPY --from=uv /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --extra dev --no-install-project

COPY --chown=appuser:appuser . .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --extra dev

USER appuser

EXPOSE 8000

CMD ["python", "-m", "tcgtracker"]

# Production stage: only the prebuilt virtualenv, no sources/tests/tooling
FROM base AS production

COPY --from=builder /opt/venv /opt/venv

USER appuser

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=5)"]

EXPOSE 8000

CMD ["python", "-m", "tcgtracker"]
