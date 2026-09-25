import { deleteSale, listSales } from "~/.server/catalog";
import { Form, Link, redirect } from "react-router";
import { db } from "~/.server/db";
import { requireSession } from "~/.server/session";
import { Button, buttonClass } from "~/components/terminal/button";
import { DataTable, Th } from "~/components/terminal/data-table";
import { EmptyState } from "~/components/terminal/empty-state";
import { Price } from "~/components/terminal/figures";
import { FormMessage } from "~/components/terminal/form";
import { PageBody, PageHeader } from "~/components/terminal/page";
import { Panel } from "~/components/terminal/panel";
import { formString } from "~/lib/form";
import { formatDate } from "~/lib/format";
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

  return (
    <PageBody>
      <PageHeader
        eyebrow="ACCT ▸ Sales"
        title="Sales"
        meta={
          <a
            href="/app/export/sales.csv"
            download
            className={buttonClass({ variant: "secondary", size: "sm" })}
          >
            Export sales
          </a>
        }
      />
      <p className="mb-3 max-w-prose text-[12.5px] text-mute">
        Record a sale from a lot’s page in your{" "}
        <Link
          to="/app/collection"
          className="text-text underline decoration-wire underline-offset-4 hover:decoration-amber"
        >
          collection
        </Link>
        . Deleting a sale only removes it from this log; it doesn’t put the cards back into your
        collection.
      </p>

      <Panel
        code="F1"
        title="Sales log"
        meta={`${sales.length} ${sales.length === 1 ? "sale" : "sales"}`}
        className="border border-grid"
      >
        {sales.length === 0 ? (
          <EmptyState title="No sales recorded yet" />
        ) : (
          <>
            <DataTable caption="Recorded sales, newest first, with the total realized P&L.">
              <thead>
                <tr>
                  <Th>Sold</Th>
                  <Th>Card</Th>
                  <Th className="hidden sm:table-cell">Printing / condition</Th>
                  <Th numeric>Qty</Th>
                  <Th numeric>Price each</Th>
                  <Th numeric className="hidden md:table-cell">
                    Fees
                  </Th>
                  <Th numeric className="hidden md:table-cell">
                    Cost basis
                  </Th>
                  <Th numeric>Realized P&L</Th>
                  {/* `relative` keeps the absolutely positioned sr-only text inside the scroller. */}
                  <Th className="relative">
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td className="text-mute">{formatDate(s.soldOn)}</td>
                    <td>
                      <Link to={`/cards/${s.cardSlug}`} className="font-medium hover:text-amber">
                        {s.cardName}
                      </Link>
                      <span className="block text-[11px] text-mute">{s.setName}</span>
                      <span className="block text-[11px] text-mute sm:hidden">
                        {s.printing} · {s.condition}
                      </span>
                      {s.notes && (
                        <span className="block max-w-[24rem] truncate text-[11px] text-mute">
                          {s.notes}
                        </span>
                      )}
                    </td>
                    <td className="hidden text-mute sm:table-cell">
                      {s.printing} · {s.condition}
                    </td>
                    <td className="text-right">{s.quantity}</td>
                    <td className="text-right">
                      <Price cents={s.unitPriceCents} />
                    </td>
                    <td className="hidden text-right text-mute md:table-cell">
                      <Price cents={s.feesCents} />
                    </td>
                    <td className="hidden text-right text-mute md:table-cell">
                      <Price cents={s.costBasisCents} />
                    </td>
                    <td className="text-right font-medium">
                      <Price cents={s.realizedCents} signed />
                    </td>
                    <td className="text-right">
                      <Form
                        method="post"
                        onSubmit={(event) => {
                          if (!confirm("Delete this sale from the log? The lot won’t be restored."))
                            event.preventDefault();
                        }}
                      >
                        <input type="hidden" name="saleId" value={s.id} />
                        <Button
                          variant="danger"
                          size="sm"
                          aria-label={`Delete sale of ${s.cardName} on ${formatDate(s.soldOn)}`}
                        >
                          Delete
                        </Button>
                      </Form>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="micro text-text">
                    Total realized
                  </td>
                  <td className="hidden sm:table-cell" />
                  <td colSpan={2} className="hidden md:table-cell" />
                  <td className="text-right">
                    <Price cents={realizedCents} signed />
                  </td>
                  <td />
                </tr>
              </tfoot>
            </DataTable>
            {unknownCost > 0 && (
              <FormMessage tone="info" className="border-t border-t-grid">
                {unknownCost} {unknownCost === 1 ? "sale has" : "sales have"} no cost basis and{" "}
                {unknownCost === 1 ? "is" : "are"} left out of the total.
              </FormMessage>
            )}
          </>
        )}
      </Panel>
    </PageBody>
  );
}
