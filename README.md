# TCG Price Tracker

[![CI](https://github.com/tungcodeforfun/tcg-price-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/tungcodeforfun/tcg-price-tracker/actions/workflows/ci.yml)

A full-stack application for tracking Pokemon and One Piece TCG card prices. Monitor your collection's value, get price alerts, and search across multiple marketplaces.

## Features

- **Collection Management** — Track cards you own with purchase price, condition, and quantity
- **Price Tracking** — Price fetching from TCGPlayer, eBay, PriceCharting, and JustTCG
- **Portfolio Analytics** — Dashboard with total value, profit/loss, and historical charts
- **Price Alerts** — Get notified when cards hit your target price
- **Multi-Source Search** — Search your library and import from external marketplaces
- **Trending Cards** — See which cards are rising or falling in value

## Tech Stack

### Backend
- **Runtime:** Python 3.13, managed with [uv](https://docs.astral.sh/uv/) (`tcgtracker/uv.lock`)
- **Framework:** FastAPI + Uvicorn
- **Database:** PostgreSQL 17 (async via asyncpg)
- **Redis:** Redis 7 (revoked-token blacklist)
- **ORM:** SQLAlchemy 2.0 + Alembic migrations
- **Auth:** JWT (access + refresh tokens)

### Frontend
- **Runtime:** Node.js 22+
- **Framework:** React 19 + TypeScript 6
- **Build:** Vite 8
- **Styling:** Tailwind CSS v4
- **UI:** Radix UI + shadcn-style components
- **Charts:** Recharts

### Infrastructure
- **Containers:** Docker Compose
- **CI:** GitHub Actions (lint, typecheck, migrations, tests, frontend build)

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 22+ and npm (for frontend development)
- Python 3.13 and [uv](https://docs.astral.sh/uv/) (for backend development without Docker)

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
uv sync --locked --extra dev
uv run tcg-cli db upgrade
uv run tcg-cli serve --host 0.0.0.0 --port 8000 --reload
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
│   │   └── integrations/   # External API clients
│   ├── migrations/         # Alembic database migrations
│   ├── pyproject.toml
│   └── uv.lock
├── scripts/init-db.sql     # Postgres extensions for the Docker database
├── docker-compose.yml      # Full stack orchestration
└── .github/workflows/      # CI workflow
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
uv run black src/ tests/
uv run isort src/ tests/
uv run flake8 src tests
uv run mypy src/tcgtracker

# Backend tests
uv run pytest

# Frontend type checking and linting
cd frontend
npx tsc --noEmit
npm run lint

# Frontend production build
npm run build
```

