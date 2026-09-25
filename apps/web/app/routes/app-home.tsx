import { getPortfolioHistory, getPortfolioSummary, listHoldings } from "~/.server/catalog";
import { Link } from "react-router";
import type { ReactNode } from "react";
import { db } from "~/.server/db";
import { requireSession } from "~/.server/session";
import { Pnl } from "~/components/pnl";
import { PriceChart } from "~/components/price-chart";
import { formatPrice, todayIsoDate } from "~/lib/format";
import type { Route } from "./+types/app-home";

const RANGES = [30, 90, 365] as const;
const TOP_HOLDINGS = 5;

export const meta: Route.MetaFunction = () => [{ title: "Dashboard · TCG Price Tracker" }];

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireSession(request);
  const url = new URL(request.url);
  const range = RANGES.find((r) => String(r) === url.searchParams.get("range")) ?? 30;
  const [summary, history, holdings] = await Promise.all([
    getPortfolioSummary(db, user.id),
    getPortfolioHistory(db, user.id, range),
    listHoldings(db, user.id),
  ]);
  const today = todayIsoDate();
  const points = [
    ...history.filter((p) => p.day !== today),
    { day: today, valueCents: summary.valueCents },
  ].map((p) => ({ day: p.day, priceCents: p.valueCents }));
  return {
    summary,
    range,
    points,
    topHoldings: holdings.slice(0, TOP_HOLDINGS),
    holdingCount: holdings.length,
  };
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

export default function AppHome({ loaderData }: Route.ComponentProps) {
  const { summary, range, points, topHoldings, holdingCount } = loaderData;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <dl className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile label="Value">{formatPrice(summary.valueCents)}</Tile>
        <Tile label="Cost basis">{formatPrice(summary.costBasisCents)}</Tile>
        <Tile label="Unrealized P&L">
          <Pnl cents={summary.unrealizedCents} />
        </Tile>
        <Tile label="Realized P&L">
          <Pnl cents={summary.realizedCents} />
        </Tile>
      </dl>
      {(summary.unpricedLots > 0 || summary.unknownCostLots > 0) && (
        <ul className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-400">
          {summary.unpricedLots > 0 && (
            <li>
              {summary.unpricedLots} {summary.unpricedLots === 1 ? "lot has" : "lots have"} no
              market price and {summary.unpricedLots === 1 ? "is" : "are"} left out of the value.
            </li>
          )}
          {summary.unknownCostLots > 0 && (
            <li>
              {summary.unknownCostLots} {summary.unknownCostLots === 1 ? "lot has" : "lots have"} no
              recorded cost and {summary.unknownCostLots === 1 ? "is" : "are"} left out of the cost
              basis and unrealized P&L.
            </li>
          )}
        </ul>
      )}

      {holdingCount === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-gray-300 px-6 py-10 text-center dark:border-gray-700">
          <p className="font-medium">Your collection is empty.</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Find a card, then choose “Add to collection” on its page, or{" "}
            <Link to="/app/import" className="underline">
              import a CSV
            </Link>
            .
          </p>
          <Link
            to="/games"
            className="mt-4 inline-block rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
          >
            Browse cards
          </Link>
        </div>
      ) : (
        <>
          <section className="mt-8" aria-labelledby="value-heading">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="value-heading" className="text-lg font-semibold">
                Portfolio value
              </h2>
              <nav aria-label="History range" className="flex gap-1 text-sm">
                {RANGES.map((r) => (
                  <Link
                    key={r}
                    to={r === 30 ? "." : `?range=${r}`}
                    preventScrollReset
                    aria-current={r === range ? "true" : undefined}
                    className="rounded px-2 py-1 aria-[current]:bg-gray-900 aria-[current]:text-white dark:aria-[current]:bg-gray-100 dark:aria-[current]:text-gray-900"
                  >
                    {r === 365 ? "1Y" : `${r}D`}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="mt-3">
              <PriceChart subject="Portfolio value" points={points} />
            </div>
          </section>

          <section className="mt-8" aria-labelledby="top-heading">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="top-heading" className="text-lg font-semibold">
                Top holdings
              </h2>
              <Link to="/app/collection" className="text-sm underline">
                View all {holdingCount}
              </Link>
            </div>
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-gray-500">
                <tr>
                  <th className="py-2 font-medium">Card</th>
                  <th className="py-2 text-right font-medium">Qty</th>
                  <th className="py-2 text-right font-medium">Value</th>
                  <th className="py-2 text-right font-medium">Unrealized</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {topHoldings.map((h) => (
                  <tr key={h.itemId}>
                    <td className="py-2">
                      <Link to={`/app/items/${h.itemId}`} className="hover:underline">
                        {h.cardName}
                      </Link>
                      <span className="block text-xs text-gray-500">
                        {h.setName} · {h.printing} · {h.condition}
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums">{h.quantity}</td>
                    <td className="py-2 text-right tabular-nums">{formatPrice(h.valueCents)}</td>
                    <td className="py-2 text-right tabular-nums">
                      <Pnl cents={h.unrealizedCents} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  );
}
