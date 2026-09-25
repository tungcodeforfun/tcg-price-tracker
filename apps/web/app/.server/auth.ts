import { schema } from "@tcg/db";
import { countUsers, redeemInviteCode } from "@tcg/core";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { db } from "./db.ts";
import { existingAccountEmail, resetPasswordEmail, verifyEmail } from "./emails.ts";
import { env } from "./env.ts";
import { sendInBackground } from "./mailer.ts";

export const auth = betterAuth({
  baseURL: env.appUrl,
  secret: env.authSecret,
  database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
  telemetry: { enabled: false },
  user: {
    additionalFields: {
      inviteCode: { type: "string", required: false, input: true, returned: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Runs for every user insert, so a direct API sign-up can't skip the invite check.
        // Errors use 400, not 403: Better Auth turns a 403 here into its generic "check your inbox" reply.
        before: async (user) => {
          if (!env.invitesRequired) return { data: { ...user, inviteCode: null } };
          if ((await countUsers(db)) >= env.betaUserCap) {
            throw APIError.from("BAD_REQUEST", { code: "BETA_FULL", message: "The beta is full" });
          }
          const input = typeof user.inviteCode === "string" ? user.inviteCode : "";
          const code = await redeemInviteCode(db, input);
          if (!code) {
            throw APIError.from("BAD_REQUEST", {
              code: "INVITE_INVALID",
              message: "Invalid invite code",
            });
          }
          return { data: { ...user, inviteCode: code } };
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) =>
      sendInBackground(resetPasswordEmail(user.email, url)),
    onExistingUserSignUp: async ({ user }) =>
      sendInBackground(existingAccountEmail(user.email, `${env.appUrl}/login`)),
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => sendInBackground(verifyEmail(user.email, url)),
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/request-password-reset": { window: 60, max: 3 },
      "/send-verification-email": { window: 60, max: 3 },
      "/reset-password": { window: 60, max: 5 },
    },
  },
  advanced: {
    useSecureCookies: env.isProduction,
    ipAddress: { ipAddressHeaders: ["fly-client-ip"] },
  },
});

export type Session = typeof auth.$Infer.Session;
