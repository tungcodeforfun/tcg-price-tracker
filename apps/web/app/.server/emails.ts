import type { EmailMessage } from "@tcg/email";

function linkEmail(to: string, subject: string, intro: string, action: string, url: string) {
  return {
    to,
    subject,
    text: `${intro}\n\n${action}: ${url}\n\nIf you didn't request this, you can ignore this email.`,
    html: `<p>${intro}</p><p><a href="${url}">${action}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
  } satisfies EmailMessage;
}

export const verifyEmail = (to: string, url: string) =>
  linkEmail(
    to,
    "Verify your email",
    "Confirm your email address to finish signing up.",
    "Verify email",
    url,
  );

export const resetPasswordEmail = (to: string, url: string) =>
  linkEmail(
    to,
    "Reset your password",
    "We received a request to reset your password.",
    "Choose a new password",
    url,
  );

export const existingAccountEmail = (to: string, url: string) =>
  linkEmail(
    to,
    "Sign-up attempt with your email",
    "Someone tried to create an account with your email address. If it was you, sign in instead.",
    "Sign in",
    url,
  );
