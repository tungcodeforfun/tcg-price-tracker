import { isbot } from "isbot";
import { recordPageView } from "~/.server/catalog";
import { db } from "~/.server/db";
import type { Route } from "./+types/api.pv";

const MAX_BODY_BYTES = 1024;

/** Reads at most `MAX_BODY_BYTES`, so a missing or false Content-Length can't make us buffer more. */
async function readCappedBody(request: Request): Promise<string | null> {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    size += chunk.value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(chunk.value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function parsePath(body: string, contentType: string): unknown {
  if (contentType.includes("application/json")) {
    try {
      return (JSON.parse(body) as { path?: unknown } | null)?.path;
    } catch {
      return null;
    }
  }
  return new URLSearchParams(body).get("path");
}

/** The page-view beacon from root.tsx. Always 204, so it reveals nothing and never retries. */
export async function action({ request }: Route.ActionArgs) {
  if (!isbot(request.headers.get("user-agent"))) {
    const body = await readCappedBody(request);
    const path = body && parsePath(body, request.headers.get("content-type") ?? "");
    if (typeof path === "string") await recordPageView(db, path);
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
