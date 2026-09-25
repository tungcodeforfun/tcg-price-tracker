import type { PendingNotification } from "@tcg/core";
import type { EmailMessage } from "@tcg/email";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function describe(n: PendingNotification): string {
  const verb = n.direction === "below" ? "dropped to" : "rose to";
  const rule = n.direction === "below" ? "at or below" : "at or above";
  return `${n.cardName} (${n.printing} · ${n.condition}, ${n.setName}) ${verb} ${usd.format(n.priceCents / 100)}, ${rule} your ${usd.format(n.thresholdCents / 100)} target.`;
}

/** One email per user listing every alert that fired in this delivery run. */
export function alertDigestEmail(batch: PendingNotification[], appUrl: string): EmailMessage {
  const first = batch[0];
  if (!first) throw new Error("alertDigestEmail needs at least one notification");
  const subject =
    batch.length === 1
      ? `Price alert: ${first.cardName} is now ${usd.format(first.priceCents / 100)}`
      : `${batch.length} price alerts triggered`;
  const manage = `${appUrl}/app/alerts`;
  const text = [
    ...batch.map((n) => `- ${describe(n)}\n  ${appUrl}/cards/${n.cardSlug}`),
    "",
    `Manage your alerts: ${manage}`,
  ].join("\n");
  const html = [
    "<ul>",
    ...batch.map(
      (n) =>
        `<li><a href="${escapeHtml(`${appUrl}/cards/${n.cardSlug}`)}">${escapeHtml(describe(n))}</a></li>`,
    ),
    "</ul>",
    `<p><a href="${escapeHtml(manage)}">Manage your alerts</a></p>`,
  ].join("");
  return { to: first.email, subject, text, html };
}
