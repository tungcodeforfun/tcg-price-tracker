import type { JustTcgPlan } from "@tcg/pricing";

export interface WorkerConfig {
  databaseUrl: string;
  justTcgApiKey: string;
  justTcgPlan: JustTcgPlan;
  /** JustTCG set ids to sync on the free plan; empty means the newest sets per game. */
  setAllowlist: string[];
  /** Free plan without an allowlist: how many of each game's newest released sets to sync. */
  newestSetsPerGame: number;
  /** A set isn't re-synced until this many hours after its last sync. */
  minRefreshHours: number;
  /** JustTCG game ids whose catalog and prices are synced. */
  enabledGames: string[];
  /** Public site origin, for links in emails. */
  appUrl: string;
  smtpUrl: string;
  emailFrom: string;
}

const PLANS: readonly JustTcgPlan[] = ["free", "starter", "professional", "enterprise"];
const DEFAULT_ENABLED_GAMES = "pokemon,pokemon-japan,one-piece-card-game,disney-lorcana";

function positiveInt(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function commaList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePlan(value: string | undefined): JustTcgPlan {
  const plan = value?.trim() || "free";
  if (!PLANS.includes(plan as JustTcgPlan)) {
    throw new Error(`JUSTTCG_PLAN must be one of ${PLANS.join(", ")}; got "${plan}"`);
  }
  return plan as JustTcgPlan;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const justTcgPlan = parsePlan(env.JUSTTCG_PLAN);
  return {
    databaseUrl: required(env, "DATABASE_URL"),
    justTcgApiKey: required(env, "JUSTTCG_API_KEY"),
    justTcgPlan,
    setAllowlist: commaList(env.SYNC_SET_ALLOWLIST),
    newestSetsPerGame: positiveInt(env, "SYNC_NEWEST_SETS_PER_GAME", 3),
    // Free tier (~33 requests/day) refreshes every 3 days; paid plans daily.
    minRefreshHours: positiveInt(env, "SYNC_MIN_REFRESH_HOURS", justTcgPlan === "free" ? 72 : 20),
    enabledGames: commaList(env.ENABLED_GAMES?.trim() || DEFAULT_ENABLED_GAMES),
    appUrl: required(env, "APP_URL").replace(/\/+$/, ""),
    smtpUrl: required(env, "SMTP_URL"),
    emailFrom: required(env, "EMAIL_FROM"),
  };
}
