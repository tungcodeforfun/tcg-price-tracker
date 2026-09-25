const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const signedUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  signDisplay: "exceptZero",
});
const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const longDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

export function formatPrice(cents: number | null | undefined): string {
  return cents == null ? "—" : usd.format(cents / 100);
}

/** Profit/loss with an explicit sign: "+$1.00", "-$1.00", "$0.00". */
export function formatSignedPrice(cents: number | null | undefined): string {
  return cents == null ? "—" : signedUsd.format(cents / 100);
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

/** Today's UTC date as `YYYY-MM-DD`, the format of `<input type="date">` and price snapshots. */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
