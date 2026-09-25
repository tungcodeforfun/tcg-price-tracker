import { deleteSale, listSales } from "~/.server/catalog";
import { Form, Link, redirect } from "react-router";
import { db } from "~/.server/db";
import { requireSession } from "~/.server/session";
import { formString } from "~/components/auth-form";
import { Pnl } from "~/components/pnl";
import { formatDate, formatPrice } from "~/lib/format";
import { notFound } from "~/lib/http";
import type { Route } from "./+types/app-sales";

export const meta: Route.MetaFunction = () => [{ title: "Sales · TCG Price Tracker" }];

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireSession(request);
  const sales = await listSales(db, user.id);
  let realizedCents = 0;
  let unknownCost = 0;
  for (const sale of sales) {
    if (sale.realizedCents === null) unknownCost += 1;
    else realizedCents += sale.realizedCents;
  }
  return { sales, realizedCents, unknownCost };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireSession(request);
  const form = await request.formData();
  if (!(await deleteSale(db, user.id, formString(form, "saleId")))) throw notFound();
  return redirect("/app/sales");
}

export default function Sales({ loaderData }: Route.ComponentProps) {
  const { sales, realizedCents, unknownCost } = loaderData;
  const num = "py-2 pl-3 text-right tabular-nums";

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Sales</h1>
        <a href="/app/export/sales.csv" download className="text-sm underline">
          Export sales
        </a>
      </div>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Record a sale from a lot’s page in your{" "}
        <Link to="/app/collection" className="underline">
          collection
        </Link>
        . Deleting a sale only removes it from this log; it doesn’t put the cards back into your
        collection.
      </p>

      {sales.length === 0 ? (
        <p className="mt-6 text-gray-600 dark:text-gray-400">No sales recorded yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="py-2 font-medium">Sold</th>
                <th className="py-2 pl-3 font-medium">Card</th>
                <th className="py-2 pl-3 font-medium">Printing / condition</th>
                <th className="py-2 pl-3 text-right font-medium">Qty</th>
                <th className="py-2 pl-3 text-right font-medium">Price each</th>
                <th className="py-2 pl-3 text-right font-medium">Fees</th>
                <th className="py-2 pl-3 text-right font-medium">Cost basis</th>
                <th className="py-2 pl-3 text-right font-medium">Realized P&L</th>
                <th className="py-2 pl-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {sales.map((s) => (
                <tr key={s.id}>
                  <td className="py-2 whitespace-nowrap">{formatDate(s.soldOn)}</td>
                  <td className="py-2 pl-3">
                    <Link to={`/cards/${s.cardSlug}`} className="hover:underline">
                      {s.cardName}
                    </Link>
                    <span className="block text-xs text-gray-500">{s.setName}</span>
                    {s.notes && <span className="block text-xs text-gray-500">{s.notes}</span>}
                  </td>
                  <td className="py-2 pl-3">
                    {s.printing} · {s.condition}
                  </td>
                  <td className={num}>{s.quantity}</td>
                  <td className={num}>{formatPrice(s.unitPriceCents)}</td>
                  <td className={num}>{formatPrice(s.feesCents)}</td>
                  <td className={num}>{formatPrice(s.costBasisCents)}</td>
                  <td className={num}>
                    <Pnl cents={s.realizedCents} />
                  </td>
                  <td className="py-2 pl-3">
                    <Form
                      method="post"
                      onSubmit={(event) => {
                        if (!confirm("Delete this sale from the log? The lot won’t be restored."))
                          event.preventDefault();
                      }}
                    >
                      <input type="hidden" name="saleId" value={s.id} />
                      <button
                        type="submit"
                        className="text-red-700 underline dark:text-red-400"
                        aria-label={`Delete sale of ${s.cardName} on ${formatDate(s.soldOn)}`}
                      >
                        Delete
                      </button>
                    </Form>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-300 font-semibold dark:border-gray-700">
                <td className="py-2" colSpan={7}>
                  Total realized
                </td>
                <td className={num}>
                  <Pnl cents={realizedCents} />
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
          {unknownCost > 0 && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {unknownCost} {unknownCost === 1 ? "sale has" : "sales have"} no cost basis and{" "}
              {unknownCost === 1 ? "is" : "are"} left out of the total.
            </p>
          )}
        </div>
      )}
    </>
  );
}
