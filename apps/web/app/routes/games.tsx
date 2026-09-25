import { listGames } from "~/.server/catalog";
import { Link } from "react-router";
import { db } from "~/.server/db";
import { env } from "~/.server/env";
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
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Games</h1>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {loaderData.games.map((game) => (
          <li key={game.id}>
            <Link
              to={`/games/${game.id}`}
              className="block rounded-lg border border-gray-200 p-5 hover:border-gray-400 dark:border-gray-800 dark:hover:border-gray-600"
            >
              <span className="text-lg font-medium">{game.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
