import { Form, Link } from "react-router";

export function SiteHeader({ query = "" }: { query?: string }) {
  return (
    <header className="border-b border-gray-200 dark:border-gray-800">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link to="/" className="font-semibold">
          TCG Price Tracker
        </Link>
        <Form
          method="get"
          action="/search"
          role="search"
          className="order-last w-full sm:order-none sm:w-auto sm:flex-1"
        >
          <label className="sr-only" htmlFor="site-search">
            Search cards
          </label>
          <input
            id="site-search"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search cards…"
            className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-1.5 text-sm dark:border-gray-700 sm:max-w-md"
          />
        </Form>
        <nav className="ml-auto flex gap-4 text-sm">
          <Link to="/games" className="hover:underline">
            Games
          </Link>
          <Link to="/app" className="hover:underline">
            My collection
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-gray-200 py-6 text-center text-xs text-gray-500 dark:border-gray-800">
      Market prices from{" "}
      <a href="https://justtcg.com" className="underline" rel="noopener">
        JustTCG
      </a>
      . Prices are estimates, not offers.
    </footer>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-gray-500">
      <ol className="flex flex-wrap gap-1">
        {items.map((item, i) => (
          <li key={item.label} className="flex gap-1">
            {i > 0 && <span aria-hidden>/</span>}
            {item.to ? (
              <Link to={item.to} className="hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
