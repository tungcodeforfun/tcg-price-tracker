import { existsSync } from "node:fs";

if (process.env.NODE_ENV !== "production" && existsSync("../../.env")) {
  process.loadEnvFile("../../.env");
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  appUrl: required("APP_URL"),
  authSecret: required("BETTER_AUTH_SECRET"),
  smtpUrl: required("SMTP_URL"),
  emailFrom: required("EMAIL_FROM"),
  isProduction: process.env.NODE_ENV === "production",
};
