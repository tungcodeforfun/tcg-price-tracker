# Multi-stage Dockerfile for TCG Price Tracker
FROM python:3.11-slim as base

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Create non-root user
RUN groupadd --gid 1000 appuser && \
    useradd --uid 1000 --gid appuser --shell /bin/bash --create-home appuser

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Copy requirements and readme
COPY pyproject.toml README.md ./
COPY src/ ./src/

# Install dependencies
RUN pip install --upgrade pip && \
    pip install .

# Development stage
FROM base as development

# Install development dependencies
RUN pip install -e ".[dev]"

# Copy source code
COPY . .

# Change ownership to non-root user
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Command for development
CMD ["python", "-m", "tcgtracker"]

# Production stage
FROM base as production

# Copy only necessary files
COPY src/ ./src/
COPY pyproject.toml ./

# Install production dependencies only
RUN pip install .

# Change ownership to non-root user
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Add health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Expose port
EXPOSE 8000

# Command for production
CMD ["python", "-m", "tcgtracker"]