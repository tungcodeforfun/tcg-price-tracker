# TCG Price Tracker Frontend

## Project
- Language: TypeScript 5.9
- Framework: React 19 + Vite 7
- Styling: Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- UI Primitives: Radix UI + shadcn-style components
- Charts: Recharts
- Routing: React Router v7
- Toasts: Sonner
- Package Manager: npm

## Commands
- Install: `npm install`
- Dev server: `npm run dev` (port 5173, proxies `/api` → localhost:8000)
- Build: `npm run build`
- Type check: `npx tsc --noEmit`
- Lint: `npm run lint`
- Preview prod build: `npm run preview`

## Architecture
- `src/types/index.ts` — all TypeScript interfaces (mirrors backend Pydantic schemas)
- `src/lib/api.ts` — fetch-based API client with JWT auto-refresh
- `src/lib/utils.ts` — `cn()`, formatters, condition label map
- `src/contexts/AuthContext.tsx` — auth state, login/register/logout
- `src/components/ui/` — shadcn-style primitives (button, card, dialog, select, tabs, etc.)
- `src/components/shared/` — Sidebar, TopBar, Layout, TCGCard, modals, skeletons
- `src/pages/` — Landing, Dashboard, SearchPage, CardDetail, Collection, Alerts, Profile, NotFound
- `src/App.tsx` — router config with protected routes

## Code Style
- Strict TypeScript (`erasableSyntaxOnly` enabled — no parameter properties)
- `@/` path alias for `src/`
- Tailwind v4 `@theme` block in `index.css` for design tokens (no tailwind.config)
- Dark theme only (oklch color space)
- Use `cn()` from `lib/utils` for conditional class merging
- Prefer early returns, small components, named exports

## API Conventions
- Base URL: `/api/v1` (proxied to backend in dev)
- Login sends `application/x-www-form-urlencoded` (OAuth2PasswordRequestForm)
- Register sends `application/json`
- Card IDs are `number`, not string
- Conditions are snake_case (`near_mint`, not `"Near Mint"`)
- Alert create and response both use `target_price` (mapped from DB `price_threshold`)
- Tokens stored in localStorage (`access_token`, `refresh_token`)
- 401 responses trigger automatic token refresh + retry

## Git
- Do not include Co-Authored-By lines in commit messages

## Conventions
- UI components in `components/ui/` follow shadcn patterns (forwardRef, CVA variants)
- Shared components in `components/shared/` are app-specific composites
- Pages fetch data in `useEffect`, show skeleton loaders while loading
- Error handling via Sonner toasts
- `null` image URLs converted to `undefined` when passed to `<img>` src props
- Recharts tooltip formatters use `any` parameter types for compatibility
