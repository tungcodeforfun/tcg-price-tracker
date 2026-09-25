import { getSet } from "~/.server/catalog";
import { db } from "~/.server/db";
import { env } from "~/.server/env";
import { CardGrid } from "~/components/card-tile";
import { Breadcrumbs } from "~/components/site-header";
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

export default function SetPage({ loaderData }: Route.ComponentProps) {
  const { set, cards } = loaderData;
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Games", to: "/games" },
          { label: set.gameName, to: `/games/${set.gameId}` },
          { label: set.name },
        ]}
      />
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{set.name}</h1>
      <p className="mt-1 text-sm text-gray-500">
        {cards.length} cards
        {set.releaseDate && <> · Released {formatDate(set.releaseDate)}</>}
        {set.pricesSyncedAt && <> · Prices updated {formatDate(set.pricesSyncedAt)}</>}
      </p>
      <div className="mt-6">
        <CardGrid cards={cards} />
      </div>
    </>
  );
}
