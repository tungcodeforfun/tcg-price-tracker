// PROTOTYPE (UI redesign) — Design A chrome: masthead header, section heads, footer.
import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource-variable/fraunces/opsz-italic.css";
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/newsreader/opsz-italic.css";
import "./ledger.css";
import type { ReactNode } from "react";
import { Form, Link } from "react-router";
import { formatPercent } from "~/lib/format";
import { withDesign } from "../types";

const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

export const HOME = withDesign("/", "A");

export function LedgerShell({
  children,
  masthead = "compact",
  strap,
}: {
  children: ReactNode;
  masthead?: "full" | "compact";
  /** Right-hand line of the strap under the masthead. */
  strap?: ReactNode;
}) {
  return (
    <div className="ledger flex min-h-dvh flex-col">
      <a
        href="#ledger-main"
        className="ledger-caps sr-only bg-(--ink) px-3 py-2 text-(--paper) focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to contents
      </a>
      <header className="mx-auto w-full max-w-[76rem] px-5 pt-4 sm:px-10">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 pb-3 text-[0.95rem]">
          <nav aria-label="Primary" className="ledger-caps flex gap-6 text-[1.05rem]">
            <Link to="/games" className="ledger-quiet">
              Games
            </Link>
            <Link to="/app" className="ledger-quiet">
              My collection
            </Link>
          </nav>
          <Form
            method="get"
            action="/search"
            role="search"
            className="order-last flex w-full items-baseline gap-3 border-b border-(--ink) sm:order-none sm:ml-auto sm:w-80"
          >
            <label htmlFor="ledger-search" className="ledger-caps shrink-0 text-(--ink-soft)">
              Search
            </label>
            <input
              id="ledger-search"
              name="q"
              type="search"
              placeholder="a card, a set…"
              className="min-w-0 flex-1 bg-transparent py-1 italic text-(--ink) placeholder:text-(--ink-soft) focus-visible:outline-offset-4"
            />
            <button
              type="submit"
              className="ledger-caps shrink-0 py-1 text-(--oxblood) hover:underline"
            >
              Find&nbsp;→
            </button>
          </Form>
        </div>

        {masthead === "full" ? (
          <div className="ledger-rule-double pt-5 pb-4">
            <Link to={HOME} className="block w-fit" aria-label="TCG Price Tracker, home">
              <Wordmark className="text-[3.1rem] leading-[0.9] sm:text-[5.5rem] lg:text-[7rem]" />
            </Link>
          </div>
        ) : (
          <div className="ledger-rule-double flex items-end justify-between gap-6 pt-3 pb-2">
            <Link to={HOME} className="block w-fit" aria-label="TCG Price Tracker, home">
              <Wordmark className="text-[2rem] leading-none sm:text-[2.6rem]" />
            </Link>
          </div>
        )}
        <div className="ledger-caps flex flex-wrap justify-between gap-x-6 gap-y-1 border-y border-(--ink) py-1.5 text-[0.95rem] text-(--ink-soft)">
          <span>A register of trading card market prices</span>
          {strap && <span className="ledger-num">{strap}</span>}
        </div>
      </header>

      <main id="ledger-main" className="mx-auto w-full max-w-[76rem] flex-1 px-5 pb-16 sm:px-10">
        {children}
      </main>

      <footer className="mx-auto w-full max-w-[76rem] px-5 pb-10 sm:px-10">
        <div className="ledger-rule-double flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 pt-3 text-[0.95rem] text-(--ink-soft)">
          <Wordmark className="text-[1.25rem] text-(--ink)" />
          <p>
            Market prices from{" "}
            <a href="https://justtcg.com" rel="noopener" className="ledger-link text-(--ink)">
              JustTCG
            </a>
            . Prices are estimates, not offers.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`ledger-display block font-[560] tracking-[-0.025em] ${className}`}
      style={{ fontVariationSettings: '"opsz" 144' }}
    >
      <span className="font-[480] italic tracking-[-0.01em] text-(--oxblood)">TCG</span> Price
      Tracker
    </span>
  );
}

/** Numbered section head: roman numeral, hairline, title and a small-caps dek. */
export function SectionHead({
  index,
  id,
  title,
  dek,
  aside,
}: {
  index: number;
  id: string;
  title: string;
  dek?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="ledger-display text-[1.15rem] italic text-(--oxblood)"
          style={{ fontVariationSettings: '"opsz" 36' }}
        >
          {ROMAN[index - 1]}.
        </span>
        <span className="h-px flex-1 bg-(--ink)" />
      </div>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <h2
            id={id}
            className="ledger-display text-[1.75rem] leading-tight font-[520] tracking-[-0.01em] sm:text-[2rem]"
          >
            {title}
          </h2>
          {dek && <p className="ledger-caps text-[0.95rem] text-(--ink-soft)">{dek}</p>}
        </div>
        {aside}
      </div>
    </div>
  );
}

/** Drops the catalog's placeholder values ("N/A", "None") along with empty ones. */
export function known(value: string | null | undefined): string | null {
  return value && !["N/A", "None", "-"].includes(value.trim()) ? value : null;
}

export function entryLine(...parts: (string | null | undefined)[]): string {
  return parts.map(known).filter(Boolean).join(". ");
}

/** Signed 7-day change. Declines are set in the ledger's red ink. */
export function Change({
  pct,
  className = "",
}: {
  pct: number | null | undefined;
  className?: string;
}) {
  const falling = (pct ?? 0) < 0;
  const text = formatPercent(pct).replace("-", "−");
  return (
    <span
      className={`ledger-num ${falling ? "text-(--oxblood) italic" : "text-(--ink)"} ${className}`}
    >
      {text}
    </span>
  );
}
