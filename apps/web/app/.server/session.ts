import { redirect } from "react-router";
import { auth, type Session } from "./auth.ts";

export async function getSession(request: Request): Promise<Session | null> {
  return auth.api.getSession({ headers: request.headers });
}

export async function requireSession(request: Request): Promise<Session> {
  const session = await getSession(request);
  if (!session) {
    const url = new URL(request.url);
    throw redirect(`/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
  }
  return session;
}
