import type { JustTcgPlan } from "@tcg/pricing";

export interface WorkerConfig {
  databaseUrl: string;
  justTcgApiKey: string;
  justTcgPlan: JustTcgPlan;
  /** JustTCG set ids to sync on the free plan. */
  setAllowlist: string[];
  /** JustTCG game ids whose catalog and prices are synced. */
  enabledGames: string[];
  /** Public site origin, for links in emails. */
  appUrl: string;
  smtpUrl: string;
  emailFrom: string;
}

const PLANS: readonly JustTcgPlan[] = ["free", "starter", "professional", "enterprise"];
const DEFAULT_ENABLED_GAMES = "pokemon,pokemon-japan,one-piece-card-game,disney-lorcana";

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
  return {
    databaseUrl: required(env, "DATABASE_URL"),
    justTcgApiKey: required(env, "JUSTTCG_API_KEY"),
    justTcgPlan: parsePlan(env.JUSTTCG_PLAN),
    setAllowlist: commaList(env.SYNC_SET_ALLOWLIST),
    enabledGames: commaList(env.ENABLED_GAMES?.trim() || DEFAULT_ENABLED_GAMES),
    appUrl: required(env, "APP_URL").replace(/\/+$/, ""),
    smtpUrl: required(env, "SMTP_URL"),
    emailFrom: required(env, "EMAIL_FROM"),
  };
}
