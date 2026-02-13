export type TCGType = "pokemon" | "onepiece";

export type CardCondition =
  | "mint"
  | "near_mint"
  | "lightly_played"
  | "moderately_played"
  | "heavily_played"
  | "damaged"
  | "poor";

export type PriceSource =
  | "tcgplayer"
  | "ebay"
  | "cardmarket"
  | "justtcg"
  | "pricecharting"
  | "manual";

export type AlertType = "above" | "below";

// Auth
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// User
export interface User {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserUpdate {
  email?: string;
  username?: string;
}

export interface PasswordChange {
  current_password: string;
  new_password: string;
}

// Card
export interface Card {
  id: number;
  tcg_type: TCGType;
  name: string;
  set_name: string;
  card_number: string | null;
  rarity: string | null;
  external_id: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  latest_price: number | null;
  price_trend: string | null;
}

export interface CardSearchParams {
  query?: string;
  tcg_type?: TCGType;
  set_name?: string;
  rarity?: string;
  min_price?: number;
  max_price?: number;
  limit?: number;
  offset?: number;
}

// Price
export interface PriceEntry {
  id: number;
  card_id: number;
  source: PriceSource;
  market_price: number;
  currency: string;
  condition: CardCondition;
  timestamp: string;
}

export interface PriceHistory {
  card_id: number;
  prices: PriceEntry[];
  average_price: number | null;
  min_price: number | null;
  max_price: number | null;
  trend: string | null;
}

// Collection
export interface CollectionItem {
  id: number;
  user_id: number;
  card_id: number;
  quantity: number;
  condition: CardCondition;
  purchase_price: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  card: Card | null;
  current_value: number | null;
}

export interface CollectionItemCreate {
  card_id: number;
  quantity?: number;
  condition?: CardCondition;
  purchase_price?: number;
  notes?: string;
}

export interface CollectionItemUpdate {
  quantity?: number;
  condition?: CardCondition;
  purchase_price?: number;
  notes?: string;
}

export interface CollectionStats {
  total_cards: number;
  unique_cards: number;
  total_value: number;
  total_invested: number;
  profit_loss: number;
  profit_loss_percentage: number;
}

export interface ValueHistoryPoint {
  date: string;
  value: number;
}

export interface ValueHistoryResponse {
  days: number;
  history: ValueHistoryPoint[];
  current_value: number;
  change: number;
  change_percentage: number;
}

// Price Alerts
export interface PriceAlertCreate {
  card_id: number;
  target_price: number;
  alert_type: AlertType;
  is_active?: boolean;
}

export interface PriceAlert {
  id: number;
  user_id: number;
  card_id: number;
  price_threshold: number;
  alert_type: AlertType;
  is_active: boolean;
  last_triggered: string | null;
  created_at: string;
  card: Card | null;
}

// Search
export interface SearchRequest {
  query: string;
  tcg_type?: TCGType;
  source?: PriceSource;
  limit?: number;
}

export interface SearchResult {
  external_id: string;
  name: string;
  set_name: string;
  tcg_type: TCGType;
  price: number | null;
  image_url: string | null;
  source: PriceSource;
  listing_url: string | null;
}

export interface SearchAllResponse {
  tcgplayer: SearchResult[];
  ebay: SearchResult[];
  pricecharting: SearchResult[];
  justtcg: SearchResult[];
  errors: string[];
}

// Price Trends
export interface PriceTrend {
  card_id: number;
  card_name: string;
  set_name: string;
  current_price: number | null;
  previous_price: number | null;
  change: number | null;
  change_percentage: number | null;
  trend: string;
}

export interface PriceTrendsResponse {
  period_days: number;
  since_date: string;
  trends: Record<string, PriceTrend[]>;
}

// Unified Search
export type UnifiedSearchResult =
  | { kind: "library"; card: Card }
  | { kind: "external"; result: SearchResult };

// User Stats
export interface UserStats {
  user: {
    member_since: string;
    username: string;
    email: string;
  };
  collection: CollectionStats;
  alerts: {
    total: number;
    active: number;
  };
}
