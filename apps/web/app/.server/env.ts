import { existsSync } from "node:fs";

if (process.env.NODE_ENV !== "production" && existsSync("../../.env")) {
  process.loadEnvFile("../../.env");
}

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function list(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  appUrl: required("APP_URL"),
  authSecret: required("BETTER_AUTH_SECRET"),
  smtpUrl: required("SMTP_URL"),
  emailFrom: required("EMAIL_FROM"),
  isProduction: process.env.NODE_ENV === "production",
  /** Private beta: sign-up needs an invite code unless BETA_INVITES=off. */
  invitesRequired: process.env.BETA_INVITES?.trim() !== "off",
  betaUserCap: positiveInt("BETA_USER_CAP", 100),
  /** Where beta feedback is emailed; feedback is only stored when unset. */
  feedbackEmail: process.env.FEEDBACK_EMAIL?.trim() || null,
  /** Game ids whose card images are switched off (takedown kill switch); their cards show placeholders. */
  imagesDisabledGames: list("IMAGES_DISABLED_GAMES"),
  /** Takedown contact shown in the footer to rights holders; hidden when unset. */
  takedownEmail: process.env.TAKEDOWN_EMAIL?.trim() || null,
};
