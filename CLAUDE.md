# TCG Price Tracker

Monorepo for a Pokemon & One Piece TCG card price tracking application.

## Structure
- `tcgtracker/` — Backend (Python/FastAPI)
- `frontend/` — Frontend (React/TypeScript)
- `migrations/` — Alembic database migrations
- `docker-compose.yml` — Full stack orchestration

## Backend (tcgtracker/)
- Language: Python 3.11+
- Framework: FastAPI + Uvicorn
- Database: PostgreSQL 15+ (async via asyncpg, sync psycopg2 for migrations)
- Package Manager: pip (pyproject.toml)
- Entry Points: `tcgtracker` (server), `tcg-cli` (CLI)

## Frontend (frontend/)
- Language: TypeScript 5.9
- Framework: React 19 + Vite 7
- Styling: Tailwind CSS v4 (oklch dark theme)
- UI: Radix UI + shadcn-style components
- Charts: Recharts
- Package Manager: npm

## Commands

### Backend
- Install: `pip install -e ".[dev]"` (from tcgtracker/)
- Run server: `tcg-cli serve --host 0.0.0.0 --port 8000 --reload`
- Run tests: `pytest`
- Run tests with coverage: `pytest --cov=tcgtracker --cov-report=term-missing`
- Format: `black .` and `isort .`
- Lint: `flake8`
- Type check: `mypy`

### Frontend
- Install: `cd frontend && npm install`
- Dev server: `cd frontend && npm run dev` (port 5173, proxies /api → :8000)
- Build: `cd frontend && npm run build`
- Type check: `cd frontend && npx tsc --noEmit`
- Lint: `cd frontend && npm run lint`

### Full Stack
- Docker: `docker compose up -d`

## API Contract
- Backend serves API at `/api/v1/`
- Frontend proxies `/api` → `localhost:8000` in dev
- Login: `POST /api/v1/auth/login` with `application/x-www-form-urlencoded`
- Register: `POST /api/v1/auth/register` with `application/json`
- Auth: JWT Bearer tokens (access + refresh)
- Card IDs are integers
- Conditions use snake_case (`near_mint`, not `"Near Mint"`)
- Schemas defined in `tcgtracker/src/tcgtracker/api/schemas.py`, mirrored in `frontend/src/types/index.ts`

## Code Style

### Backend
- Black formatting, 88 char line length
- isort with black profile
- MyPy strict mode enabled
- Flake8 max line length 130
- Use async/await throughout
- Pydantic v2 for all schemas and settings
- SQLAlchemy 2.0 style ORM

### Frontend
- Strict TypeScript (erasableSyntaxOnly enabled)
- `@/` path alias for `src/`
- Tailwind v4 `@theme` block for design tokens (no tailwind.config)
- `cn()` for conditional class merging
- Named exports, early returns, small components

## Architecture

### Backend
- Source code in `tcgtracker/src/tcgtracker/`
- API routes in `api/v1/` (auth, cards, collections, prices, search, users)
- Database models in `database/models.py`
- External integrations in `integrations/` (eBay, JustTCG, PriceCharting)
- Config via Pydantic BaseSettings with env prefixes (APP_, DB_, API_, SECURITY_)
- Alembic for database migrations

### Frontend
- Types in `src/types/index.ts` (mirrors backend schemas)
- API client in `src/lib/api.ts` (JWT auto-refresh)
- Auth context in `src/contexts/AuthContext.tsx`
- UI primitives in `src/components/ui/`
- Shared components in `src/components/shared/`
- Pages in `src/pages/`
- Routing in `src/App.tsx`

## Conventions
- Use early returns over nested conditionals
- Environment variables for all config (never hardcode secrets)
- Backend: dependency injection via FastAPI Depends(), schemas in api/schemas.py
- Frontend: Sonner toasts for errors, skeleton loaders for loading states
- Keep API types in sync — update both `schemas.py` and `types/index.ts` together
