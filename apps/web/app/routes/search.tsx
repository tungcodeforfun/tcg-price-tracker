import { MIN_QUERY_LENGTH, listGames, searchCards, type SearchSort } from "~/.server/catalog";
import { Form, Link } from "react-router";
import { db } from "~/.server/db";
import { env } from "~/.server/env";
import { CardGrid } from "~/components/card-tile";
import { SEARCH_CACHE } from "~/lib/http";
import type { Route } from "./+types/search";

const PAGE_SIZE = 24;
const SORTS: { value: SearchSort; label: string }[] = [
  { value: "relevance", label: "Best match" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "name", label: "Name" },
];

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const games = await listGames(db);
  const gameParam = url.searchParams.get("game");
  const gameId = games.some((g) => g.id === gameParam) ? (gameParam ?? undefined) : undefined;
  const sort = SORTS.find((s) => s.value === url.searchParams.get("sort"))?.value ?? "relevance";
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const result = await searchCards(db, {
    query,
    gameId,
    sort,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  return {
    query,
    minQueryLength: MIN_QUERY_LENGTH,
    gameId: gameId ?? "",
    sort,
    page,
    games,
    ...result,
    origin: env.appUrl,
  };
}

export const headers: Route.HeadersFunction = () => ({ "Cache-Control": SEARCH_CACHE });

export const meta: Route.MetaFunction = ({ loaderData }) => [
  {
    title: loaderData.query
      ? `“${loaderData.query}” · Search · TCG Price Tracker`
      : "Search · TCG Price Tracker",
  },
  { name: "robots", content: "noindex, follow" },
];

export default function Search({ loaderData }: Route.ComponentProps) {
  const { query, minQueryLength, gameId, sort, page, games, cards, hasMore } = loaderData;
  const pageLink = (p: number) => {
    const search = new URLSearchParams({ q: query });
    if (gameId) search.set("game", gameId);
    if (sort !== "relevance") search.set("sort", sort);
    if (p > 1) search.set("page", String(p));
    return `?${search}`;
  };
  const selectClass =
    "rounded-md border border-gray-300 bg-transparent px-2 py-1.5 text-sm dark:border-gray-700";

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">
        {query ? `Results for “${query}”` : "Search cards"}
      </h1>
      <Form method="get" className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="q" value={query} />
        <label className="text-sm">
          <span className="block text-gray-500">Game</span>
          <select name="game" defaultValue={gameId} className={selectClass}>
            <option value="">All games</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-gray-500">Sort</span>
          <select name="sort" defaultValue={sort} className={selectClass}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700"
        >
          Apply
        </button>
      </Form>

      <div className="mt-6">
        {query.length < minQueryLength ? (
          <p className="text-gray-600 dark:text-gray-400">
            Type at least {minQueryLength} characters to search.
          </p>
        ) : cards.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">No cards match “{query}”.</p>
        ) : (
          <CardGrid cards={cards} showSet />
        )}
      </div>

      {(page > 1 || hasMore) && (
        <nav aria-label="Pagination" className="mt-8 flex justify-between text-sm">
          {page > 1 ? <Link to={pageLink(page - 1)}>← Previous</Link> : <span />}
          {hasMore && <Link to={pageLink(page + 1)}>Next →</Link>}
        </nav>
      )}
    </>
  );
}
