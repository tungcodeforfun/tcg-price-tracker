import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  JustTcgClient,
  JustTcgError,
  QuotaExhaustedError,
  type JustTcgPlan,
  type ProviderUsage,
  type UsageStore,
} from "../src/index.ts";

type Fixture = Record<string, unknown> & { _metadata: Record<string, unknown> };

const fixture = (name: string): Fixture =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8")) as Fixture;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

class MemoryUsageStore implements UsageStore {
  usage: ProviderUsage | null;
  constructor(usage: ProviderUsage | null = null) {
    this.usage = usage;
  }
  async load() {
    return this.usage;
  }
  async save(usage: ProviderUsage) {
    this.usage = usage;
  }
}

function usage(overrides: Partial<ProviderUsage>): ProviderUsage {
  return {
    plan: "Free Tier",
    monthlyLimit: 1000,
    monthlyUsed: 0,
    dailyLimit: 100,
    dailyUsed: 0,
    perMinuteLimit: 10,
    reportedAt: new Date("2026-09-25T00:00:00Z"),
    ...overrides,
  };
}

/** Client wired to a scripted fetch and a virtual clock that only advances when the client sleeps. */
function setup(options: {
  responses: (() => Response)[];
  plan?: JustTcgPlan;
  stored?: ProviderUsage | null;
  now?: string;
}) {
  let clock = new Date(options.now ?? "2026-09-25T12:00:00Z").getTime();
  const requests: { url: URL; headers: Headers; at: number }[] = [];
  const sleeps: number[] = [];
  const queue = [...options.responses];
  const store = new MemoryUsageStore(options.stored ?? null);
  const client = new JustTcgClient({
    apiKey: "test-key",
    plan: options.plan ?? "free",
    usageStore: store,
    now: () => new Date(clock),
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    fetch: async (input, init) => {
      requests.push({
        url: new URL(String(input)),
        headers: new Headers(init?.headers),
        at: clock,
      });
      const next = queue.shift();
      if (!next) throw new Error("unexpected request");
      return next();
    },
  });
  return {
    client,
    store,
    requests,
    sleeps,
    advance: (ms: number) => {
      clock += ms;
    },
    setClock: (iso: string) => {
      clock = new Date(iso).getTime();
    },
  };
}

describe("JustTcgClient mapping", () => {
  it("maps a cards page from the recorded fixture", async () => {
    const { client, requests } = setup({ responses: [() => json(fixture("cards-mcd2014-p0"))] });

    const page = await client.listCardsPage({
      gameId: "pokemon",
      setId: "mcdonald-s-promos-2014-pokemon",
      offset: 0,
    });

    const request = requests[0];
    expect(request?.url.pathname).toBe("/v1/cards");
    expect(Object.fromEntries(request?.url.searchParams ?? [])).toEqual({
      game: "pokemon",
      set: "mcdonald-s-promos-2014-pokemon",
      limit: "20",
      offset: "0",
      priceHistoryDuration: "30d",
    });
    expect(request?.headers.get("x-api-key")).toBe("test-key");

    expect(page.total).toBe(12);
    expect(page.hasMore).toBe(false);
    expect(page.cards).toHaveLength(12);
    const pikachu = page.cards[0];
    expect(pikachu).toMatchObject({
      id: "bb155dcc-5741-5f15-b6da-923e7a1044fe",
      slug: "pokemon-mcdonald-s-promos-2014-pikachu-5-12-promo",
      gameId: "pokemon",
      setId: "mcdonald-s-promos-2014-pokemon",
      name: "Pikachu - 5/12",
      number: "005/012",
      rarity: "Promo",
      tcgplayerId: "110410",
      details: null,
    });
    expect(pikachu?.variants[0]).toEqual({
      id: "3675f55e-9d52-50c3-b3f7-3526a86c6434",
      condition: "Near Mint",
      printing: "Holofoil",
      language: "English",
      tcgplayerSkuId: "3040264",
      priceCents: 4277,
      priceChange7dPct: 1.21,
      priceUpdatedAt: new Date("2026-09-25T02:00:52Z"),
      history: [
        { day: "2026-09-19", priceCents: 4226 },
        { day: "2026-09-20", priceCents: 4226 },
        { day: "2026-09-21", priceCents: 4226 },
        { day: "2026-09-22", priceCents: 4226 },
        { day: "2026-09-23", priceCents: 4253 },
        { day: "2026-09-24", priceCents: 4277 },
        { day: "2026-09-25", priceCents: 4277 },
      ],
    });
    // 16.6 * 100 is 1659.9999999999998 in floating point.
    expect(pikachu?.variants[2]?.priceCents).toBe(1660);
  });

  it("keeps the latest point per UTC day in ascending order and nulls missing optional fields", async () => {
    const body = fixture("cards-mcd2014-p0") as Fixture & { data: Record<string, unknown>[] };
    const card = body.data[0] as { variants: Record<string, unknown>[] } & Record<string, unknown>;
    const day = (iso: string) => new Date(iso).getTime() / 1000;
    card.variants = [
      {
        ...card.variants[0],
        tcgplayerSkuId: null,
        price: null,
        lastUpdated: null,
        priceChange7d: null,
        priceHistory: [
          { p: 3, t: day("2026-09-24T08:00:00Z") },
          { p: 1.5, t: day("2026-09-23T23:59:59Z") },
          { p: 1, t: day("2026-09-23T00:00:00Z") },
          { p: 2, t: day("2026-09-24T01:00:00Z") },
        ],
      },
    ];
    delete card.number;
    delete card.rarity;
    body.data = [card];
    const { client } = setup({ responses: [() => json(body)] });

    const [mapped] = (await client.listCardsPage({ gameId: "pokemon", setId: "x", offset: 0 }))
      .cards;

    expect(mapped).toMatchObject({ number: null, rarity: null });
    expect(mapped?.variants[0]).toMatchObject({
      tcgplayerSkuId: null,
      priceCents: null,
      priceUpdatedAt: null,
      priceChange7dPct: null,
      history: [
        { day: "2026-09-23", priceCents: 150 },
        { day: "2026-09-24", priceCents: 300 },
      ],
    });
  });

  it("sends the plan's page size and offset and reports pagination fields", async () => {
    const body = {
      ...fixture("cards-mcd2014-p0"),
      meta: { total: 245, limit: 100, offset: 100, hasMore: true },
    };
    const { client, requests } = setup({ plan: "starter", responses: [() => json(body)] });

    expect(client.cardsPerRequest).toBe(100);
    const page = await client.listCardsPage({ gameId: "pokemon", setId: "s", offset: 100 });

    expect(requests[0]?.url.searchParams.get("limit")).toBe("100");
    expect(requests[0]?.url.searchParams.get("offset")).toBe("100");
    expect(page).toMatchObject({ total: 245, hasMore: true });
  });

  it("maps games and sets, normalizing release dates", async () => {
    const { client, requests } = setup({
      responses: [() => json(fixture("games")), () => json(fixture("sets-pokemon"))],
    });

    const games = await client.listGames();
    const sets = await client.listSets("pokemon");

    expect(games[0]).toEqual({
      id: "cyberpunk-tcg",
      name: "Cyberpunk TCG",
      cardsCount: 419,
      setsCount: 10,
    });
    expect(requests[1]?.url.searchParams.get("game")).toBe("pokemon");
    expect(sets).toHaveLength(218);
    expect(sets.find((s) => s.id === "alternate-art-promos-pokemon")?.releaseDate).toBeNull();
    expect(sets.find((s) => s.id === "aquapolis-pokemon")).toEqual({
      id: "aquapolis-pokemon",
      gameId: "pokemon",
      name: "Aquapolis",
      releaseDate: "2003-01-15",
      cardsCount: 186,
    });
  });
});

describe("JustTcgClient quota guard", () => {
  it("blocks within the daily reserve on the same UTC day and allows the next day", async () => {
    const stored = usage({ dailyUsed: 95, reportedAt: new Date("2026-09-25T01:00:00Z") });
    const { client, requests, setClock } = setup({
      stored,
      now: "2026-09-25T23:59:00Z",
      responses: [() => json(fixture("games"))],
    });

    const blocked = client.listGames();
    await expect(blocked).rejects.toBeInstanceOf(QuotaExhaustedError);
    await expect(blocked).rejects.toMatchObject({ usage: stored });
    expect(requests).toHaveLength(0);
    expect(client.requestCount).toBe(0);

    setClock("2026-09-26T00:01:00Z");
    await expect(client.listGames()).resolves.toHaveLength(20);
  });

  it("allows spending down to the reserve", async () => {
    const { client } = setup({
      stored: usage({ dailyUsed: 94, monthlyUsed: 979 }),
      responses: [() => json(fixture("games"))],
    });

    await expect(client.listGames()).resolves.toHaveLength(20);
  });

  it("blocks within the monthly reserve for the rest of the UTC month", async () => {
    const stored = usage({
      monthlyUsed: 980,
      dailyUsed: 3,
      reportedAt: new Date("2026-09-02T10:00:00Z"),
    });
    const { client, requests, setClock } = setup({
      stored,
      responses: [() => json(fixture("games"))],
    });

    await expect(client.listGames()).rejects.toBeInstanceOf(QuotaExhaustedError);
    expect(requests).toHaveLength(0);

    setClock("2026-10-01T00:00:00Z");
    await expect(client.listGames()).resolves.toHaveLength(20);
  });

  it("honors custom reserves", async () => {
    const strict = new JustTcgClient({
      apiKey: "k",
      plan: "free",
      usageStore: new MemoryUsageStore(usage({ dailyUsed: 90 })),
      now: () => new Date("2026-09-25T12:00:00Z"),
      dailyReserve: 10,
      fetch: async () => json(fixture("games")),
    });

    await expect(strict.listGames()).rejects.toBeInstanceOf(QuotaExhaustedError);
  });

  it("saves usage reported in _metadata", async () => {
    const { client, store } = setup({
      now: "2026-09-25T12:34:56Z",
      responses: [() => json(fixture("games"))],
    });

    await client.listGames();

    expect(store.usage).toEqual({
      plan: "Free Tier",
      monthlyLimit: 1000,
      monthlyUsed: 3,
      dailyLimit: 100,
      dailyUsed: 3,
      perMinuteLimit: 10,
      reportedAt: new Date("2026-09-25T12:34:56Z"),
    });
  });
});

describe("JustTcgClient rate limiting and errors", () => {
  it("retries a 429 after the Retry-After delay", async () => {
    const { client, sleeps } = setup({
      responses: [
        () =>
          json({ error: "Too many requests", code: "RATE_LIMITED" }, 429, { "retry-after": "7" }),
        () => json(fixture("games")),
      ],
    });

    await expect(client.listGames()).resolves.toHaveLength(20);
    expect(sleeps).toEqual([7000]);
    expect(client.requestCount).toBe(2);
  });

  it("backs off 60s without Retry-After and gives up after 3 retries", async () => {
    const tooMany = () => json({ error: "Too many requests", code: "RATE_LIMITED" }, 429);
    const { client, sleeps } = setup({ responses: [tooMany, tooMany, tooMany, tooMany] });

    const failure = client.listGames();
    await expect(failure).rejects.toBeInstanceOf(JustTcgError);
    await expect(failure).rejects.toMatchObject({ status: 429, code: "RATE_LIMITED" });
    expect(sleeps).toEqual([60_000, 60_000, 60_000]);
    expect(client.requestCount).toBe(4);
  });

  it("waits for the rolling minute window once the per-minute limit is used", async () => {
    const limited = () => {
      const body = fixture("games");
      body._metadata.apiRateLimit = 2;
      return json(body);
    };
    const { client, requests, sleeps, advance } = setup({ responses: [limited, limited, limited] });

    await client.listGames();
    advance(10_000);
    await client.listGames();
    await client.listGames();

    expect(sleeps).toEqual([50_000]);
    const [first, , third] = requests;
    expect((third?.at ?? 0) - (first?.at ?? 0)).toBe(60_000);
  });

  it("falls back to the plan's per-minute limit when no usage is stored", async () => {
    const noMetadata = () => json({ data: [] });
    const { client, sleeps } = setup({ responses: Array.from({ length: 11 }, () => noMetadata) });

    for (let i = 0; i < 10; i++) await client.listGames();
    expect(sleeps).toEqual([]);
    await client.listGames();
    expect(sleeps).toEqual([60_000]);
  });

  it("throws JustTcgError with the API error code for other non-2xx responses", async () => {
    const { client, sleeps } = setup({
      responses: [() => json({ error: "Invalid API key", code: "INVALID_API_KEY" }, 401)],
    });

    const failure = client.listGames();
    await expect(failure).rejects.toBeInstanceOf(JustTcgError);
    await expect(failure).rejects.toMatchObject({
      message: "Invalid API key",
      status: 401,
      code: "INVALID_API_KEY",
    });
    expect(sleeps).toEqual([]);
    expect(client.requestCount).toBe(1);
  });
});
