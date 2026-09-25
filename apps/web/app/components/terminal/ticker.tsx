import { Children, type ReactNode } from "react";

export interface TickerStripProps {
  /** Amber tag at the left edge, e.g. "Quote" or "7D Movers". */
  label: string;
  /** Strip content: a `TickerTape`, or inline items (these scroll sideways when too wide). */
  children: ReactNode;
}

/** Full-bleed strip under the site header. Render it before the page's `PageBody`. */
export function TickerStrip({ label, children }: TickerStripProps) {
  return (
    <div className="flex h-9 border-b border-grid bg-void">
      <p className="micro flex shrink-0 items-center bg-amber px-3 font-bold text-void">{label}</p>
      <div className="flex min-w-0 flex-1 items-center overflow-x-auto text-[12px] whitespace-nowrap">
        {children}
      </div>
    </div>
  );
}

/** Enough tape to overflow a wide screen before the loop repeats. */
const MIN_ITEMS = 12;

export interface TickerTapeProps {
  /** Accessible name of the list, e.g. "Biggest 7-day movers". */
  label: string;
  /** `<li>` items, typically links. */
  children: ReactNode;
}

/**
 * Endless scrolling tape. The items are listed once for assistive tech and keyboard users;
 * visual repeats are `inert`. Pauses on hover and focus; static and scrollable with reduced motion.
 */
export function TickerTape({ label, children }: TickerTapeProps) {
  const count = Children.count(children);
  if (count === 0) return null;
  // Two identical halves: the animation shifts by -50% and wraps without a jump.
  const perHalf = Math.ceil(MIN_ITEMS / count);
  return (
    <div className="ticker-viewport h-full min-w-0 flex-1 overflow-hidden">
      <div className="ticker-tape">
        {Array.from({ length: perHalf * 2 }, (_, copy) =>
          copy === 0 ? (
            <ul key={copy} aria-label={label} className="flex h-full">
              {children}
            </ul>
          ) : (
            <ul key={copy} aria-hidden inert data-copy="" className="flex h-full">
              {children}
            </ul>
          ),
        )}
      </div>
    </div>
  );
}
