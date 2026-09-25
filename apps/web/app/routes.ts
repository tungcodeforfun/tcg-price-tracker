import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("routes/public-layout.tsx", [
    index("routes/home.tsx"),
    route("games", "routes/games.tsx"),
    route("games/:gameId", "routes/game.tsx"),
    route("sets/:setId", "routes/set.tsx"),
    route("cards/:slug", "routes/card.tsx"),
    route("search", "routes/search.tsx"),
  ]),
  route("sitemap.xml", "routes/sitemap-index.ts"),
  route("sitemaps/:section.xml", "routes/sitemap-section.ts"),
  route("robots.txt", "routes/robots.ts"),
  route("api/auth/*", "routes/api.auth.ts"),
  route("api/pv", "routes/api.pv.ts"),
  layout("routes/auth-layout.tsx", [
    route("signup", "routes/signup.tsx"),
    route("login", "routes/login.tsx"),
    route("forgot-password", "routes/forgot-password.tsx"),
    route("reset-password", "routes/reset-password.tsx"),
  ]),
  route("logout", "routes/logout.ts"),
  layout("routes/app-layout.tsx", [
    route("app", "routes/app-home.tsx"),
    route("app/collection", "routes/app-collection.tsx"),
    route("app/add", "routes/app-add.tsx"),
    route("app/items/:itemId", "routes/app-item.tsx"),
    route("app/sales", "routes/app-sales.tsx"),
    route("app/import", "routes/app-import.tsx"),
    route("app/alerts", "routes/app-alerts.tsx"),
    route("app/alerts/new", "routes/app-alert-new.tsx"),
    route("app/alerts/:alertId", "routes/app-alert.tsx"),
    route("app/feedback", "routes/app-feedback.tsx"),
  ]),
  route("app/export/holdings.csv", "routes/app-export-holdings.ts"),
  route("app/export/sales.csv", "routes/app-export-sales.ts"),
] satisfies RouteConfig;
