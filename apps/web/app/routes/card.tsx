import type { CardDetail, PricePoint, VariantDetail } from "@tcg/core";
import { defaultVariant, getCard, getPriceHistory } from "~/.server/catalog";
import { db } from "~/.server/db";
import { env } from "~/.server/env";
import { ButtonLink } from "~/components/terminal/button";
import { DataTable, RowLink, Th } from "~/components/terminal/data-table";
import { EmptyState } from "~/components/terminal/empty-state";
import { Delta, Price } from "~/components/terminal/figures";
import { known, shortName, symbolFor } from "~/components/terminal/labels";
import { Breadcrumbs, SegmentedLinks } from "~/components/terminal/navigation";
import { PageBody } from "~/components/terminal/page";
import { Panel, PanelGrid } from "~/components/terminal/panel";
import { TickerStrip } from "~/components/terminal/ticker";
import { TradingChart } from "~/components/terminal/trading-chart";
import { formatDate, formatPrice, formatShortDate } from "~/lib/format";
import { CATALOG_CACHE, notFound } from "~/lib/http";
import { pageMeta } from "~/lib/seo";
import type { Route } from "./+types/card";

const RANGES = [30, 90, 365] as const;

export async function loader({ params, request }: Route.LoaderArgs) {
  const card = await getCard(db, params.slug);
  if (!card) throw notFound();
  const url = new URL(request.url);
  const requested = card.variants.find((v) => v.id === url.searchParams.get("variant"));
  const selected = requested ?? defaultVariant(card.variants);
  const range = RANGES.find((r) => String(r) === url.searchParams.get("range")) ?? 30;
  const history = selected ? await getPriceHistory(db, selected.id, range) : [];
  return { card, selectedId: selected?.id ?? null, range, history, origin: env.appUrl };
}

export const headers: Route.HeadersFunction = () => ({ "Cache-Control": CATALOG_CACHE });

export const meta: Route.MetaFunction = ({ loaderData }) => {
  if (!loaderData) return [];
  const { card } = loaderData;
  return pageMeta({
    title: `${card.name} · ${card.setName} price · TCG Price Tracker`,
    description: `${card.name} from ${card.gameName} ${card.setName}: market price ${formatPrice(card.priceCents)} (Near Mint), with price history by condition and printing.`,
    origin: loaderData.origin,
    path: `/cards/${card.slug}`,
  });
};

const rangeLabel = (days: number) => (days === 365 ? "1Y" : `${days}D`);

/** Card URL for a variant and range; the defaults (headline variant, 30 days) stay implicit. */
function cardPath(card: CardDetail, variantId: string | null, range: number): string {
  const search = new URLSearchParams();
  if (variantId) search.set("variant", variantId);
  if (range !== 30) search.set("range", String(range));
  const qs = search.toString();
  return `/cards/${card.slug}${qs ? `?${qs}` : ""}`;
}

function QuoteStrip({ card, selected }: { card: CardDetail; selected: VariantDetail | undefined }) {
  return (
    <TickerStrip label="Quote">
      <p className="flex items-center gap-4 px-3 sm:px-4">
        <span className="font-bold">{symbolFor(card)}</span>
        <span className="text-mute uppercase">{shortName(card.name)}</span>
        <Price cents={selected?.priceCents ?? card.priceCents} />
        <Delta pct={selected?.priceChange7dPct} />
        {selected && (
          <span className="micro">
            {selected.printing} · {selected.condition} · {selected.language}
          </span>
        )}
      </p>
    </TickerStrip>
  );
}

function QuoteHeader({
  card,
  selected,
}: {
  card: CardDetail;
  selected: VariantDetail | undefined;
}) {
  const params = new URLSearchParams(
    selected ? { card: card.slug, variant: selected.id } : { card: card.slug },
  );
  return (
    <section
      aria-labelledby="quote-title"
      className="grid gap-x-8 gap-y-5 bg-deck p-4 sm:p-5 lg:col-span-12 lg:grid-cols-[1fr_auto]"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="border border-wire bg-void px-2 py-0.5 text-[13px] font-bold tracking-[0.08em]">
            {symbolFor(card)}
          </span>
          <span className="micro">
            {[card.gameName, known(card.rarity)].filter(Boolean).join(" · ")}
          </span>
        </div>
        <h1
          id="quote-title"
          className="mt-3 font-sans text-[32px] leading-[1.05] font-semibold tracking-[-0.02em] text-balance break-words sm:text-[44px]"
        >
          {card.name}
        </h1>
        <p className="mt-2 text-[12.5px] text-mute">
          {[card.setName, known(card.number) && `No. ${card.number}`].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <ButtonLink to={`/app/add?${params}`}>
            <span aria-hidden>+</span> Add to collection
          </ButtonLink>
          <ButtonLink to={`/app/alerts/new?${params}`} variant="secondary">
            <span aria-hidden className="text-amber">
              !
            </span>{" "}
            Set price alert
          </ButtonLink>
        </div>
      </div>

      <div className="border-t border-grid pt-4 lg:min-w-[320px] lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8 lg:text-right">
        <p className="micro">
          Last · {selected ? `${selected.printing} · ${selected.condition}` : "Near Mint"}
        </p>
        <Price
          cents={selected?.priceCents ?? card.priceCents}
          className="mt-1 block text-[48px] leading-none font-semibold tracking-tight sm:text-[60px]"
        />
        <p className="mt-3 flex items-baseline gap-3 lg:justify-end">
          <Delta pct={selected?.priceChange7dPct} className="text-[18px] font-semibold" />
          <span className="micro">7D chg</span>
        </p>
        {selected?.priceUpdatedAt && (
          <p className="micro mt-2">Upd {formatDate(selected.priceUpdatedAt)}</p>
        )}
      </div>
    </section>
  );
}

function ChartPanel({
  card,
  selected,
  range,
  history,
}: {
  card: CardDetail;
  selected: VariantDetail | undefined;
  range: number;
  history: PricePoint[];
}) {
  const first = history[0];
  const last = history.at(-1);
  const prices = history.map((p) => p.priceCents);
  const rangeChange =
    first && last && first.priceCents
      ? ((last.priceCents - first.priceCents) / first.priceCents) * 100
      : null;
  const subject = selected ? `${selected.printing} ${selected.condition}` : "Price";
  const stats = [
    { label: "Open", cents: first?.priceCents },
    { label: "High", cents: prices.length ? Math.max(...prices) : undefined },
    { label: "Low", cents: prices.length ? Math.min(...prices) : undefined },
    { label: "Last", cents: last?.priceCents },
  ];

  return (
    <Panel
      code="F7"
      title={`Chart · ${subject}`}
      className="lg:col-span-8"
      meta={
        <SegmentedLinks
          label="History range"
          preventScrollReset
          items={RANGES.map((r) => ({
            to: cardPath(card, selected?.id ?? null, r),
            label: rangeLabel(r),
            current: r === range,
          }))}
        />
      }
    >
      <div className="px-1 pt-1 pb-2 sm:px-2">
        <TradingChart
          points={history.map((p) => ({ day: p.day, cents: p.priceCents }))}
          subject={`${subject} price, ${rangeLabel(range)}`}
        />
      </div>
      <dl className="grid grid-cols-2 gap-px border-t border-grid bg-grid sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="bg-deck px-3 py-2">
            <dt className="micro">{s.label}</dt>
            <dd className="mt-0.5 font-medium">
              <Price cents={s.cents} />
            </dd>
          </div>
        ))}
        <div className="col-span-2 bg-deck px-3 py-2 sm:col-span-1">
          <dt className="micro">Chg {rangeLabel(range)}</dt>
          <dd className="mt-0.5 font-medium">
            <Delta pct={rangeChange} />
          </dd>
        </div>
      </dl>
    </Panel>
  );
}

function Fundamentals({ card }: { card: CardDetail }) {
  const priced = card.variants.flatMap((v) => (v.priceCents == null ? [] : [v.priceCents]));
  const rows = [
    { label: "Game", value: card.gameName },
    { label: "Set", value: card.setName },
    { label: "Number", value: known(card.number) ?? "—" },
    { label: "Rarity", value: known(card.rarity) ?? "—" },
    { label: "Printings", value: String(new Set(card.variants.map((v) => v.printing)).size) },
    { label: "Quotes", value: String(card.variants.length) },
    {
      label: "Spread",
      value:
        priced.length > 1
          ? `${formatPrice(Math.min(...priced))} – ${formatPrice(Math.max(...priced))}`
          : "—",
    },
    { label: "TCGplayer ID", value: card.tcgplayerId ?? "—" },
  ];
  return (
    <Panel code="F8" title="Fundamentals" className="lg:col-span-4">
      <dl className="divide-y divide-grid">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4 px-3 py-2">
            <dt className="micro shrink-0">{r.label}</dt>
            <dd className="truncate text-right text-[12.5px]">{r.value}</dd>
          </div>
        ))}
      </dl>
      {card.details && (
        <p className="border-t border-grid px-3 py-3 text-[12.5px] whitespace-pre-line text-mute">
          {card.details}
        </p>
      )}
    </Panel>
  );
}

function OrderBook({
  card,
  selectedId,
  range,
}: {
  card: CardDetail;
  selectedId: string | null;
  range: number;
}) {
  const maxPrice = Math.max(...card.variants.map((v) => v.priceCents ?? 0), 1);
  return (
    <Panel
      code="F9"
      title="Book · printing × condition"
      meta={`${card.variants.length} ${card.variants.length === 1 ? "quote" : "quotes"}`}
      className="lg:col-span-12"
    >
      {card.variants.length === 0 ? (
        <EmptyState title="No quotes for this card yet" />
      ) : (
        <DataTable caption="Prices by printing and condition. Select a row to chart it.">
          <thead>
            <tr>
              <Th className="w-8">
                <span className="sr-only">Selected</span>
              </Th>
              <Th>Printing</Th>
              <Th className="hidden sm:table-cell">Condition</Th>
              <Th className="hidden sm:table-cell">Lang</Th>
              <Th numeric className="sm:w-[36%]">
                Last
              </Th>
              <Th numeric>Chg 7D</Th>
              <Th numeric className="hidden md:table-cell">
                Updated
              </Th>
            </tr>
          </thead>
          <tbody>
            {card.variants.map((v) => {
              const active = v.id === selectedId;
              return (
                <tr key={v.id} aria-selected={active}>
                  <td aria-hidden className={active ? "text-amber" : "text-wire"}>
                    {active ? "▸" : "·"}
                  </td>
                  <td>
                    <RowLink
                      to={cardPath(card, v.id, range)}
                      preventScrollReset
                      aria-current={active ? "true" : undefined}
                      className={`font-medium ${active ? "text-amber" : ""}`}
                    >
                      {v.printing}
                      <span className="block text-[11px] font-normal text-mute sm:sr-only">
                        {v.condition}
                      </span>
                    </RowLink>
                  </td>
                  <td className={`hidden sm:table-cell ${active ? "" : "text-mute"}`}>
                    {v.condition}
                  </td>
                  <td className="hidden text-mute sm:table-cell">
                    {v.language === "English" ? "EN" : v.language}
                  </td>
                  <td className="relative text-right font-medium">
                    <span
                      aria-hidden
                      className={`absolute inset-y-1 right-0 ${active ? "bg-amber/20" : "bg-[#15223a]"}`}
                      style={{ width: `${((v.priceCents ?? 0) / maxPrice) * 100}%` }}
                    />
                    <Price cents={v.priceCents} className="relative pr-3" />
                  </td>
                  <td className="text-right">
                    <Delta pct={v.priceChange7dPct} />
                  </td>
                  <td className="hidden text-right text-mute md:table-cell">
                    {v.priceUpdatedAt ? formatShortDate(v.priceUpdatedAt) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}
    </Panel>
  );
}

export default function CardPage({ loaderData }: Route.ComponentProps) {
  const { card, selectedId, range, history } = loaderData;
  const selected = card.variants.find((v) => v.id === selectedId);
  return (
    <>
      <QuoteStrip card={card} selected={selected} />
      <PageBody>
        <Breadcrumbs
          items={[
            { label: "Games", to: "/games" },
            { label: card.gameName, to: `/games/${card.gameId}` },
            { label: card.setName, to: `/sets/${card.setId}` },
            { label: shortName(card.name) },
          ]}
        />
        <PanelGrid className="lg:grid-cols-12">
          <QuoteHeader card={card} selected={selected} />
          <ChartPanel card={card} selected={selected} range={range} history={history} />
          <Fundamentals card={card} />
          <OrderBook card={card} selectedId={selectedId} range={range} />
        </PanelGrid>
      </PageBody>
    </>
  );
}
