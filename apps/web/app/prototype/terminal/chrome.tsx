// PROTOTYPE (UI redesign): design B "Trading terminal" chrome, panels and shared formatting.
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/space-grotesk";
import "./terminal.css";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Form, Link } from "react-router";
import { formatPercent } from "~/lib/format";
import { withDesign } from "../types";

export const DESIGN = "B" as const;

export const cardHref = (slug: string, search = "") =>
  withDesign(`/cards/${slug}${search}`, DESIGN);

/** Exchange-style set code: "McDonald's Promos 2014" → "MP14", "Set Sail Deck Set" → "SSDS". */
export function setCode(setName: string): string {
  const words = setName
    .replace(/['’]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const year = words.find((w) => /^(19|20)\d\d$/.test(w));
  const letters = words
    .filter((w) => !/^\d+$/.test(w))
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return year ? `${letters.slice(0, 2)}${year.slice(2)}` : letters.slice(0, 4);
}

/** The feed fills unknown fields with "None" / "N/A"; treat those as missing. */
export function known(value: string | null): string | null {
  return value && !/^(none|n\/a)$/i.test(value.trim()) ? value : null;
}

/** "005/012" → "005"; placeholders like "N/A" have no number. */
function shortNumber(number: string | null): string | null {
  const head = number?.split("/")[0]?.trim();
  return head && /\d/.test(head) ? head : null;
}

export function symbolFor(card: { setName: string; number: string | null }): string {
  const num = shortNumber(card.number);
  return num ? `${setCode(card.setName)}.${num}` : setCode(card.setName);
}

/** "Pikachu - 5/12" → "Pikachu"; the number already lives in the symbol. */
export function shortName(name: string): string {
  return name.replace(/\s+-\s+\d+\/\d+$/, "");
}

type Direction = "up" | "down" | "flat";

export function direction(pct: number | null | undefined): Direction {
  if (!pct) return "flat";
  return pct > 0 ? "up" : "down";
}

const GLYPH: Record<Direction, string> = { up: "▲", down: "▼", flat: "■" };

/** Signed percent with a shape cue, so direction never relies on colour alone. */
export function Delta({
  pct,
  className = "",
}: {
  pct: number | null | undefined;
  className?: string;
}) {
  const dir = direction(pct);
  return (
    <span className={`t-${dir} whitespace-nowrap ${className}`}>
      <span aria-hidden className="mr-1 inline-block text-[0.72em] align-[0.08em]">
        {pct == null ? "" : GLYPH[dir]}
      </span>
      {formatPercent(pct)}
    </span>
  );
}

export function Panel({
  code,
  title,
  meta,
  className = "",
  children,
}: {
  code: string;
  title: string;
  meta?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={`flex min-w-0 flex-col bg-(--t-deck) ${className}`}>
      <header className="flex h-8 shrink-0 items-center gap-3 border-b border-(--t-grid) bg-(--t-rail) px-3">
        <span aria-hidden className="t-micro text-(--t-amber)!">
          {code}
        </span>
        <h2 id={id} className="t-micro min-w-0 truncate text-(--t-text)!">
          {title}
        </h2>
        {meta && <div className="t-micro ml-auto shrink-0">{meta}</div>}
      </header>
      {children}
    </section>
  );
}

export function Stat({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-(--t-deck) px-3 py-2.5 ${className}`}>
      <dt className="t-micro">{label}</dt>
      <dd className="mt-1 text-[15px] font-medium text-(--t-text)">{children}</dd>
    </div>
  );
}

function SearchCommand() {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      event.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Form
      method="get"
      action="/search"
      role="search"
      className="group flex h-9 min-w-0 flex-1 items-center gap-2 border border-(--t-wire) bg-(--t-void) px-3 focus-within:border-(--t-amber) focus-within:shadow-[0_0_0_1px_var(--t-amber)]"
    >
      <label htmlFor="t-search" className="t-micro text-(--t-amber)!">
        <span aria-hidden>&gt;</span>
        <span className="sr-only">Search cards</span>
      </label>
      <input
        ref={input}
        id="t-search"
        name="q"
        type="search"
        autoComplete="off"
        spellCheck={false}
        placeholder="SEARCH CARD, SET OR NUMBER"
        className="t-search-input min-w-0 flex-1 bg-transparent text-[12.5px] tracking-wide text-(--t-text) placeholder:text-(--t-mute)"
      />
      <kbd aria-hidden className="hidden sm:inline group-focus-within:hidden">
        /
      </kbd>
      <kbd aria-hidden className="hidden sm:group-focus-within:inline">
        ↵
      </kbd>
    </Form>
  );
}

function NavKey({ to, fkey, children }: { to: string; fkey: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="flex h-9 items-center gap-2 border border-transparent px-2.5 text-[11.5px] tracking-[0.12em] text-(--t-text) uppercase hover:border-(--t-wire) hover:bg-(--t-rail)"
    >
      <span aria-hidden className="text-[10px] text-(--t-amber)">
        {fkey}
      </span>
      {children}
    </Link>
  );
}

function Header() {
  return (
    <header className="border-b border-(--t-grid) bg-(--t-deck)">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 sm:px-4">
        <Link to={withDesign("/", DESIGN)} className="flex h-9 items-center gap-2.5 pr-2">
          <span
            aria-hidden
            className="grid h-6 w-6 place-items-center bg-(--t-amber) text-[11px] font-extrabold text-(--t-void)"
          >
            T
          </span>
          <span className="text-[13px] font-bold tracking-[0.16em] text-(--t-text) uppercase">
            TCG<span className="text-(--t-amber)">/</span>PX
          </span>
          <span className="sr-only">TCG Price Tracker home</span>
        </Link>
        <nav aria-label="Primary" className="ml-auto flex items-center gap-1 sm:order-last sm:ml-0">
          <NavKey to="/games" fkey="F2">
            Games
          </NavKey>
          <NavKey to="/app" fkey="F3">
            My collection
          </NavKey>
        </nav>
        <div className="order-last w-full sm:order-none sm:w-auto sm:max-w-xl sm:flex-1">
          <SearchCommand />
        </div>
        <p className="t-micro hidden items-center gap-2 lg:ml-auto lg:flex">
          <span aria-hidden className="h-1.5 w-1.5 bg-(--t-up)" />
          Feed · JustTCG · EOD
        </p>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-auto border-t border-(--t-grid) bg-(--t-deck)">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-3 py-3 text-[11.5px] text-(--t-mute) sm:px-4">
        <p>
          Market prices from{" "}
          <a
            href="https://justtcg.com"
            rel="noopener"
            className="text-(--t-text) underline decoration-(--t-wire) underline-offset-4 hover:decoration-(--t-amber)"
          >
            JustTCG
          </a>
          . Prices are estimates, not offers.
        </p>
        <p aria-hidden className="hidden items-center gap-4 sm:flex">
          <span>
            <kbd>/</kbd> search
          </span>
          <span>
            <kbd>←</kbd> <kbd>→</kbd> design
          </span>
        </p>
      </div>
    </footer>
  );
}

export function TerminalShell({ ticker, children }: { ticker?: ReactNode; children: ReactNode }) {
  return (
    <div className="term flex min-h-dvh flex-col">
      <Header />
      {ticker}
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-3 py-3 pb-24 sm:px-4 sm:py-4 sm:pb-24">
        {children}
      </main>
      <Footer />
    </div>
  );
}
