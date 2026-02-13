# TCG Price Tracker

[![CI](https://github.com/tungcodeforfun/tcg-price-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/tungcodeforfun/tcg-price-tracker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A full-stack application for tracking Pokemon and One Piece TCG card prices. Monitor your collection's value, get price alerts, and search across multiple marketplaces.

## Features

- **Collection Management** — Track cards you own with purchase price, condition, and quantity
- **Price Tracking** — Automated price fetching from TCGPlayer, eBay, PriceCharting, and JustTCG
- **Portfolio Analytics** — Dashboard with total value, profit/loss, and historical charts
- **Price Alerts** — Get notified when cards hit your target price
- **Multi-Source Search** — Search your library and import from external marketplaces
- **Trending Cards** — See which cards are rising or falling in value

## Tech Stack

### Backend
- **Runtime:** Python 3.11+
- **Framework:** FastAPI + Uvicorn
- **Database:** PostgreSQL 15 (async via asyncpg)
- **Cache:** Redis 7
- **Task Queue:** Celery (background price updates)
- **ORM:** SQLAlchemy 2.0 + Alembic migrations
- **Auth:** JWT (access + refresh tokens)

### Frontend
- **Runtime:** Node.js 20+
- **Framework:** React 19 + TypeScript 5.9
- **Build:** Vite 7
- **Styling:** Tailwind CSS v4
- **UI:** Radix UI + shadcn-style components
- **Charts:** Recharts

### Infrastructure
- **Containers:** Docker Compose
- **CI/CD:** GitHub Actions
- **Security:** Trivy, Semgrep, TruffleHog, Bandit

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ and npm (for frontend development)
- Python 3.11+ (for backend development without Docker)

### Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/tungcodeforfun/tcg-price-tracker.git
cd tcg-price-tracker

# Copy environment file and configure
cp .env.example .env
# Edit .env with your database password and API keys

# Start all services
docker compose up -d

# Run database migrations
docker compose exec tcg-tracker tcg-cli db upgrade
```

The API will be available at `http://localhost:8000`.

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server starts at `http://localhost:5173` and proxies API requests to the backend.

### Backend Development

```bash
cd tcgtracker
pip install -e ".[dev]"
tcg-cli serve --host 0.0.0.0 --port 8000 --reload
```

## Project Structure

```
tcg-price-tracker/
├── frontend/               # React + TypeScript frontend
│   ├── src/
│   │   ├── components/     # UI primitives and shared components
│   │   ├── contexts/       # React context providers
│   │   ├── lib/            # API client, utilities
│   │   ├── pages/          # Route page components
│   │   └── types/          # TypeScript interfaces
│   └── package.json
├── tcgtracker/             # Python backend
│   ├── src/tcgtracker/
│   │   ├── api/            # FastAPI routes and schemas
│   │   ├── database/       # SQLAlchemy models
│   │   ├── integrations/   # External API clients
│   │   └── workers/        # Celery background tasks
│   └── pyproject.toml
├── migrations/             # Alembic database migrations
├── docker-compose.yml      # Full stack orchestration
└── .github/workflows/      # CI/CD pipelines
```

## API

The backend serves a REST API at `/api/v1/`. Key endpoints:

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/auth/login` | Authenticate (form-encoded) |
| `POST /api/v1/auth/register` | Create account (JSON) |
| `GET /api/v1/cards` | List cards |
| `POST /api/v1/cards/search` | Search cards |
| `GET /api/v1/collections/items` | Get collection |
| `GET /api/v1/collections/stats` | Portfolio stats |
| `GET /api/v1/prices/card/{id}` | Price history |
| `GET /api/v1/prices/trends` | Trending cards |
| `POST /api/v1/search/all` | Multi-source search |
| `GET /api/v1/users/alerts` | Price alerts |

## Development

```bash
# Backend formatting and linting
cd tcgtracker
black src/ tests/
isort src/ tests/
flake8 src/ tests/
mypy src/

# Backend tests
pytest

# Frontend type checking and linting
cd frontend
npx tsc --noEmit
npm run lint

# Frontend production build
npm run build
```

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
