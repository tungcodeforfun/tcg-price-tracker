import { createSmtpMailer, type EmailMessage, type Mailer } from "@tcg/email";
import { env } from "./env.ts";

export const mailer: Mailer = createSmtpMailer({ url: env.smtpUrl, from: env.emailFrom });

/** Fire-and-forget so response timing doesn't reveal whether an account exists. */
export function sendInBackground(message: EmailMessage): void {
  mailer.send(message).catch((error: unknown) => {
    console.error("[email] send failed", { subject: message.subject, error });
  });
}
