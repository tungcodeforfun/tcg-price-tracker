import { listHoldings } from "~/.server/catalog";
import { db } from "~/.server/db";
import { requireSession } from "~/.server/session";
import { ButtonLink, buttonClass } from "~/components/terminal/button";
import { DataTable, RowLink, Th } from "~/components/terminal/data-table";
import { EmptyState } from "~/components/terminal/empty-state";
import { Delta, Price } from "~/components/terminal/figures";
import { FormMessage } from "~/components/terminal/form";
import { shortName, symbolFor } from "~/components/terminal/labels";
import { PageBody, PageHeader } from "~/components/terminal/page";
import { Panel } from "~/components/terminal/panel";
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
  const secondary = buttonClass({ variant: "secondary", size: "sm" });

  return (
    <PageBody>
      <PageHeader
        eyebrow="ACCT ▸ Collection"
        title="Collection"
        meta={
          <div className="flex flex-wrap gap-2">
            <ButtonLink to="/app/import" size="sm">
              Import CSV
            </ButtonLink>
            <a href="/app/export/holdings.csv" download className={secondary}>
              Export holdings
            </a>
            <a href="/app/export/sales.csv" download className={secondary}>
              Export sales
            </a>
          </div>
        }
      />
      {imported !== null && (
        <FormMessage tone="success" className="mb-3">
          Imported {imported} {imported === 1 ? "lot" : "lots"}.
        </FormMessage>
      )}

      <Panel
        code="F1"
        title="Holdings"
        meta={`${holdings.length} ${holdings.length === 1 ? "lot" : "lots"}`}
        className="border border-grid"
      >
        {holdings.length === 0 ? (
          <EmptyState
            title="No cards yet"
            action={
              <>
                <ButtonLink to="/games">Browse cards</ButtonLink>
                <ButtonLink to="/app/import" variant="secondary">
                  Import CSV
                </ButtonLink>
              </>
            }
          >
            Browse cards and choose “Add to collection”, or import a CSV.
          </EmptyState>
        ) : (
          <DataTable caption="Your lots. Select a row to edit, sell or delete it.">
            <thead>
              <tr>
                <Th className="hidden md:table-cell">Symbol</Th>
                <Th>Card</Th>
                <Th className="hidden sm:table-cell">Printing / condition</Th>
                <Th numeric>Qty</Th>
                <Th numeric className="hidden md:table-cell">
                  Cost
                </Th>
                <Th numeric>Last</Th>
                <Th numeric>Value</Th>
                <Th numeric>Unrealized</Th>
                <Th numeric>Chg 7D</Th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const variant = `${h.printing} · ${h.condition}${h.language === "English" ? "" : ` (${h.language})`}`;
                return (
                  <tr key={h.itemId}>
                    <td className="hidden font-bold tracking-[0.06em] md:table-cell">
                      {symbolFor({ setName: h.setName, number: h.cardNumber })}
                    </td>
                    <td>
                      <RowLink to={`/app/items/${h.itemId}`} className="font-medium">
                        {shortName(h.cardName)}
                        <span className="sr-only">, manage lot</span>
                      </RowLink>
                      <span className="block text-[11px] text-mute">{h.setName}</span>
                      <span className="block text-[11px] text-mute sm:hidden">{variant}</span>
                    </td>
                    <td className="hidden text-mute sm:table-cell">{variant}</td>
                    <td className="text-right">{h.quantity}</td>
                    <td className="hidden text-right text-mute md:table-cell">
                      <Price cents={h.unitCostCents} />
                    </td>
                    <td className="text-right">
                      <Price cents={h.priceCents} />
                    </td>
                    <td className="text-right font-medium">
                      <Price cents={h.valueCents} />
                    </td>
                    <td className="text-right">
                      <Price cents={h.unrealizedCents} signed />
                    </td>
                    <td className="text-right">
                      <Delta pct={h.priceChange7dPct} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </Panel>
    </PageBody>
  );
}
