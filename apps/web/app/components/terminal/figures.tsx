import type { ReactNode } from "react";
import { formatPercent, formatPrice, formatSignedPrice } from "~/lib/format";

export type Direction = "up" | "down" | "flat";

/** Direction of a change; zero and unknown are flat. */
export function direction(value: number | null | undefined): Direction {
  if (!value) return "flat";
  return value > 0 ? "up" : "down";
}

const TONE: Record<Direction, string> = { up: "text-up", down: "text-down", flat: "text-mute" };
const GLYPH: Record<Direction, string> = { up: "▲", down: "▼", flat: "■" };

export interface DeltaProps {
  /** Percent change; `null`/`undefined` renders "—". */
  pct: number | null | undefined;
  className?: string;
}

/** Signed percent with a ▲▼■ shape cue, so direction never relies on colour alone. */
export function Delta({ pct, className = "" }: DeltaProps) {
  const dir = direction(pct);
  return (
    <span className={`whitespace-nowrap ${TONE[dir]} ${className}`}>
      {pct != null && (
        <span aria-hidden className="mr-1 inline-block align-[0.08em] text-[0.72em]">
          {GLYPH[dir]}
        </span>
      )}
      {formatPercent(pct)}
    </span>
  );
}

export interface PriceProps {
  /** USD cents; `null`/`undefined` renders "—". */
  cents: number | null | undefined;
  /** Profit/loss mode: explicit +/− sign, coloured up/down. */
  signed?: boolean;
  className?: string;
}

/** A USD amount in tabular figures. */
export function Price({ cents, signed = false, className = "" }: PriceProps) {
  const tone = signed ? TONE[direction(cents)] : "";
  return (
    <span className={`whitespace-nowrap ${tone} ${className}`}>
      {signed ? formatSignedPrice(cents) : formatPrice(cents)}
    </span>
  );
}

export interface StatGridProps {
  /** `Stat` cells. Set the column count here, e.g. `grid-cols-2 sm:grid-cols-4`. */
  children: ReactNode;
  className?: string;
}

/** A `<dl>` of stats separated by hairlines. */
export function StatGrid({ children, className = "" }: StatGridProps) {
  return <dl className={`grid gap-px bg-grid ${className}`}>{children}</dl>;
}

export interface StatProps {
  label: ReactNode;
  /** The figure: plain text, `<Price>`, `<Delta>`… */
  children: ReactNode;
  className?: string;
}

/** One labelled figure. Renders `<dt>`/`<dd>`, so place it inside `StatGrid` (or another `<dl>`). */
export function Stat({ label, children, className = "" }: StatProps) {
  return (
    <div className={`bg-deck px-3 py-2.5 ${className}`}>
      <dt className="micro">{label}</dt>
      <dd className="mt-1 text-[15px] font-medium">{children}</dd>
    </div>
  );
}
