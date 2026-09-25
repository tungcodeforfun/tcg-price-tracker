import type { CardSummary } from "@tcg/core";
import { useSearchParams } from "react-router";
import { getSet } from "~/.server/catalog";
import { db } from "~/.server/db";
import { env } from "~/.server/env";
import { CardGrid } from "~/components/terminal/card-grid";
import { DataTable, RowLink, Th } from "~/components/terminal/data-table";
import { EmptyState } from "~/components/terminal/empty-state";
import { Price, Stat, StatGrid } from "~/components/terminal/figures";
import { known, setCode, shortName } from "~/components/terminal/labels";
import { Breadcrumbs, SegmentedLinks } from "~/components/terminal/navigation";
import { PageBody, PageHeader } from "~/components/terminal/page";
import { Panel } from "~/components/terminal/panel";
import { formatDate } from "~/lib/format";
import { CATALOG_CACHE, notFound } from "~/lib/http";
import { pageMeta } from "~/lib/seo";
import type { Route } from "./+types/set";

export async function loader({ params }: Route.LoaderArgs) {
  const result = await getSet(db, params.setId);
  if (!result) throw notFound();
  return { ...result, origin: env.appUrl };
}

export const headers: Route.HeadersFunction = () => ({ "Cache-Control": CATALOG_CACHE });

export const meta: Route.MetaFunction = ({ loaderData }) =>
  loaderData
    ? pageMeta({
        title: `${loaderData.set.name} prices · ${loaderData.set.gameName} · TCG Price Tracker`,
        description: `Current market prices for all ${loaderData.cards.length} cards in ${loaderData.set.gameName} ${loaderData.set.name}.`,
        origin: loaderData.origin,
        path: `/sets/${loaderData.set.id}`,
      })
    : [];

function CardTable({ cards }: { cards: CardSummary[] }) {
  return (
    <DataTable caption="Cards in this set by number, with the Near Mint price">
      <thead>
        <tr>
          <Th className="w-16">No.</Th>
          <Th>Card</Th>
          <Th className="hidden sm:table-cell">Rarity</Th>
          <Th numeric>Last · NM</Th>
        </tr>
      </thead>
      <tbody>
        {cards.map((card) => (
          <tr key={card.slug}>
            <td className="text-mute">{known(card.number) ?? "—"}</td>
            <td className="w-full max-w-0">
              <RowLink to={`/cards/${card.slug}`} className="block truncate font-medium">
                {shortName(card.name)}
              </RowLink>
              <span className="block truncate text-[11px] text-mute sm:hidden">
                {known(card.rarity) ?? "—"}
              </span>
            </td>
            <td className="hidden text-mute sm:table-cell">{known(card.rarity) ?? "—"}</td>
            <td className="text-right font-medium">
              <Price cents={card.priceCents} />
            </td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}

export default function SetPage({ loaderData }: Route.ComponentProps) {
  const { set, cards } = loaderData;
  const [searchParams] = useSearchParams();
  const grid = searchParams.get("view") === "grid";
  const path = `/sets/${set.id}`;
  const code = setCode(set.name);
  return (
    <PageBody>
      <Breadcrumbs
        items={[
          { label: "Games", to: "/games" },
          { label: set.gameName, to: `/games/${set.gameId}` },
          { label: set.name },
        ]}
      />
      <PageHeader
        eyebrow={
          <>
            MKT ▸ {set.gameName} ▸ <span className="text-amber">{code}</span>
          </>
        }
        title={set.name}
      />
      <StatGrid className="mb-3 grid-cols-2 border border-grid sm:mb-4 sm:grid-cols-4">
        <Stat label="Symbol">
          <span className="text-amber">{code}</span>
        </Stat>
        <Stat label="Released">{set.releaseDate ? formatDate(set.releaseDate) : "—"}</Stat>
        <Stat label="Prices updated">
          {set.pricesSyncedAt ? formatDate(set.pricesSyncedAt) : "—"}
        </Stat>
        <Stat label="Cards">{cards.length.toLocaleString("en-US")}</Stat>
      </StatGrid>
      <Panel
        code="F5"
        title="Cards"
        meta={
          <SegmentedLinks
            label="Card view"
            preventScrollReset
            items={[
              { to: path, label: "Table", current: !grid },
              { to: `${path}?view=grid`, label: "Grid", current: grid },
            ]}
          />
        }
        className="border border-grid"
      >
        {cards.length === 0 ? (
          <EmptyState title="No cards in this set yet" />
        ) : grid ? (
          <div className="-m-px">
            <CardGrid cards={cards} />
          </div>
        ) : (
          <CardTable cards={cards} />
        )}
      </Panel>
    </PageBody>
  );
}
