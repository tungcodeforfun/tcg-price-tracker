import { getGame } from "~/.server/catalog";
import { db } from "~/.server/db";
import { env } from "~/.server/env";
import { DataTable, RowLink, Th } from "~/components/terminal/data-table";
import { EmptyState } from "~/components/terminal/empty-state";
import { setCode } from "~/components/terminal/labels";
import { Breadcrumbs } from "~/components/terminal/navigation";
import { PageBody, PageHeader } from "~/components/terminal/page";
import { Panel } from "~/components/terminal/panel";
import { formatDate, formatShortDate } from "~/lib/format";
import { CATALOG_CACHE, notFound } from "~/lib/http";
import { pageMeta } from "~/lib/seo";
import type { Route } from "./+types/game";

export async function loader({ params }: Route.LoaderArgs) {
  const result = await getGame(db, params.gameId);
  if (!result) throw notFound();
  return { ...result, origin: env.appUrl };
}

export const headers: Route.HeadersFunction = () => ({ "Cache-Control": CATALOG_CACHE });

export const meta: Route.MetaFunction = ({ loaderData }) =>
  loaderData
    ? pageMeta({
        title: `${loaderData.game.name} card prices by set · TCG Price Tracker`,
        description: `Market prices for every ${loaderData.game.name} set we track.`,
        origin: loaderData.origin,
        path: `/games/${loaderData.game.id}`,
      })
    : [];

export default function Game({ loaderData }: Route.ComponentProps) {
  const { game, sets } = loaderData;
  return (
    <PageBody>
      <Breadcrumbs items={[{ label: "Games", to: "/games" }, { label: game.name }]} />
      <PageHeader eyebrow="MKT ▸ Sets" title={game.name} meta="Sets with prices · newest first" />
      <Panel
        code="F2"
        title="Sets"
        meta={`${sets.length} ${sets.length === 1 ? "set" : "sets"}`}
        className="border border-grid"
      >
        {sets.length === 0 ? (
          <EmptyState title="No sets have prices yet">
            {game.name} sets appear here once their prices have been synced.
          </EmptyState>
        ) : (
          <DataTable caption={`${game.name} sets, newest first`}>
            <thead>
              <tr>
                <Th className="w-20">Sym</Th>
                <Th>Set</Th>
                <Th numeric className="hidden sm:table-cell">
                  Released
                </Th>
                <Th numeric>Cards</Th>
                <Th numeric className="hidden md:table-cell">
                  Updated
                </Th>
              </tr>
            </thead>
            <tbody>
              {sets.map((set) => (
                <tr key={set.id}>
                  <td className="font-bold text-amber">{setCode(set.name)}</td>
                  <td className="w-full max-w-0">
                    <RowLink to={`/sets/${set.id}`} className="block truncate font-medium">
                      {set.name}
                    </RowLink>
                    <span className="block text-[11px] text-mute sm:hidden">
                      {set.releaseDate ? formatDate(set.releaseDate) : "Release date unknown"}
                    </span>
                  </td>
                  <td className="hidden text-right sm:table-cell">
                    {set.releaseDate ? formatDate(set.releaseDate) : "—"}
                  </td>
                  <td className="text-right">{set.cardsCount.toLocaleString("en-US")}</td>
                  <td className="hidden text-right text-mute md:table-cell">
                    {set.pricesSyncedAt ? formatShortDate(set.pricesSyncedAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Panel>
    </PageBody>
  );
}
