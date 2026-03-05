import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  authApi,
  usersApi,
  cardsApi,
  collectionsApi,
  pricesApi,
  searchApi,
  setTokens,
  clearTokens,
  getAccessToken,
  ApiError,
} from "../api";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    json: () => Promise.resolve(body),
  });
}

function emptyResponse(status = 204) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: "No Content",
    json: () => Promise.resolve({}),
  });
}

beforeEach(() => {
  localStorage.clear();
  mockFetch.mockReset();
});

afterEach(() => {
  localStorage.clear();
});

describe("token management", () => {
  it("stores and retrieves tokens", () => {
    setTokens({
      access_token: "abc",
      refresh_token: "def",
      token_type: "bearer",
    });
    expect(getAccessToken()).toBe("abc");
    expect(localStorage.getItem("refresh_token")).toBe("def");
  });

  it("clears tokens", () => {
    setTokens({
      access_token: "abc",
      refresh_token: "def",
      token_type: "bearer",
    });
    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
  });
});

describe("ApiError", () => {
  it("has status and message", () => {
    const err = new ApiError(404, "Not found");
    expect(err.status).toBe(404);
    expect(err.message).toBe("Not found");
    expect(err.name).toBe("ApiError");
  });
});

describe("authApi", () => {
  it("login sends form-encoded body", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        access_token: "tok",
        refresh_token: "ref",
        token_type: "bearer",
      }),
    );

    const result = await authApi.login("user", "pass");
    expect(result.access_token).toBe("tok");

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/auth/login");
    expect(opts.headers["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(opts.body.toString()).toContain("username=user");
  });

  it("register sends JSON body", async () => {
    const mockUser = {
      id: 1,
      email: "a@b.com",
      username: "user1",
      is_active: true,
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    };
    mockFetch.mockReturnValueOnce(jsonResponse(mockUser));

    const result = await authApi.register("a@b.com", "user1", "pass123");
    expect(result.username).toBe("user1");

    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.email).toBe("a@b.com");
    expect(body.username).toBe("user1");
    expect(body.password).toBe("pass123");
  });
});

describe("apiFetch behavior", () => {
  it("attaches Authorization header when token exists", async () => {
    setTokens({
      access_token: "mytoken",
      refresh_token: "ref",
      token_type: "bearer",
    });
    mockFetch.mockReturnValueOnce(jsonResponse({ id: 1 }));

    await usersApi.getMe();

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers["Authorization"]).toBe("Bearer mytoken");
  });

  it("throws ApiError on non-ok response", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({ detail: "Bad request" }, 400),
    );

    await expect(usersApi.getMe()).rejects.toThrow(ApiError);
  });

  it("ApiError includes status and detail message", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({ detail: "Not found" }, 404),
    );

    try {
      await usersApi.getMe();
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(404);
      expect((e as ApiError).message).toBe("Not found");
    }
  });

  it("handles 204 No Content", async () => {
    setTokens({
      access_token: "tok",
      refresh_token: "ref",
      token_type: "bearer",
    });
    mockFetch.mockReturnValueOnce(emptyResponse(204));

    const result = await collectionsApi.deleteItem(1);
    expect(result).toBeUndefined();
  });

  it("attempts token refresh on 401 then retries", async () => {
    setTokens({
      access_token: "expired",
      refresh_token: "valid_refresh",
      token_type: "bearer",
    });

    // First call: 401
    mockFetch.mockReturnValueOnce(jsonResponse({ detail: "Unauthorized" }, 401));
    // Refresh call: success
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        access_token: "new_tok",
        refresh_token: "new_ref",
        token_type: "bearer",
      }),
    );
    // Retry call: success
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        id: 1,
        email: "a@b.com",
        username: "user",
        is_active: true,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      }),
    );

    const result = await usersApi.getMe();
    expect(result.username).toBe("user");
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(getAccessToken()).toBe("new_tok");
  });

  it("clears tokens and throws on 401 when refresh fails", async () => {
    setTokens({
      access_token: "expired",
      refresh_token: "bad_refresh",
      token_type: "bearer",
    });

    // First call: 401
    mockFetch.mockReturnValueOnce(jsonResponse({ detail: "Unauthorized" }, 401));
    // Refresh call: fails
    mockFetch.mockReturnValueOnce(jsonResponse({ detail: "Invalid" }, 401));

    await expect(usersApi.getMe()).rejects.toThrow("Session expired");
    expect(getAccessToken()).toBeNull();
  });
});

describe("cardsApi", () => {
  beforeEach(() => {
    setTokens({
      access_token: "tok",
      refresh_token: "ref",
      token_type: "bearer",
    });
  });

  it("list builds query string from params", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse([]));

    await cardsApi.list({ tcg_type: "pokemon", limit: 10 });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("tcg_type=pokemon");
    expect(url).toContain("limit=10");
  });

  it("list sends no query string without params", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse([]));

    await cardsApi.list();

    const [url] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/cards$/);
  });

  it("getById fetches specific card", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ id: 42, name: "Pikachu" }));

    const result = await cardsApi.getById(42);
    expect(result.name).toBe("Pikachu");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/cards/42");
  });

  it("search sends POST with params", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse([]));

    await cardsApi.search({ query: "charizard", tcg_type: "pokemon" });

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/cards/search");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body).query).toBe("charizard");
  });
});

describe("collectionsApi", () => {
  beforeEach(() => {
    setTokens({
      access_token: "tok",
      refresh_token: "ref",
      token_type: "bearer",
    });
  });

  it("addItem sends POST with JSON body", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({ id: 1, card_id: 10, quantity: 2 }),
    );

    await collectionsApi.addItem({
      card_id: 10,
      quantity: 2,
      condition: "near_mint",
    });

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/collections/items");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body).card_id).toBe(10);
  });

  it("updateItem sends PUT", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ id: 1, quantity: 5 }));

    await collectionsApi.updateItem(1, { quantity: 5 });

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/collections/items/1");
    expect(opts.method).toBe("PUT");
  });

  it("getStats appends tcg_type query param", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({ total_cards: 10, total_value: 100 }),
    );

    await collectionsApi.getStats("pokemon");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("tcg_type=pokemon");
  });

  it("getValueHistory defaults to 30 days", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ days: 30, history: [] }));

    await collectionsApi.getValueHistory();

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("days=30");
  });
});

describe("pricesApi", () => {
  beforeEach(() => {
    setTokens({
      access_token: "tok",
      refresh_token: "ref",
      token_type: "bearer",
    });
  });

  it("getHistory includes days and optional source", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({ card_id: 1, prices: [], average_price: null }),
    );

    await pricesApi.getHistory(1, 14, "tcgplayer");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/prices/card/1");
    expect(url).toContain("days=14");
    expect(url).toContain("source=tcgplayer");
  });

  it("getTrends includes tcg_type and days", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({ period_days: 7, trends: {} }),
    );

    await pricesApi.getTrends("pokemon", 7);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("tcg_type=pokemon");
    expect(url).toContain("days=7");
  });
});

describe("searchApi", () => {
  beforeEach(() => {
    setTokens({
      access_token: "tok",
      refresh_token: "ref",
      token_type: "bearer",
    });
  });

  it("searchAll sends POST to /search/all", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        tcgplayer: [],
        ebay: [],
        pricecharting: [],
        justtcg: [],
        errors: [],
      }),
    );

    await searchApi.searchAll({ query: "pikachu", tcg_type: "pokemon" });

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/search/all");
    expect(opts.method).toBe("POST");
  });

  it("importCard sends POST to /search/import", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ id: 1, name: "Pikachu" }));

    await searchApi.importCard({
      external_id: "ext-1",
      name: "Pikachu",
      set_name: "Base Set",
      tcg_type: "pokemon",
      price: 10.0,
      image_url: null,
      source: "tcgplayer",
      listing_url: null,
    });

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/search/import");
    expect(opts.method).toBe("POST");
  });

  it("getSuggestions builds query params", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse(["pikachu", "pikachu vmax"]));

    await searchApi.getSuggestions("pika", "pokemon", 5);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("query=pika");
    expect(url).toContain("tcg_type=pokemon");
    expect(url).toContain("limit=5");
  });
});
