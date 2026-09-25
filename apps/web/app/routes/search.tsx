import type { CardSummary } from "@tcg/core";
import { Form, useSearchParams } from "react-router";
import { MIN_QUERY_LENGTH, listGames, searchCards, type SearchSort } from "~/.server/catalog";
import { db } from "~/.server/db";
import { env } from "~/.server/env";
import { Button, ButtonLink } from "~/components/terminal/button";
import { CardGrid } from "~/components/terminal/card-grid";
import { DataTable, RowLink, Th } from "~/components/terminal/data-table";
import { EmptyState } from "~/components/terminal/empty-state";
import { Price } from "~/components/terminal/figures";
import { Field, Select } from "~/components/terminal/form";
import { known, shortName, symbolFor } from "~/components/terminal/labels";
import { SegmentedLinks } from "~/components/terminal/navigation";
import { PageBody, PageHeader } from "~/components/terminal/page";
import { Panel } from "~/components/terminal/panel";
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

interface SearchState {
  query: string;
  gameId: string;
  sort: SearchSort;
  page: number;
  grid: boolean;
}

/** Search URL for a state; defaults (all games, best match, page 1, table) stay implicit. */
function searchHref({ query, gameId, sort, page, grid }: SearchState): string {
  const search = new URLSearchParams({ q: query });
  if (gameId) search.set("game", gameId);
  if (sort !== "relevance") search.set("sort", sort);
  if (page > 1) search.set("page", String(page));
  if (grid) search.set("view", "grid");
  return `/search?${search}`;
}

function ResultsTable({ cards }: { cards: CardSummary[] }) {
  return (
    <DataTable caption="Matching cards with their set, rarity and Near Mint price">
      <thead>
        <tr>
          <Th className="hidden w-24 sm:table-cell">Sym</Th>
          <Th>Card</Th>
          <Th className="hidden sm:table-cell">Set</Th>
          <Th className="hidden md:table-cell">Rarity</Th>
          <Th numeric>Last · NM</Th>
        </tr>
      </thead>
      <tbody>
        {cards.map((card) => (
          <tr key={card.slug}>
            <td className="hidden font-bold sm:table-cell">{symbolFor(card)}</td>
            <td className="w-full max-w-0">
              <RowLink to={`/cards/${card.slug}`} className="block truncate font-medium">
                {shortName(card.name)}
              </RowLink>
              <span className="block truncate text-[11px] text-mute sm:hidden">
                {symbolFor(card)} · {card.setName}
              </span>
            </td>
            <td className="hidden max-w-64 truncate text-mute sm:table-cell">{card.setName}</td>
            <td className="hidden text-mute md:table-cell">{known(card.rarity) ?? "—"}</td>
            <td className="text-right font-medium">
              <Price cents={card.priceCents} />
            </td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}

interface ResultsProps {
  state: SearchState;
  minQueryLength: number;
  cards: CardSummary[];
}

function Results({ state, minQueryLength, cards }: ResultsProps) {
  if (!state.query) {
    return (
      <EmptyState title="Enter a card name">
        Use the search box at the top of the page; press <kbd>/</kbd> to jump to it.
      </EmptyState>
    );
  }
  if (state.query.length < minQueryLength) {
    return (
      <EmptyState title="Query too short">
        Type at least {minQueryLength} characters to search.
      </EmptyState>
    );
  }
  if (cards.length === 0 && state.page > 1) {
    return (
      <EmptyState title="No more results">
        Page {state.page} is past the last match for “{state.query}”.
      </EmptyState>
    );
  }
  if (cards.length === 0) {
    return (
      <EmptyState
        title={`No cards match “${state.query}”`}
        action={
          state.gameId && (
            <ButtonLink to={searchHref({ ...state, gameId: "", page: 1 })} variant="secondary">
              Search all games
            </ButtonLink>
          )
        }
      >
        Check the spelling, or search for part of the card name.
      </EmptyState>
    );
  }
  if (state.grid) {
    return (
      <div className="-m-px">
        <CardGrid cards={cards} showSet />
      </div>
    );
  }
  return <ResultsTable cards={cards} />;
}

export default function Search({ loaderData }: Route.ComponentProps) {
  const { query, minQueryLength, gameId, sort, page, games, cards, hasMore } = loaderData;
  const [searchParams] = useSearchParams();
  const state: SearchState = {
    query,
    gameId,
    sort,
    page,
    grid: searchParams.get("view") === "grid",
  };

  return (
    <PageBody>
      <PageHeader
        eyebrow="MKT ▸ Search"
        title={query ? `Results for “${query}”` : "Search cards"}
      />
      <Form
        method="get"
        aria-label="Search filters"
        className="mb-3 grid grid-cols-2 items-end gap-3 border border-grid bg-deck p-3 sm:mb-4 sm:flex sm:flex-wrap"
      >
        <input type="hidden" name="q" value={query} />
        {state.grid && <input type="hidden" name="view" value="grid" />}
        <Field label="Game" className="sm:w-56">
          <Select name="game" defaultValue={gameId}>
            <option value="">All games</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Sort" className="sm:w-56">
          <Select name="sort" defaultValue={sort}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="secondary" className="col-span-2">
          Apply
        </Button>
      </Form>

      <Panel
        title="Results"
        meta={
          cards.length > 0 && (
            <SegmentedLinks
              label="Result view"
              preventScrollReset
              items={[
                { to: searchHref({ ...state, grid: false }), label: "Table", current: !state.grid },
                { to: searchHref({ ...state, grid: true }), label: "Grid", current: state.grid },
              ]}
            />
          )
        }
        className="border border-grid"
      >
        <Results state={state} minQueryLength={minQueryLength} cards={cards} />
      </Panel>

      {(page > 1 || hasMore) && (
        <nav aria-label="Pagination" className="mt-3 flex items-center justify-between gap-2">
          {page > 1 ? (
            <ButtonLink to={searchHref({ ...state, page: page - 1 })} variant="secondary">
              ← Previous
            </ButtonLink>
          ) : (
            <span />
          )}
          <span className="micro">Page {page}</span>
          {hasMore ? (
            <ButtonLink to={searchHref({ ...state, page: page + 1 })} variant="secondary">
              Next →
            </ButtonLink>
          ) : (
            <span />
          )}
        </nav>
      )}
    </PageBody>
  );
}
