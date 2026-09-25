import { redirect } from "react-router";
import { callAuth } from "~/.server/auth-request";
import type { Route } from "./+types/logout";

export const loader = () => redirect("/");

export async function action({ request }: Route.ActionArgs) {
  const result = await callAuth(request, "/sign-out", {});
  return redirect("/", { headers: result.headers });
}
