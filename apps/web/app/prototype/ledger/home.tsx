// PROTOTYPE (UI redesign) — Design A home: masthead, lead plate, ledger tables, colophon.
import type { CardSummary } from "@tcg/core";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { HoloCard } from "~/components/holo-card/holo-card";
import { formatPrice } from "~/lib/format";
import { withDesign, type HomeData } from "../types";
import { Change, entryLine, known, LedgerShell, SectionHead } from "./chrome";

const cardPath = (slug: string) => withDesign(`/cards/${slug}`, "A");
const plural = (n: number, word: string) =>
  `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;

export function LedgerHome({ highlights }: HomeData) {
  const { counts, topCards, movers } = highlights;
  const lead = topCards[0];
  const tally = `${plural(counts.games, "game")} · ${plural(counts.sets, "set")} · ${plural(counts.cards, "card")}`;

  return (
    <LedgerShell masthead="full" strap={tally}>
      {lead ? <Lead card={lead} runnerUp={topCards[1]} /> : null}

      <div className="mt-14 grid gap-x-12 gap-y-14 lg:grid-cols-2">
        <section aria-labelledby="most-valuable">
          <SectionHead
            index={2}
            id="most-valuable"
            title="Most valuable"
            dek="By market price, Near Mint or sealed"
          />
          {topCards.length ? (
            <ol>
              {topCards.map((card, i) => (
                <LedgerRow key={card.slug} rank={i + 1} card={card} />
              ))}
            </ol>
          ) : (
            <Empty>No prices have been entered in the register yet.</Empty>
          )}
        </section>

        <section aria-labelledby="movers" className="lg:border-l lg:border-(--rule) lg:pl-12">
          <SectionHead
            index={3}
            id="movers"
            title="Movers this week"
            dek="Largest seven-day change, Near Mint or sealed"
          />
          {movers.length ? (
            <ol>
              {movers.map((card, i) => (
                <LedgerRow key={card.slug} rank={i + 1} card={card} change={card.change7dPct} />
              ))}
            </ol>
          ) : (
            <Empty>No price has moved this week.</Empty>
          )}
        </section>
      </div>

      <Colophon counts={counts} />
    </LedgerShell>
  );
}

function Lead({ card, runnerUp }: { card: CardSummary; runnerUp?: CardSummary }) {
  const subtitle = [card.setName, known(card.number)].filter(Boolean).join(" · ");
  return (
    <section
      aria-labelledby="lead"
      className="mt-8 grid gap-x-14 gap-y-8 md:grid-cols-[minmax(0,20rem)_1fr]"
    >
      <figure className="order-last mx-auto w-full max-w-[20rem] md:order-first md:mx-0">
        <HoloCard
          title={card.name}
          subtitle={subtitle}
          price={formatPrice(card.priceCents)}
          tone="ledger"
          className="w-full"
        />
        <figcaption className="mt-2 border-t border-(--rule) pt-2 text-[0.9rem] italic text-(--ink-soft)">
          <span className="ledger-caps not-italic text-(--ink)">Plate 1.</span> {card.name}, from{" "}
          {card.setName}. Illustrative face; no card imagery is reproduced.
        </figcaption>
      </figure>

      <div className="flex flex-col md:pt-2">
        <SectionHead
          index={1}
          id="lead"
          title="The lead"
          dek="Most valuable card in the register"
        />
        <p className="ledger-caps text-[0.95rem] text-(--ink-soft)">No. 1 by market price</p>
        <h3
          className="ledger-display mt-2 text-[2.6rem] leading-[1.02] font-[450] tracking-[-0.02em] sm:text-[3.6rem]"
          style={{ fontVariationSettings: '"opsz" 120' }}
        >
          <Link to={cardPath(card.slug)} className="ledger-quiet">
            {card.name}
          </Link>
        </h3>
        <p className="mt-3 text-[1.15rem] italic text-(--ink-soft)">
          {entryLine(card.setName, known(card.number) && `No. ${card.number}`, card.rarity)}.
        </p>

        <dl className="mt-8 max-w-md border-t border-(--ink) pt-3">
          <dt className="ledger-caps text-(--ink-soft)">Market price</dt>
          <dd
            className="ledger-display ledger-num mt-1 text-[3.4rem] leading-none font-[400] tracking-[-0.02em] sm:text-[4.25rem]"
            style={{ fontVariationSettings: '"opsz" 144' }}
          >
            {formatPrice(card.priceCents)}
          </dd>
        </dl>
        {runnerUp && (
          <p className="mt-4 max-w-md text-[1.05rem]">
            Heads the register, ahead of{" "}
            <Link to={cardPath(runnerUp.slug)} className="ledger-link italic">
              {runnerUp.name}
            </Link>{" "}
            at <span className="ledger-num">{formatPrice(runnerUp.priceCents)}</span>.
          </p>
        )}

        <p className="mt-6">
          <Link
            to={cardPath(card.slug)}
            className="ledger-caps ledger-link text-[1.05rem] text-(--oxblood)"
          >
            Read the full entry →
          </Link>
        </p>
      </div>
    </section>
  );
}

function LedgerRow({ rank, card, change }: { rank: number; card: CardSummary; change?: number }) {
  return (
    <li className="grid grid-cols-[2.25rem_1fr] border-b border-(--rule) py-2.5 first:border-t first:border-t-(--ink)">
      <span className="ledger-display ledger-num pt-[0.2rem] text-[0.95rem] italic text-(--ink-soft)">
        {String(rank).padStart(2, "0")}
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <Link
            to={cardPath(card.slug)}
            className="ledger-quiet min-w-0 text-[1.1rem] leading-snug font-[520] sm:truncate"
          >
            {card.name}
          </Link>
          <span className="ledger-leader" aria-hidden />
          <span className="ledger-num shrink-0 text-[1.1rem]">{formatPrice(card.priceCents)}</span>
          {change !== undefined && (
            <Change pct={change} className="w-[4.25rem] shrink-0 text-right" />
          )}
        </div>
        <p className="truncate text-[0.9rem] italic text-(--ink-soft)">
          {[card.setName, card.number, card.rarity].map(known).filter(Boolean).join(" · ")}
        </p>
      </div>
    </li>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="ledger-hatch border-y border-(--ink) px-4 py-8 text-center italic text-(--ink-soft)">
      <span className="bg-(--paper) px-2">{children}</span>
    </p>
  );
}

function Colophon({ counts }: { counts: HomeData["highlights"]["counts"] }) {
  return (
    <aside aria-label="Colophon" className="mt-20 text-center">
      <p aria-hidden className="ledger-display text-[2rem] leading-none text-(--oxblood)">
        ⁂
      </p>
      <p className="mx-auto mt-3 max-w-2xl text-[1rem] italic text-(--ink-soft)">
        This register records{" "}
        <span className="ledger-num not-italic text-(--ink)">{plural(counts.cards, "card")}</span>{" "}
        across{" "}
        <span className="ledger-num not-italic text-(--ink)">{plural(counts.sets, "set")}</span> in{" "}
        <span className="ledger-num not-italic text-(--ink)">{plural(counts.games, "game")}</span>,
        priced in United States dollars. Set in Fraunces and Newsreader.
      </p>
    </aside>
  );
}
