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
  layout("routes/auth-layout.tsx", [
    route("signup", "routes/signup.tsx"),
    route("login", "routes/login.tsx"),
    route("forgot-password", "routes/forgot-password.tsx"),
    route("reset-password", "routes/reset-password.tsx"),
  ]),
  route("logout", "routes/logout.ts"),
  layout("routes/app-layout.tsx", [route("app", "routes/app-home.tsx")]),
] satisfies RouteConfig;
