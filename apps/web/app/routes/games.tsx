import { listGames } from "~/.server/catalog";
import { db } from "~/.server/db";
import { env } from "~/.server/env";
import { DataTable, RowLink, Th } from "~/components/terminal/data-table";
import { EmptyState } from "~/components/terminal/empty-state";
import { setCode } from "~/components/terminal/labels";
import { PageBody, PageHeader } from "~/components/terminal/page";
import { Panel } from "~/components/terminal/panel";
import { CATALOG_CACHE } from "~/lib/http";
import { pageMeta } from "~/lib/seo";
import type { Route } from "./+types/games";

export async function loader() {
  return { games: await listGames(db), origin: env.appUrl };
}

export const headers: Route.HeadersFunction = () => ({ "Cache-Control": CATALOG_CACHE });

export const meta: Route.MetaFunction = ({ loaderData }) =>
  pageMeta({
    title: "Trading card games · TCG Price Tracker",
    description: "Browse card prices for Pokémon, One Piece, Lorcana and more.",
    origin: loaderData.origin,
    path: "/games",
  });

export default function Games({ loaderData }: Route.ComponentProps) {
  const { games } = loaderData;
  return (
    <PageBody>
      <PageHeader eyebrow="MKT ▸ Games" title="Games" meta="Card prices by game" />
      <Panel
        code="F2"
        title="Markets"
        meta={`${games.length} ${games.length === 1 ? "game" : "games"}`}
        className="border border-grid"
      >
        {games.length === 0 ? (
          <EmptyState title="No games tracked yet" />
        ) : (
          <DataTable caption="Tracked games and their set counts">
            <thead>
              <tr>
                <Th className="w-20">Sym</Th>
                <Th>Game</Th>
                <Th numeric>Sets</Th>
                <Th className="w-10">
                  <span className="sr-only">Open</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {games.map((game) => (
                <tr key={game.id}>
                  <td className="font-bold text-amber">{setCode(game.name)}</td>
                  <td className="w-full max-w-0">
                    <RowLink
                      to={`/games/${game.id}`}
                      className="block truncate font-sans text-[15px] font-medium"
                    >
                      {game.name}
                    </RowLink>
                  </td>
                  <td className="text-right">{game.setsCount.toLocaleString("en-US")}</td>
                  <td aria-hidden className="text-right text-amber">
                    →
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
