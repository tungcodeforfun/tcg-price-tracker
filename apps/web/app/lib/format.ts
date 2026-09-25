const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const longDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

export function formatPrice(cents: number | null | undefined): string {
  return cents == null ? "—" : usd.format(cents / 100);
}

export function formatPercent(pct: number | null | undefined): string {
  if (pct == null) return "—";
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

/** Accepts `YYYY-MM-DD` (treated as UTC) or a Date. */
export function formatShortDate(value: string | Date): string {
  return shortDate.format(typeof value === "string" ? new Date(`${value}T00:00:00Z`) : value);
}

export function formatDate(value: string | Date): string {
  return longDate.format(typeof value === "string" ? new Date(`${value}T00:00:00Z`) : value);
}
