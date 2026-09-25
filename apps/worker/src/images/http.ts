import { setTimeout as delay } from "node:timers/promises";

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const USER_AGENT = "tcg-price-tracker-worker (card image sync)";
const TIMEOUT_MS = 30_000;

/** GETs JSON one request at a time, waiting `gapMs` after each response, and counts requests. */
export class JsonClient {
  requestCount = 0;
  readonly #fetch: Fetch;
  readonly #gapMs: number;
  #readyAt = 0;

  constructor({ fetch: fetchJson = fetch, gapMs }: { fetch?: Fetch; gapMs: number }) {
    this.#fetch = fetchJson;
    this.#gapMs = gapMs;
  }

  async get<T>(url: string): Promise<T> {
    const wait = this.#readyAt - Date.now();
    if (wait > 0) await delay(wait);
    this.requestCount += 1;
    try {
      const response = await this.#fetch(url, {
        headers: { accept: "application/json", "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status}`);
      return (await response.json()) as T;
    } finally {
      this.#readyAt = Date.now() + this.#gapMs;
    }
  }
}

/** In-memory cache whose entries expire; `ttlMs` may depend on the loaded value. */
export class TtlCache {
  readonly #entries = new Map<string, { value: unknown; expiresAt: number }>();

  async get<T>(
    key: string,
    ttlMs: number | ((value: T) => number),
    load: () => Promise<T>,
  ): Promise<T> {
    const hit = this.#entries.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value as T;
    const value = await load();
    const ttl = typeof ttlMs === "number" ? ttlMs : ttlMs(value);
    this.#entries.set(key, { value, expiresAt: Date.now() + ttl });
    return value;
  }
}
