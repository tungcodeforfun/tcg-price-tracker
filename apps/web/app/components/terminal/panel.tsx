import { useId, type ReactNode } from "react";

export interface PanelProps {
  /** Function-key style code shown in amber before the title, e.g. "F4". Decorative. */
  code?: string;
  /** Panel heading, rendered as an `<h2>` that labels the section. */
  title: string;
  /** Right-aligned header content: a caption, count or `SegmentedLinks`. */
  meta?: ReactNode;
  /** Grid placement and sizing, e.g. `lg:col-span-8`. */
  className?: string;
  children: ReactNode;
}

/** A titled section with a header rail. Place panels inside `PanelGrid` for hairline rules. */
export function Panel({ code, title, meta, className = "", children }: PanelProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={`flex min-w-0 flex-col bg-deck ${className}`}>
      <header className="flex min-h-8 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-grid bg-rail px-3 py-1">
        {code && (
          <span aria-hidden className="micro text-amber">
            {code}
          </span>
        )}
        <h2 id={id} className="micro min-w-0 truncate text-text">
          {title}
        </h2>
        {meta && <div className="micro ml-auto shrink-0">{meta}</div>}
      </header>
      {children}
    </section>
  );
}

export interface PanelGridProps {
  /** Columns and spans, e.g. `lg:grid-cols-12` with `lg:col-span-*` on the children. */
  className?: string;
  children: ReactNode;
}

/** Panels on a 1px grid: the gaps draw the rules between them. One column until you add more. */
export function PanelGrid({ className = "", children }: PanelGridProps) {
  return <div className={`panel-grid ${className}`}>{children}</div>;
}
