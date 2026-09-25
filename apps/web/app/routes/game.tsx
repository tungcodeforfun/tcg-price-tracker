import { getGame } from "~/.server/catalog";
import { Link } from "react-router";
import { db } from "~/.server/db";
import { env } from "~/.server/env";
import { Breadcrumbs } from "~/components/site-header";
import { formatDate } from "~/lib/format";
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
    <>
      <Breadcrumbs items={[{ label: "Games", to: "/games" }, { label: game.name }]} />
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{game.name}</h1>
      {sets.length === 0 ? (
        <p className="mt-6 text-gray-600 dark:text-gray-400">No sets have prices yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-gray-200 dark:divide-gray-800">
          {sets.map((set) => (
            <li key={set.id}>
              <Link
                to={`/sets/${set.id}`}
                className="flex items-baseline justify-between gap-4 py-3 hover:underline"
              >
                <span className="font-medium">{set.name}</span>
                <span className="shrink-0 text-sm text-gray-500">
                  {set.releaseDate ? formatDate(set.releaseDate) : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
