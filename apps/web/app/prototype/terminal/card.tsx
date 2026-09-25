// PROTOTYPE (UI redesign): design B "Trading terminal" card page, a quote screen.
import type { CardDetail, VariantDetail } from "@tcg/core";
import { Link } from "react-router";
import { formatDate, formatPrice, formatShortDate } from "~/lib/format";
import type { CardPageData } from "../types";
import { TradingChart } from "./chart";
import { cardHref, Delta, known, Panel, shortName, symbolFor, TerminalShell } from "./chrome";

const RANGES = [
  { days: 30, label: "30D" },
  { days: 90, label: "90D" },
  { days: 365, label: "1Y" },
] as const;

function cardQuery(card: CardDetail, variantId: string | null, range: number): string {
  const search = new URLSearchParams();
  if (variantId) search.set("variant", variantId);
  if (range !== 30) search.set("range", String(range));
  const qs = search.toString();
  return cardHref(card.slug, qs ? `?${qs}` : "");
}

function Breadcrumbs({ card }: { card: CardDetail }) {
  const crumbs = [
    { label: "Games", to: "/games" },
    { label: card.gameName, to: `/games/${card.gameId}` },
    { label: card.setName, to: `/sets/${card.setId}` },
  ];
  return (
    <nav aria-label="Breadcrumb" className="t-micro mb-3 overflow-x-auto whitespace-nowrap">
      <ol className="flex items-center gap-2">
        {crumbs.map((c) => (
          <li key={c.to} className="flex items-center gap-2">
            <Link to={c.to} className="hover:text-(--t-text)">
              {c.label}
            </Link>
            <span aria-hidden className="text-(--t-wire)">
              /
            </span>
          </li>
        ))}
        <li aria-current="page" className="text-(--t-text)">
          {shortName(card.name)}
        </li>
      </ol>
    </nav>
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
  const change = selected?.priceChange7dPct;
  return (
    <section
      aria-labelledby="t-quote"
      className="grid gap-x-8 gap-y-5 bg-(--t-deck) p-4 sm:p-5 lg:col-span-12 lg:grid-cols-[1fr_auto]"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="border border-(--t-wire) bg-(--t-void) px-2 py-0.5 text-[13px] font-bold tracking-[0.08em]">
            {symbolFor(card)}
          </span>
          <span className="t-micro">{card.gameName}</span>
          {known(card.rarity) && (
            <>
              <span aria-hidden className="t-micro">
                ·
              </span>
              <span className="t-micro">{card.rarity}</span>
            </>
          )}
        </div>
        <h1
          id="t-quote"
          className="t-head mt-3 text-[32px] leading-[1.05] font-semibold sm:text-[44px]"
        >
          {card.name}
        </h1>
        <p className="mt-2 text-[12.5px] text-(--t-mute)">
          {[card.setName, known(card.number) && `No. ${card.number}`].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to={`/app/add?${params}`}
            className="flex h-9 items-center gap-2 bg-(--t-amber) px-3.5 text-[11.5px] font-bold tracking-[0.12em] text-(--t-void) uppercase hover:bg-[#ffc955]"
          >
            <span aria-hidden>+</span> Add to collection
          </Link>
          <Link
            to={`/app/alerts/new?${params}`}
            className="flex h-9 items-center gap-2 border border-(--t-wire) px-3.5 text-[11.5px] tracking-[0.12em] uppercase hover:border-(--t-amber) hover:text-(--t-amber)"
          >
            <span aria-hidden className="text-(--t-amber)">
              !
            </span>{" "}
            Set price alert
          </Link>
        </div>
      </div>

      <div className="border-t border-(--t-grid) pt-4 lg:min-w-[320px] lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8 lg:text-right">
        <p className="t-micro">
          Last · {selected ? `${selected.printing} · ${selected.condition}` : "Near Mint"}
        </p>
        <p className="mt-1 text-[48px] leading-none font-semibold tracking-tight sm:text-[60px]">
          {formatPrice(selected?.priceCents ?? card.priceCents)}
        </p>
        <p className="mt-3 flex items-baseline gap-3 lg:justify-end">
          <Delta pct={change} className="text-[18px] font-semibold" />
          <span className="t-micro">7D chg</span>
        </p>
        {selected?.priceUpdatedAt && (
          <p className="t-micro mt-2">Upd {formatDate(selected.priceUpdatedAt)}</p>
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
}: CardPageData & { selected: VariantDetail | undefined }) {
  const first = history[0];
  const last = history.at(-1);
  const prices = history.map((p) => p.priceCents);
  const rangeChange =
    first && last && first.priceCents
      ? ((last.priceCents - first.priceCents) / first.priceCents) * 100
      : null;
  const subject = selected ? `${selected.printing} ${selected.condition}` : "Price";
  const stats = [
    { label: "Open", value: first && formatPrice(first.priceCents) },
    { label: "High", value: prices.length ? formatPrice(Math.max(...prices)) : undefined },
    { label: "Low", value: prices.length ? formatPrice(Math.min(...prices)) : undefined },
    { label: "Last", value: last && formatPrice(last.priceCents) },
  ];
  const rangeLabel = RANGES.find((r) => r.days === range)?.label ?? `${range}D`;

  return (
    <Panel
      code="F7"
      title={`Chart · ${subject}`}
      className="lg:col-span-8"
      meta={
        <nav aria-label="History range" className="t-seg">
          {RANGES.map((r) => (
            <Link
              key={r.days}
              to={cardQuery(card, selected?.id ?? null, r.days)}
              preventScrollReset
              aria-current={r.days === range ? "true" : undefined}
            >
              {r.label}
            </Link>
          ))}
        </nav>
      }
    >
      <div className="px-1 pt-1 pb-2 sm:px-2">
        <TradingChart points={history} label={`${subject} price, ${rangeLabel}`} />
      </div>
      <dl className="grid grid-cols-2 gap-px border-t border-(--t-grid) bg-(--t-grid) sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="bg-(--t-deck) px-3 py-2">
            <dt className="t-micro">{s.label}</dt>
            <dd className="mt-0.5 font-medium">{s.value ?? "—"}</dd>
          </div>
        ))}
        <div className="col-span-2 bg-(--t-deck) px-3 py-2 sm:col-span-1">
          <dt className="t-micro">Chg {rangeLabel}</dt>
          <dd className="mt-0.5 font-medium">
            <Delta pct={rangeChange} />
          </dd>
        </div>
      </dl>
    </Panel>
  );
}

function Fundamentals({ card }: { card: CardDetail }) {
  const priced = card.variants.filter((v) => v.priceCents != null).map((v) => v.priceCents!);
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
      <dl className="divide-y divide-(--t-grid)">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4 px-3 py-2">
            <dt className="t-micro shrink-0">{r.label}</dt>
            <dd className="truncate text-right text-[12.5px]">{r.value}</dd>
          </div>
        ))}
      </dl>
      {card.details && (
        <p className="border-t border-(--t-grid) px-3 py-3 text-[12.5px] whitespace-pre-line text-(--t-mute)">
          {card.details}
        </p>
      )}
    </Panel>
  );
}

function OrderBook({ card, selectedId, range }: CardPageData) {
  const maxPrice = Math.max(...card.variants.map((v) => v.priceCents ?? 0), 1);
  return (
    <Panel
      code="F9"
      title="Book · printing × condition"
      meta={`${card.variants.length} ${card.variants.length === 1 ? "quote" : "quotes"}`}
      className="lg:col-span-12"
    >
      {card.variants.length === 0 ? (
        <p className="t-micro p-4">No quotes for this card yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="t-table">
            <caption className="sr-only">
              Prices by printing and condition. Select a row to chart it.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="t-micro w-8">
                  <span className="sr-only">Selected</span>
                </th>
                <th scope="col" className="t-micro">
                  Printing
                </th>
                <th scope="col" className="t-micro hidden sm:table-cell">
                  Condition
                </th>
                <th scope="col" className="t-micro hidden sm:table-cell">
                  Lang
                </th>
                <th scope="col" className="t-micro text-right! sm:w-[36%]">
                  Last
                </th>
                <th scope="col" className="t-micro text-right!">
                  Chg 7D
                </th>
                <th scope="col" className="t-micro hidden text-right! md:table-cell">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody>
              {card.variants.map((v) => {
                const active = v.id === selectedId;
                const depth = ((v.priceCents ?? 0) / maxPrice) * 100;
                return (
                  <tr
                    key={v.id}
                    aria-selected={active}
                    className={
                      active ? "bg-[#ffb62714] shadow-[inset_2px_0_0_var(--t-amber)]" : undefined
                    }
                  >
                    <td aria-hidden className={active ? "text-(--t-amber)" : "text-(--t-wire)"}>
                      {active ? "▸" : "·"}
                    </td>
                    <td>
                      <Link
                        to={cardQuery(card, v.id, range)}
                        preventScrollReset
                        aria-current={active ? "true" : undefined}
                        className={`t-row-link font-medium ${active ? "text-(--t-amber)" : "text-(--t-text)"}`}
                      >
                        {v.printing}
                        <span className="block text-[11px] font-normal text-(--t-mute) sm:sr-only">
                          {v.condition}
                        </span>
                      </Link>
                    </td>
                    <td
                      className={`hidden sm:table-cell ${active ? "text-(--t-text)" : "text-(--t-mute)"}`}
                    >
                      {v.condition}
                    </td>
                    <td className="hidden text-(--t-mute) sm:table-cell">
                      {v.language === "English" ? "EN" : v.language}
                    </td>
                    <td className="relative text-right font-medium">
                      <span
                        aria-hidden
                        className={`absolute inset-y-1 right-0 ${active ? "bg-[#ffb62733]" : "bg-[#15223a]"}`}
                        style={{ width: `${depth}%` }}
                      />
                      <span className="relative pr-3">{formatPrice(v.priceCents)}</span>
                    </td>
                    <td className="text-right">
                      <Delta pct={v.priceChange7dPct} />
                    </td>
                    <td className="hidden text-right text-(--t-mute) md:table-cell">
                      {v.priceUpdatedAt ? formatShortDate(v.priceUpdatedAt) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export function TerminalCardPage(props: CardPageData) {
  const { card, selectedId } = props;
  const selected = card.variants.find((v) => v.id === selectedId);
  return (
    <TerminalShell
      ticker={
        <div className="flex h-9 items-center gap-4 overflow-x-auto border-b border-(--t-grid) bg-(--t-void) px-3 text-[12px] whitespace-nowrap sm:px-4">
          <span className="t-micro bg-(--t-amber) px-2 py-0.5 font-bold text-(--t-void)!">
            Quote
          </span>
          <span className="font-bold">{symbolFor(card)}</span>
          <span className="text-(--t-mute) uppercase">{shortName(card.name)}</span>
          <span>{formatPrice(selected?.priceCents ?? card.priceCents)}</span>
          <Delta pct={selected?.priceChange7dPct} />
          {selected && (
            <span className="t-micro">
              {selected.printing} · {selected.condition} · {selected.language}
            </span>
          )}
        </div>
      }
    >
      <Breadcrumbs card={card} />
      <div className="t-grid lg:grid-cols-12">
        <QuoteHeader card={card} selected={selected} />
        <ChartPanel {...props} selected={selected} />
        <Fundamentals card={card} />
        <OrderBook {...props} />
      </div>
    </TerminalShell>
  );
}
