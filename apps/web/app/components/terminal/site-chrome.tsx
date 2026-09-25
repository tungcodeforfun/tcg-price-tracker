import { useEffect, useRef, type ReactNode } from "react";
import { Form, Link, useLocation, useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "~/root";

/** Command-line style GET search; "/" anywhere on the page focuses it. */
function SearchCommand({ query }: { query: string }) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (
        event.target instanceof Element &&
        event.target.closest("input, textarea, select, [contenteditable]")
      ) {
        return;
      }
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
      className="group flex h-9 min-w-0 flex-1 items-center gap-2 border border-wire bg-void px-3 focus-within:border-amber focus-within:shadow-[0_0_0_1px_var(--color-amber)]"
    >
      <label htmlFor="site-search" className="micro text-amber">
        <span aria-hidden>&gt;</span>
        <span className="sr-only">Search cards</span>
      </label>
      {/* The form draws the focus ring around the whole command line. */}
      <input
        ref={input}
        id="site-search"
        name="q"
        type="search"
        defaultValue={query}
        autoComplete="off"
        spellCheck={false}
        placeholder="SEARCH CARD, SET OR NUMBER"
        className="min-w-0 flex-1 bg-transparent text-[12.5px] tracking-wide placeholder:text-mute focus-visible:outline-none"
      />
      <kbd aria-hidden className="hidden sm:inline sm:group-focus-within:hidden">
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
      className="flex h-9 items-center gap-2 border border-transparent px-2.5 text-[11.5px] tracking-[0.12em] uppercase hover:border-wire hover:bg-rail"
    >
      <span aria-hidden className="text-[10px] text-amber">
        {fkey}
      </span>
      {children}
    </Link>
  );
}

/** The T mark and TCG/PX wordmark, linking home. */
export function SiteLogo() {
  return (
    <Link to="/" className="flex h-9 items-center gap-2.5 pr-2">
      <span
        aria-hidden
        className="grid h-6 w-6 place-items-center bg-amber text-[11px] font-extrabold text-void"
      >
        T
      </span>
      <span aria-hidden className="text-[13px] font-bold tracking-[0.16em] uppercase">
        TCG<span className="text-amber">/</span>PX
      </span>
      <span className="sr-only">TCG Price Tracker home</span>
    </Link>
  );
}

export interface SiteHeaderProps {
  /** Prefills the search box, e.g. with the current query on /search. */
  query?: string;
  /** Extra controls after the primary nav, e.g. the signed-in account and a log-out form. */
  actions?: ReactNode;
}

/** Top bar: logo, command search ("/" to focus), Games and My collection. */
export function SiteHeader({ query = "", actions }: SiteHeaderProps) {
  return (
    <header className="border-b border-grid bg-deck">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 sm:px-4">
        <SiteLogo />
        <nav aria-label="Primary" className="ml-auto flex items-center gap-1 sm:order-last sm:ml-0">
          <NavKey to="/games" fkey="F2">
            Games
          </NavKey>
          <NavKey to="/app" fkey="F3">
            My collection
          </NavKey>
        </nav>
        {actions && <div className="flex items-center gap-2 sm:order-last">{actions}</div>}
        <div className="order-last w-full sm:order-none sm:w-auto sm:max-w-xl sm:flex-1">
          <SearchCommand query={query} />
        </div>
        <p className="micro hidden items-center gap-2 lg:ml-auto lg:flex">
          <span aria-hidden className="h-1.5 w-1.5 bg-up" />
          Feed · JustTCG · EOD
        </p>
      </div>
    </header>
  );
}

/**
 * `/app/feedback?from=<current path>`, so the note records where it was written. Derived from
 * the URL alone, so public pages stay cacheable; signed-out visitors go through login first.
 */
export function useFeedbackHref(): string {
  const { pathname, search } = useLocation();
  const from =
    pathname === "/app/feedback" ? new URLSearchParams(search).get("from") : pathname + search;
  return from ? `/app/feedback?from=${encodeURIComponent(from)}` : "/app/feedback";
}

/**
 * Bottom bar: the JustTCG data credit and disclaimer, the beta feedback link, and the card image
 * notice with the takedown contact. Settings come from the root loader, never the session, so
 * public pages stay cacheable.
 */
export function SiteFooter() {
  const feedbackHref = useFeedbackHref();
  const takedownEmail = useRouteLoaderData<typeof rootLoader>("root")?.takedownEmail;
  return (
    <footer className="border-t border-grid bg-deck">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-3 py-3 text-[11.5px] text-mute sm:px-4">
        <p>
          Market prices from{" "}
          <a
            href="https://justtcg.com"
            rel="noopener"
            className="text-text underline decoration-wire underline-offset-4 hover:decoration-amber"
          >
            JustTCG
          </a>
          . Prices are estimates, not offers.
        </p>
        <div className="flex items-center gap-6">
          <Link
            to={feedbackHref}
            className="text-text underline decoration-wire underline-offset-4 hover:decoration-amber"
          >
            Feedback
          </Link>
          <p aria-hidden className="hidden items-center gap-2 sm:flex">
            <kbd>/</kbd> search
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-[1440px] px-3 pb-3 text-[11px] text-mute sm:px-4">
        <p>
          Card images © their respective owners. Not affiliated with or endorsed by The Pokémon
          Company, Disney or Ravensburger.
          {takedownEmail && (
            <>
              {" "}
              Rights holder? Contact{" "}
              <a
                href={`mailto:${takedownEmail}`}
                className="text-text underline decoration-wire underline-offset-4 hover:decoration-amber"
              >
                {takedownEmail}
              </a>
              .
            </>
          )}
        </p>
      </div>
    </footer>
  );
}
