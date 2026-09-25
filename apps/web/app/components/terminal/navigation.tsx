import type { ReactNode } from "react";
import { Link } from "react-router";

export interface SegmentedLink {
  to: string;
  label: ReactNode;
  current: boolean;
}

export interface SegmentedLinksProps {
  /** Accessible name of the group, e.g. "History range". */
  label: string;
  items: SegmentedLink[];
  /** Keep the scroll position, for toggles that only change part of the page. */
  preventScrollReset?: boolean;
  className?: string;
}

/** A segmented control made of links (30D / 90D / 1Y), so it works without JavaScript. */
export function SegmentedLinks({
  label,
  items,
  preventScrollReset,
  className = "",
}: SegmentedLinksProps) {
  return (
    <nav aria-label={label} className={`segmented ${className}`}>
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          preventScrollReset={preventScrollReset}
          aria-current={item.current ? "true" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export interface Crumb {
  label: string;
  /** Omit on the last crumb, the current page. */
  to?: string;
}

/** Breadcrumb trail; scrolls sideways rather than wrapping on narrow screens. */
export function Breadcrumbs({ items, className = "" }: { items: Crumb[]; className?: string }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`micro -mx-1 mb-2 overflow-x-auto p-1 whitespace-nowrap ${className}`}
    >
      <ol className="flex items-center gap-2">
        {items.map((item, i) => (
          <li key={`${i}-${item.label}`} className="flex items-center gap-2">
            {i > 0 && (
              <span aria-hidden className="text-wire">
                /
              </span>
            )}
            {item.to ? (
              <Link to={item.to} className="hover:text-text">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-text">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
