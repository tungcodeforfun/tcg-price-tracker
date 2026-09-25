import { listHoldings } from "~/.server/catalog";
import { Link } from "react-router";
import { db } from "~/.server/db";
import { requireSession } from "~/.server/session";
import { FormMessage } from "~/components/auth-form";
import { PercentChange, Pnl } from "~/components/pnl";
import { formatPrice } from "~/lib/format";
import type { Route } from "./+types/app-collection";

export const meta: Route.MetaFunction = () => [{ title: "Collection · TCG Price Tracker" }];

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireSession(request);
  const imported = Number.parseInt(new URL(request.url).searchParams.get("imported") ?? "", 10);
  return {
    holdings: await listHoldings(db, user.id),
    imported: Number.isNaN(imported) ? null : imported,
  };
}

export default function Collection({ loaderData }: Route.ComponentProps) {
  const { holdings, imported } = loaderData;
  const num = "py-2 pl-3 text-right tabular-nums";

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Collection</h1>
        <div className="flex gap-4 text-sm">
          <Link to="/app/import" className="underline">
            Import CSV
          </Link>
          <a href="/app/export/holdings.csv" download className="underline">
            Export holdings
          </a>
          <a href="/app/export/sales.csv" download className="underline">
            Export sales
          </a>
        </div>
      </div>
      {imported !== null && (
        <div className="mt-4">
          <FormMessage tone="success">
            Imported {imported} {imported === 1 ? "lot" : "lots"}.
          </FormMessage>
        </div>
      )}

      {holdings.length === 0 ? (
        <p className="mt-6 text-gray-600 dark:text-gray-400">
          No cards yet.{" "}
          <Link to="/games" className="underline">
            Browse cards
          </Link>{" "}
          and choose “Add to collection”, or{" "}
          <Link to="/app/import" className="underline">
            import a CSV
          </Link>
          .
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="py-2 font-medium">Card</th>
                <th className="py-2 pl-3 font-medium">Set</th>
                <th className="py-2 pl-3 font-medium">Printing / condition</th>
                <th className="py-2 pl-3 text-right font-medium">Qty</th>
                <th className="py-2 pl-3 text-right font-medium">Unit cost</th>
                <th className="py-2 pl-3 text-right font-medium">Market</th>
                <th className="py-2 pl-3 text-right font-medium">Value</th>
                <th className="py-2 pl-3 text-right font-medium">Unrealized</th>
                <th className="py-2 pl-3 text-right font-medium">7 days</th>
                <th className="py-2 pl-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {holdings.map((h) => (
                <tr key={h.itemId}>
                  <td className="py-2">
                    <Link to={`/cards/${h.cardSlug}`} className="hover:underline">
                      {h.cardName}
                    </Link>
                    {h.cardNumber && <span className="text-gray-500"> {h.cardNumber}</span>}
                  </td>
                  <td className="py-2 pl-3">{h.setName}</td>
                  <td className="py-2 pl-3">
                    {h.printing} · {h.condition}
                    {h.language !== "English" && (
                      <span className="text-gray-500"> ({h.language})</span>
                    )}
                  </td>
                  <td className={num}>{h.quantity}</td>
                  <td className={num}>{formatPrice(h.unitCostCents)}</td>
                  <td className={num}>{formatPrice(h.priceCents)}</td>
                  <td className={num}>{formatPrice(h.valueCents)}</td>
                  <td className={num}>
                    <Pnl cents={h.unrealizedCents} />
                  </td>
                  <td className={num}>
                    <PercentChange pct={h.priceChange7dPct} />
                  </td>
                  <td className="py-2 pl-3">
                    <Link to={`/app/items/${h.itemId}`} className="underline">
                      Manage<span className="sr-only"> {h.cardName}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
