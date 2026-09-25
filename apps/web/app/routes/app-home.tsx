import { getPortfolioHistory, getPortfolioSummary, listHoldings } from "~/.server/catalog";
import { Link } from "react-router";
import { db } from "~/.server/db";
import { requireSession } from "~/.server/session";
import { ButtonLink } from "~/components/terminal/button";
import { DataTable, RowLink, Th } from "~/components/terminal/data-table";
import { EmptyState } from "~/components/terminal/empty-state";
import { Price, Stat, StatGrid } from "~/components/terminal/figures";
import { FormMessage } from "~/components/terminal/form";
import { shortName, symbolFor } from "~/components/terminal/labels";
import { SegmentedLinks } from "~/components/terminal/navigation";
import { PageBody, PageHeader } from "~/components/terminal/page";
import { Panel, PanelGrid } from "~/components/terminal/panel";
import { TradingChart } from "~/components/terminal/trading-chart";
import { todayIsoDate } from "~/lib/format";
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
  ].map((p) => ({ day: p.day, cents: p.valueCents }));
  return {
    summary,
    range,
    points,
    topHoldings: holdings.slice(0, TOP_HOLDINGS),
    holdingCount: holdings.length,
  };
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export default function AppHome({ loaderData }: Route.ComponentProps) {
  const { summary, range, points, topHoldings, holdingCount } = loaderData;
  const figure = "text-[20px] leading-tight font-semibold sm:text-[24px]";

  return (
    <PageBody>
      <PageHeader
        eyebrow="ACCT ▸ Dashboard"
        title="Dashboard"
        meta={`${holdingCount} ${plural(holdingCount, "lot", "lots")} · ${summary.cardCount} ${plural(summary.cardCount, "card", "cards")}`}
      />
      <PanelGrid className="lg:grid-cols-12">
        <Panel code="F1" title="Portfolio summary" meta="USD" className="lg:col-span-12">
          <StatGrid className="grid-cols-2 sm:grid-cols-4">
            <Stat label="Value">
              <Price cents={summary.valueCents} className={figure} />
            </Stat>
            <Stat label="Cost basis">
              <Price cents={summary.costBasisCents} className={figure} />
            </Stat>
            <Stat label="Unrealized P&L">
              <Price cents={summary.unrealizedCents} signed className={figure} />
            </Stat>
            <Stat label="Realized P&L">
              <Price cents={summary.realizedCents} signed className={figure} />
            </Stat>
          </StatGrid>
          {(summary.unpricedLots > 0 || summary.unknownCostLots > 0) && (
            <FormMessage tone="info" className="border-t border-t-grid">
              <ul className="space-y-1">
                {summary.unpricedLots > 0 && (
                  <li>
                    {summary.unpricedLots} {plural(summary.unpricedLots, "lot has", "lots have")} no
                    market price and {plural(summary.unpricedLots, "is", "are")} left out of the
                    value.
                  </li>
                )}
                {summary.unknownCostLots > 0 && (
                  <li>
                    {summary.unknownCostLots}{" "}
                    {plural(summary.unknownCostLots, "lot has", "lots have")} no recorded cost and{" "}
                    {plural(summary.unknownCostLots, "is", "are")} left out of the cost basis and
                    unrealized P&L.
                  </li>
                )}
              </ul>
            </FormMessage>
          )}
        </Panel>

        {holdingCount === 0 ? (
          <Panel code="F2" title="Holdings" className="lg:col-span-12">
            <EmptyState
              title="Your collection is empty"
              action={
                <>
                  <ButtonLink to="/games">Browse cards</ButtonLink>
                  <ButtonLink to="/app/import" variant="secondary">
                    Import CSV
                  </ButtonLink>
                </>
              }
            >
              Find a card, then choose “Add to collection” on its page, or import a CSV.
            </EmptyState>
          </Panel>
        ) : (
          <>
            <Panel
              code="F2"
              title="Portfolio value"
              className="lg:col-span-8"
              meta={
                <SegmentedLinks
                  label="History range"
                  preventScrollReset
                  items={RANGES.map((r) => ({
                    to: r === 30 ? "." : `?range=${r}`,
                    label: r === 365 ? "1Y" : `${r}D`,
                    current: r === range,
                  }))}
                />
              }
            >
              <div className="px-1 pt-1 pb-2 sm:px-2">
                <TradingChart subject="Portfolio value" points={points} />
              </div>
            </Panel>

            <Panel
              code="F3"
              title="Top holdings"
              className="lg:col-span-4"
              meta={
                <Link to="/app/collection" className="text-amber hover:underline">
                  View all {holdingCount}
                </Link>
              }
            >
              <DataTable caption="Your most valuable lots">
                <thead>
                  <tr>
                    <Th>Card</Th>
                    <Th numeric>Qty</Th>
                    <Th numeric>Value</Th>
                    <Th numeric>Unrealized</Th>
                  </tr>
                </thead>
                <tbody>
                  {topHoldings.map((h) => (
                    <tr key={h.itemId}>
                      <td className="w-full max-w-0">
                        <RowLink
                          to={`/app/items/${h.itemId}`}
                          className="block truncate font-medium"
                        >
                          {shortName(h.cardName)}
                        </RowLink>
                        <span className="block truncate text-[11px] text-mute">
                          {symbolFor({ setName: h.setName, number: h.cardNumber })} · {h.printing} ·{" "}
                          {h.condition}
                        </span>
                      </td>
                      <td className="text-right">{h.quantity}</td>
                      <td className="text-right font-medium">
                        <Price cents={h.valueCents} />
                      </td>
                      <td className="text-right">
                        <Price cents={h.unrealizedCents} signed />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </Panel>
          </>
        )}
      </PanelGrid>
    </PageBody>
  );
}
