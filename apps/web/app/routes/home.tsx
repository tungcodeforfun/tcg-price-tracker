import { Link, useSearchParams } from "react-router";
import { getHomeHighlights } from "~/.server/catalog";
import { db } from "~/.server/db";
import { CATALOG_CACHE } from "~/lib/http";
import { HoloHome } from "~/prototype/holo/home";
import { LedgerHome } from "~/prototype/ledger/home";
import { TerminalHome } from "~/prototype/terminal/home";
import { readVariant } from "~/prototype/types";
import { VariantSwitcher } from "~/prototype/variant-switcher";
import type { Route } from "./+types/home";

export const meta: Route.MetaFunction = () => [
  { title: "TCG Price Tracker" },
  { name: "description", content: "Track trading card prices and your collection's value." },
];

export const headers: Route.HeadersFunction = () => ({ "Cache-Control": CATALOG_CACHE });

export async function loader() {
  return { highlights: await getHomeHighlights(db) };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const variant = readVariant(useSearchParams()[0]);
  if (variant) {
    const Page = { A: LedgerHome, B: TerminalHome, C: HoloHome }[variant];
    return (
      <>
        <Page highlights={loaderData.highlights} />
        <VariantSwitcher current={variant} />
      </>
    );
  }
  return (
    <div className="max-w-3xl py-8">
      <h1 className="text-3xl font-semibold tracking-tight">TCG Price Tracker</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        Track trading card prices and your collection's value.
      </p>
      <div className="mt-8 flex gap-3 text-sm font-medium">
        <Link
          to="/games"
          className="rounded-md bg-gray-900 px-4 py-2 text-white dark:bg-gray-100 dark:text-gray-900"
        >
          Browse prices
        </Link>
        <Link to="/signup" className="rounded-md border border-gray-300 px-4 py-2 dark:border-gray-700">
          Create an account
        </Link>
      </div>
    </div>
  );
}
