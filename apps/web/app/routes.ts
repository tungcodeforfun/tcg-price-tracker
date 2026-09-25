import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
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
