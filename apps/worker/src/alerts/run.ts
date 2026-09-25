import { deliverNotifications } from "@tcg/core";
import type { Services } from "../services.ts";
import { alertDigestEmail } from "./email.ts";

/** Emails every pending alert notification, one digest per user. */
export async function deliverAlertEmails({ db, mailer, config }: Services) {
  return deliverNotifications(db, (batch) => mailer.send(alertDigestEmail(batch, config.appUrl)));
}
