// PROTOTYPE (UI redesign) — Design A card page: a catalogue entry with an engraved price plate.
import type { ReactNode } from "react";
import { Link } from "react-router";
import { formatDate, formatPrice } from "~/lib/format";
import { withDesign, type CardPageData } from "../types";
import { Change, entryLine, known, LedgerShell, SectionHead } from "./chrome";
import { EngravedChart } from "./engraved-chart";

const RANGES = [
  { days: 30, label: "30D", long: "30 days" },
  { days: 90, label: "90D", long: "90 days" },
  { days: 365, label: "1Y", long: "12 months" },
];

export function LedgerCardPage({ card, selectedId, range, history }: CardPageData) {
  const selected = card.variants.find((v) => v.id === selectedId);
  const href = (variant: string | null, days: number) => {
    const search = new URLSearchParams();
    if (variant) search.set("variant", variant);
    if (days !== 30) search.set("range", String(days));
    const qs = search.toString();
    return withDesign(`/cards/${card.slug}${qs ? `?${qs}` : ""}`, "A");
  };
  const actionQuery = new URLSearchParams(
    selectedId ? { card: card.slug, variant: selectedId } : { card: card.slug },
  );
  const rangeLong = RANGES.find((r) => r.days === range)?.long ?? `${range} days`;
  const plate = selected ? `${selected.printing}, ${selected.condition}` : "Headline printing";
  const number = known(card.number);
  const priced = card.variants
    .filter((v) => v.priceCents != null)
    .toSorted((a, b) => a.priceCents! - b.priceCents!);
  const cheapest = priced[0];
  const dearest = priced.at(-1);

  return (
    <LedgerShell>
      <nav aria-label="Breadcrumb" className="ledger-caps mt-5 text-[0.95rem] text-(--ink-soft)">
        <ol className="flex flex-wrap gap-x-2">
          <li>
            <Link to="/games" className="ledger-quiet">
              Games
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li>
            <Link to={`/games/${card.gameId}`} className="ledger-quiet">
              {card.gameName}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li>
            <Link to={`/sets/${card.setId}`} className="ledger-quiet">
              {card.setName}
            </Link>
          </li>
        </ol>
      </nav>

      <article className="mt-8 grid gap-x-12 gap-y-8 lg:grid-cols-[8rem_minmax(0,1fr)_21rem]">
        {number && (
          <p className="flex items-baseline gap-3 lg:block">
            <span className="ledger-caps block text-(--ink-soft)">Entry</span>
            <span
              className="ledger-display ledger-num block text-[1.9rem] leading-none break-words italic text-(--oxblood) lg:mt-1"
              style={{ fontVariationSettings: '"opsz" 144' }}
            >
              {number}
            </span>
          </p>
        )}

        <header className="min-w-0 lg:col-start-2">
          <h1
            className="ledger-display text-[2.75rem] leading-[0.98] font-[440] tracking-[-0.025em] text-balance sm:text-[4.5rem]"
            style={{ fontVariationSettings: '"opsz" 144' }}
          >
            {card.name}
          </h1>
          <p className="mt-4 text-[1.2rem] italic leading-snug text-(--ink-soft)">
            {entryLine(card.setName, card.gameName, card.rarity)}.
          </p>
          {cheapest && dearest && cheapest !== dearest && (
            <p className="mt-5 max-w-[34rem] text-[1.05rem]">
              Recorded in {card.variants.length} printings and conditions, from{" "}
              <span className="ledger-num">{formatPrice(cheapest.priceCents)}</span>{" "}
              <span className="italic text-(--ink-soft)">
                ({cheapest.printing}, {cheapest.condition})
              </span>{" "}
              to <span className="ledger-num">{formatPrice(dearest.priceCents)}</span>{" "}
              <span className="italic text-(--ink-soft)">
                ({dearest.printing}, {dearest.condition})
              </span>
              .
            </p>
          )}
          {card.details && (
            <p className="mt-5 max-w-[34rem] border-l border-(--rule) pl-4 text-[1.05rem] whitespace-pre-line">
              {card.details}
            </p>
          )}
        </header>

        <aside aria-label="Price" className="lg:border-l lg:border-(--ink) lg:pl-8">
          <p className="ledger-caps border-t border-(--ink) pt-2 text-(--ink-soft) lg:border-t-0 lg:pt-0">
            Market price,{" "}
            {card.variants.some((v) => v.condition === "Sealed") ? "Sealed" : "Near Mint"}
          </p>
          <p
            className="ledger-display ledger-num mt-1 text-[3.5rem] leading-none font-[400] tracking-[-0.03em] sm:text-[4.5rem]"
            style={{ fontVariationSettings: '"opsz" 144' }}
          >
            {formatPrice(card.priceCents)}
          </p>

          {selected && (
            <dl className="mt-6 space-y-1.5 border-t border-(--rule) pt-3 text-[1rem]">
              <Fact term="Printing">
                {selected.printing}
                {selected.language !== "English" && `, ${selected.language}`}
              </Fact>
              <Fact term="Condition">{selected.condition}</Fact>
              <Fact term="This entry">
                <span className="ledger-num">{formatPrice(selected.priceCents)}</span>
              </Fact>
              <Fact term="Seven days">
                <Change pct={selected.priceChange7dPct} />
              </Fact>
              {selected.priceUpdatedAt && (
                <Fact term="Updated">
                  <span className="ledger-num">{formatDate(selected.priceUpdatedAt)}</span>
                </Fact>
              )}
            </dl>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              to={`/app/add?${actionQuery}`}
              className="ledger-caps bg-(--ink) px-4 py-2 text-[1.05rem] text-(--paper) transition-colors hover:bg-(--oxblood)"
            >
              Add to collection
            </Link>
            <Link
              to={`/app/alerts/new?${actionQuery}`}
              className="ledger-caps ledger-link text-[1.05rem] text-(--oxblood)"
            >
              Set a price alert
            </Link>
          </div>
        </aside>
      </article>

      <section aria-labelledby="history" className="mt-16">
        <SectionHead
          index={1}
          id="history"
          title="Price history"
          dek={plate}
          aside={
            <nav aria-label="History range" className="ledger-caps flex gap-1 text-[1.05rem]">
              {RANGES.map((r) => (
                <Link
                  key={r.days}
                  to={href(selectedId, r.days)}
                  preventScrollReset
                  aria-current={r.days === range ? "true" : undefined}
                  className="ledger-num px-2 py-0.5 text-(--ink-soft) hover:text-(--ink) aria-[current]:text-(--oxblood) aria-[current]:underline aria-[current]:decoration-2 aria-[current]:underline-offset-[0.35em]"
                >
                  {r.label}
                </Link>
              ))}
            </nav>
          }
        />
        <EngravedChart
          points={history}
          caption={`Daily market price for ${plate}, last ${rangeLong}.`}
        />
      </section>

      <section aria-labelledby="variants" className="mt-16">
        <SectionHead
          index={2}
          id="variants"
          title="Prices by printing and condition"
          dek={
            card.variants.length === 1
              ? "1 entry"
              : `${card.variants.length} entries; select one to chart it`
          }
        />
        <table className="w-full border-collapse text-[1.05rem]">
          <thead>
            <tr className="ledger-caps border-b border-(--ink) text-left text-(--ink-soft) *:align-bottom">
              <th scope="col" className="w-full py-1.5 pl-7 font-[500]">
                Printing &amp; condition
              </th>
              <th scope="col" className="py-1.5 pl-3 text-right font-[500]">
                Price
              </th>
              <th scope="col" className="w-[5.5rem] py-1.5 pl-3 text-right font-[500]">
                7 days
              </th>
            </tr>
          </thead>
          <tbody>
            {card.variants.map((v) => {
              const current = v.id === selectedId;
              return (
                <tr
                  key={v.id}
                  className={`border-b border-(--rule) *:align-baseline ${current ? "bg-(--paper-deep)" : ""}`}
                >
                  <td className="py-2 pr-2">
                    <div className="flex items-baseline gap-2">
                      <span
                        aria-hidden
                        className={`w-5 shrink-0 text-center text-(--oxblood) ${current ? "" : "invisible"}`}
                      >
                        ▸
                      </span>
                      <Link
                        to={href(v.id, range)}
                        preventScrollReset
                        aria-current={current ? "true" : undefined}
                        className={`ledger-quiet min-w-0 ${current ? "font-[600]" : ""}`}
                      >
                        {v.printing}
                        {v.language !== "English" && ` (${v.language})`}
                        <span className="font-[400] italic text-(--ink-soft)">, {v.condition}</span>
                        {current && <span className="sr-only"> (charted)</span>}
                      </Link>
                      <span className="ledger-leader" aria-hidden />
                    </div>
                  </td>
                  <td className="ledger-num py-2 pl-3 text-right whitespace-nowrap">
                    {formatPrice(v.priceCents)}
                  </td>
                  <td className="py-2 pl-3 text-right whitespace-nowrap">
                    <Change pct={v.priceChange7dPct} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </LedgerShell>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="flex flex-1 items-baseline gap-2">
        <span className="ledger-caps shrink-0 text-(--ink-soft)">{term}</span>
        <span className="ledger-leader" aria-hidden />
      </dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
