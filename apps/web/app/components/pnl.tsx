import { formatPercent, formatSignedPrice } from "~/lib/format";

export function toneClass(value: number | null | undefined): string {
  if (!value) return "";
  return value > 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400";
}

export function Pnl({ cents }: { cents: number | null | undefined }) {
  return <span className={toneClass(cents)}>{formatSignedPrice(cents)}</span>;
}

export function PercentChange({ pct }: { pct: number | null | undefined }) {
  return <span className={toneClass(pct)}>{formatPercent(pct)}</span>;
}
