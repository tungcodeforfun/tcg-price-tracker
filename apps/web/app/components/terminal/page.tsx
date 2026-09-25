import type { ReactNode } from "react";

export interface PageBodyProps {
  className?: string;
  children: ReactNode;
}

/**
 * The page's content column. Layouts leave `<main>` unpadded so full-bleed strips (a
 * `TickerStrip`) can sit above it; every page wraps its content in one `PageBody`.
 */
export function PageBody({ className = "", children }: PageBodyProps) {
  return (
    <div className={`mx-auto w-full max-w-[1440px] px-3 pt-3 pb-16 sm:px-4 sm:pt-4 ${className}`}>
      {children}
    </div>
  );
}

export interface PageHeaderProps {
  /** Micro caption above the title, e.g. "MKT ▸ Overview". */
  eyebrow?: ReactNode;
  /** The page's `<h1>`. */
  title: ReactNode;
  /** Right-aligned caption or actions. */
  meta?: ReactNode;
  className?: string;
}

/** Page title block: eyebrow, display-font `<h1>`, and an optional aside. */
export function PageHeader({ eyebrow, title, meta, className = "" }: PageHeaderProps) {
  return (
    <div
      className={`mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 sm:mb-4 ${className}`}
    >
      <div className="min-w-0">
        {eyebrow && <p className="micro">{eyebrow}</p>}
        <h1 className="mt-1 font-sans text-[28px] leading-none font-semibold tracking-[-0.02em] text-balance sm:text-[34px]">
          {title}
        </h1>
      </div>
      {meta && <div className="micro">{meta}</div>}
    </div>
  );
}
