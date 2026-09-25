// PROTOTYPE (UI redesign) — design C chrome: header, footer, page shell, shared bits.
import "@fontsource-variable/unbounded";
import "@fontsource-variable/inter";
import "./holo.css";
import type { ReactNode } from "react";
import { Form, Link } from "react-router";
import { formatPercent } from "~/lib/format";
import { withDesign } from "../types";

export const DESIGN = "C" as const;

export const cardPath = (slug: string) => withDesign(`/cards/${slug}`, DESIGN);

/** Bold +/− chip; typographic minus, ink text on mint or coral. */
export function ChangeChip({ pct, size = "md" }: { pct: number | null; size?: "sm" | "md" }) {
  const tone =
    pct == null || pct === 0
      ? "bg-(--holo-ink-3) text-(--holo-mist)"
      : pct > 0
        ? "bg-(--holo-up) text-(--holo-ink)"
        : "bg-(--holo-down) text-(--holo-ink)";
  const pad = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";
  return (
    <span className={`holo-num inline-flex items-center rounded-full font-bold ${pad} ${tone}`}>
      {formatPercent(pct).replace("-", "−")}
    </span>
  );
}

function Logo() {
  return (
    <Link
      to={withDesign("/", DESIGN)}
      className="group flex shrink-0 items-center gap-3 rounded-md"
      aria-label="TCG Price Tracker home"
    >
      <span
        aria-hidden
        className="holo-band block h-7 w-5 -rotate-12 rounded-[4px] shadow-[0_0_0_1px_rgb(255_255_255/0.25)_inset] transition-transform group-hover:rotate-0 motion-reduce:transition-none"
      />
      <span className="holo-display text-[13px] leading-none font-bold tracking-tight sm:text-[15px]">
        TCG<span className="text-(--holo-lilac)">/</span>
        <span className="sm:hidden">PT</span>
        <span className="hidden sm:inline">Price Tracker</span>
      </span>
    </Link>
  );
}

function Header() {
  return (
    <header className="border-b border-(--holo-line)">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 sm:gap-x-8 sm:px-8">
        <Logo />
        <Form
          method="get"
          action="/search"
          role="search"
          className="order-last w-full md:order-none md:w-auto md:max-w-sm md:flex-1"
        >
          <label className="sr-only" htmlFor="holo-site-search">
            Search cards
          </label>
          <input
            id="holo-site-search"
            name="q"
            type="search"
            placeholder="Search cards"
            className="holo-input w-full rounded-full border border-(--holo-line) bg-(--holo-ink-2) px-4 py-2 text-sm text-(--holo-paper) focus:border-(--holo-lilac)"
          />
        </Form>
        <nav aria-label="Main" className="-mr-2.5 ml-auto flex text-sm font-medium sm:mr-0 sm:gap-1">
          <Link
            to="/games"
            className="rounded-full px-2.5 py-1.5 whitespace-nowrap text-(--holo-mist) hover:bg-(--holo-ink-3) hover:text-(--holo-paper)"
          >
            Games
          </Link>
          <Link
            to="/app"
            className="rounded-full px-2.5 py-1.5 whitespace-nowrap text-(--holo-mist) hover:bg-(--holo-ink-3) hover:text-(--holo-paper)"
          >
            My collection
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-24 border-t border-(--holo-line)">
      <div className="mx-auto grid max-w-[1280px] gap-6 px-5 py-10 sm:px-8 md:grid-cols-[1fr_auto] md:items-end">
        <p
          aria-hidden
          className="holo-display text-[clamp(2.5rem,9vw,7rem)] leading-[0.85] font-black text-(--holo-ink-3) select-none"
        >
          TCG/PT
        </p>
        <div className="space-y-3 text-sm text-(--holo-mist) md:text-right">
          <nav aria-label="Footer" className="flex gap-4 md:justify-end">
            <Link to="/games" className="hover:text-(--holo-paper) hover:underline">
              Games
            </Link>
            <Link to="/app" className="hover:text-(--holo-paper) hover:underline">
              My collection
            </Link>
          </nav>
          <p>
            Market prices from{" "}
            <a
              href="https://justtcg.com"
              rel="noopener"
              className="text-(--holo-paper) underline decoration-(--holo-lilac) underline-offset-4"
            >
              JustTCG
            </a>
            . Prices are estimates, not offers.
          </p>
        </div>
      </div>
    </footer>
  );
}

export function HoloShell({ children }: { children: ReactNode }) {
  return (
    <div className="holo flex min-h-dvh flex-col">
      <a
        href="#holo-main"
        className="sr-only z-50 rounded-full bg-(--holo-paper) px-4 py-2 text-sm font-semibold text-(--holo-ink) focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Header />
      <main id="holo-main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
