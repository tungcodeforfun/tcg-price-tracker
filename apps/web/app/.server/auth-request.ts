import { auth } from "./auth.ts";
import { env } from "./env.ts";

const FORWARDED_HEADERS = ["cookie", "user-agent", "fly-client-ip"];

export interface AuthResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  errorCode: string | null;
  headers: Headers;
}

/**
 * Sends a form submission through Better Auth's HTTP handler rather than `auth.api`,
 * so its rate limits and origin checks apply exactly as they do to direct API calls.
 */
export async function callAuth<T = unknown>(
  request: Request,
  path: string,
  body: Record<string, unknown>,
): Promise<AuthResult<T>> {
  const headers = new Headers({ "content-type": "application/json", origin: env.appUrl });
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const response = await auth.handler(
    new Request(new URL(`/api/auth${path}`, env.appUrl), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
  const json = (await response.json().catch(() => null)) as (T & { code?: string }) | null;
  const outHeaders = new Headers();
  for (const cookie of response.headers.getSetCookie()) outHeaders.append("set-cookie", cookie);
  return {
    ok: response.ok,
    status: response.status,
    data: response.ok ? json : null,
    errorCode: response.ok ? null : (json?.code ?? null),
    headers: outHeaders,
  };
}

export function authErrorMessage(result: AuthResult): string {
  if (result.status === 429) return "Too many attempts. Wait a minute and try again.";
  switch (result.errorCode) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Wrong email or password.";
    case "EMAIL_NOT_VERIFIED":
      return "Verify your email first. We just sent you a new link.";
    case "PASSWORD_TOO_SHORT":
      return "Password must be at least 10 characters.";
    case "PASSWORD_TOO_LONG":
      return "Password is too long.";
    case "INVALID_EMAIL":
      return "Enter a valid email address.";
    case "INVALID_TOKEN":
      return "This link is invalid or has expired. Request a new one.";
    default:
      return "Something went wrong. Try again.";
  }
}
