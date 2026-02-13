import type {
  Card,
  CardSearchParams,
  CollectionItem,
  CollectionItemCreate,
  CollectionItemUpdate,
  CollectionStats,
  PasswordChange,
  PriceAlert,
  PriceAlertCreate,
  PriceHistory,
  PriceTrendsResponse,
  SearchAllResponse,
  SearchRequest,
  SearchResult,
  TokenResponse,
  User,
  UserStats,
  UserUpdate,
  ValueHistoryResponse,
  TCGType,
  CardCondition,
  PriceSource,
} from "@/types";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

function getAccessToken(): string | null {
  return localStorage.getItem("access_token");
}

function getRefreshToken(): string | null {
  return localStorage.getItem("refresh_token");
}

function setTokens(tokens: TokenResponse) {
  localStorage.setItem("access_token", tokens.access_token);
  localStorage.setItem("refresh_token", tokens.refresh_token);
}

function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = doRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function doRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      return false;
    }

    const tokens: TokenResponse = await res.json();
    setTokens(tokens);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (!headers["Content-Type"] && !(options.body instanceof URLSearchParams)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiFetch<T>(path, options, false);
    }
    clearTokens();
    throw new ApiError(401, "Session expired");
  }

  if (res.status === 204) {
    return undefined as T;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(
      res.status,
      typeof body.detail === "string"
        ? body.detail
        : JSON.stringify(body.detail),
    );
  }

  return res.json();
}

// Auth
export const authApi = {
  login(username: string, password: string) {
    const body = new URLSearchParams({ username, password });
    return apiFetch<TokenResponse>("/auth/login", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  },

  register(email: string, username: string, password: string) {
    return apiFetch<User>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, username, password }),
    });
  },

  refresh() {
    return refreshAccessToken();
  },
};

// Users
export const usersApi = {
  getMe() {
    return apiFetch<User>("/users/me");
  },

  updateProfile(data: UserUpdate) {
    return apiFetch<User>("/users/me", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  changePassword(data: PasswordChange) {
    return apiFetch<User>("/users/me/password", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  getStats() {
    return apiFetch<UserStats>("/users/stats");
  },

  getAlerts(activeOnly = false) {
    return apiFetch<PriceAlert[]>(
      `/users/alerts?active_only=${activeOnly}`,
    );
  },

  createAlert(data: PriceAlertCreate) {
    return apiFetch<PriceAlert>("/users/alerts", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  toggleAlert(alertId: number) {
    return apiFetch<PriceAlert>(`/users/alerts/${alertId}/toggle`, {
      method: "PUT",
    });
  },

  deleteAlert(alertId: number) {
    return apiFetch<void>(`/users/alerts/${alertId}`, {
      method: "DELETE",
    });
  },
};

// Cards
export const cardsApi = {
  list(params?: {
    tcg_type?: TCGType;
    set_name?: string;
    rarity?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value != null) searchParams.set(key, String(value));
      });
    }
    const qs = searchParams.toString();
    return apiFetch<Card[]>(`/cards${qs ? `?${qs}` : ""}`);
  },

  getById(cardId: number) {
    return apiFetch<Card>(`/cards/${cardId}`);
  },

  search(params: CardSearchParams) {
    return apiFetch<Card[]>("/cards/search", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },
};

// Collections
export const collectionsApi = {
  getItems(params?: {
    tcg_type?: TCGType;
    condition?: CardCondition;
    limit?: number;
    offset?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value != null) searchParams.set(key, String(value));
      });
    }
    const qs = searchParams.toString();
    return apiFetch<CollectionItem[]>(
      `/collections/items${qs ? `?${qs}` : ""}`,
    );
  },

  getItem(itemId: number) {
    return apiFetch<CollectionItem>(`/collections/items/${itemId}`);
  },

  addItem(data: CollectionItemCreate) {
    return apiFetch<CollectionItem>("/collections/items", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateItem(itemId: number, data: CollectionItemUpdate) {
    return apiFetch<CollectionItem>(`/collections/items/${itemId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  deleteItem(itemId: number) {
    return apiFetch<void>(`/collections/items/${itemId}`, {
      method: "DELETE",
    });
  },

  getStats(tcgType?: TCGType) {
    const qs = tcgType ? `?tcg_type=${tcgType}` : "";
    return apiFetch<CollectionStats>(`/collections/stats${qs}`);
  },

  getValueHistory(days = 30) {
    return apiFetch<ValueHistoryResponse>(
      `/collections/value-history?days=${days}`,
    );
  },
};

// Prices
export const pricesApi = {
  getHistory(cardId: number, days = 30, source?: PriceSource) {
    const params = new URLSearchParams({ days: String(days) });
    if (source) params.set("source", source);
    return apiFetch<PriceHistory>(`/prices/card/${cardId}?${params}`);
  },

  updatePrice(cardId: number, source: PriceSource = "pricecharting") {
    return apiFetch<unknown>(`/prices/update/${cardId}?source=${source}`, {
      method: "POST",
    });
  },

  getTrends(tcgType?: string, days = 7) {
    const params = new URLSearchParams({ days: String(days) });
    if (tcgType) params.set("tcg_type", tcgType);
    return apiFetch<PriceTrendsResponse>(`/prices/trends?${params}`);
  },
};

// Search
export const searchApi = {
  searchAll(data: SearchRequest) {
    return apiFetch<SearchAllResponse>("/search/all", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  searchTCGPlayer(data: SearchRequest) {
    return apiFetch<SearchResult[]>("/search/tcgplayer", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  searchEbay(data: SearchRequest) {
    return apiFetch<SearchResult[]>("/search/ebay", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  searchPriceCharting(data: SearchRequest) {
    return apiFetch<SearchResult[]>("/search/pricecharting", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  searchJustTCG(data: SearchRequest) {
    return apiFetch<SearchResult[]>("/search/justtcg", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  importCard(data: SearchResult) {
    return apiFetch<Card>("/search/import", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getSuggestions(query: string, tcgType?: string, limit = 10) {
    const params = new URLSearchParams({ query, limit: String(limit) });
    if (tcgType) params.set("tcg_type", tcgType);
    return apiFetch<string[]>(`/search/suggestions?${params}`);
  },
};

export { setTokens, clearTokens, getAccessToken, ApiError };
