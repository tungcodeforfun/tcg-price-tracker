// PROTOTYPE (UI redesign) — design C "Holo showcase": home page.
import { Form, Link } from "react-router";
import type { CardSummary } from "@tcg/core";
import { HoloCard } from "~/components/holo-card/holo-card";
import { formatPrice } from "~/lib/format";
import type { HomeData } from "../types";
import { ChangeChip, HoloShell, cardPath } from "./chrome";

const count = new Intl.NumberFormat("en-US");

function RailCard({ card, rank }: { card: CardSummary; rank: number }) {
  return (
    <Link
      to={cardPath(card.slug)}
      className="holo-foil-hover flex aspect-[63/88] w-[13.5rem] shrink-0 snap-start flex-col rounded-[18px] p-4 [--holo-fill:var(--holo-ink-2)] sm:w-[15rem]"
    >
      <span className="flex items-start justify-between gap-2">
        <span aria-hidden className="holo-display text-5xl leading-none font-black text-(--holo-line)">
          {String(rank).padStart(2, "0")}
        </span>
        {card.number && (
          <span className="holo-num pt-1 text-[11px] tracking-[0.12em] text-(--holo-mist)">
            {card.number}
          </span>
        )}
      </span>
      <span className="holo-engrave relative mt-4 flex flex-1 flex-col justify-end overflow-hidden rounded-xl border border-(--holo-line) p-3">
        <span
          aria-hidden
          className="holo-display absolute -top-3 right-1 text-[7rem] leading-none font-black text-(--holo-ink-3)"
        >
          {card.name.charAt(0)}
        </span>
        <span className="holo-display relative text-base leading-[1.15] font-bold text-balance [overflow-wrap:anywhere]">
          {card.name}
        </span>
        <span className="relative mt-2 line-clamp-2 text-xs text-(--holo-mist)">{card.setName}</span>
      </span>
      <span className="mt-4 flex items-end justify-between gap-2">
        <span className="text-[11px] font-medium tracking-[0.14em] text-(--holo-mist) uppercase">
          {card.rarity ?? "Market"}
        </span>
        <span className="holo-display holo-num text-xl font-bold text-(--holo-gold)">
          {formatPrice(card.priceCents)}
        </span>
      </span>
    </Link>
  );
}

export function HoloHome({ highlights }: HomeData) {
  const { counts, topCards, movers } = highlights;
  const hero = topCards[0];
  const stats = [
    [counts.cards, "cards priced"],
    [counts.sets, counts.sets === 1 ? "set" : "sets"],
    [counts.games, counts.games === 1 ? "game" : "games"],
  ] as const;

  return (
    <HoloShell>
      <section className="mx-auto grid max-w-[1280px] gap-12 px-5 pt-12 pb-16 sm:px-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center lg:gap-8 lg:pt-16">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-(--holo-lilac) uppercase">
            Daily market prices
          </p>
          <h1 className="holo-display mt-5 text-[clamp(2.75rem,7.6vw,6.25rem)] leading-[0.92] font-black tracking-[-0.04em]">
            Every pull has a price.
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-(--holo-mist)">
            Look up what a card sells for, by printing and condition, and watch your collection's
            value move with the market.
          </p>
          <Form
            method="get"
            action="/search"
            role="search"
            className="holo-foil-border holo-search mt-8 flex max-w-[34rem] items-center gap-2 rounded-full p-1.5 pl-5 [--holo-fill:var(--holo-ink-2)]"
          >
            <label htmlFor="holo-hero-search" className="sr-only">
              Search cards
            </label>
            <input
              id="holo-hero-search"
              name="q"
              type="search"
              required
              minLength={3}
              placeholder="Try Pikachu or Luffy"
              className="holo-input min-w-0 flex-1 bg-transparent py-2 text-base text-(--holo-paper)"
            />
            <button
              type="submit"
              className="rounded-full bg-(--holo-paper) px-5 py-2.5 text-sm font-semibold text-(--holo-ink) hover:bg-(--holo-gold)"
            >
              Search
            </button>
          </Form>
          <dl className="mt-12 grid max-w-[40rem] grid-cols-3 border-t border-(--holo-line)">
            {stats.map(([value, label], i) => (
              <div
                key={label}
                className={`pt-5 ${i ? "border-l border-(--holo-line) pl-4 sm:pl-6" : "pr-4"}`}
              >
                <dt className="text-xs font-medium text-(--holo-mist)">{label}</dt>
                <dd className="holo-display holo-num mt-2 text-[clamp(1.6rem,4.6vw,3.25rem)] leading-none font-bold">
                  {count.format(value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {hero && (
          <figure className="mx-auto flex w-full max-w-[26rem] flex-col items-center lg:max-w-none">
            <HoloCard
              title={hero.name}
              subtitle={[hero.setName, hero.number].filter(Boolean).join(" · ")}
              price={formatPrice(hero.priceCents)}
              tone="holo"
              className="w-[18rem] sm:w-[22rem] lg:w-[26rem]"
            />
            <figcaption className="mt-4 flex w-full max-w-[22rem] items-baseline justify-between gap-4 text-sm">
              <span className="text-(--holo-mist)">Most valuable card tracked</span>
              <Link
                to={cardPath(hero.slug)}
                className="font-semibold text-(--holo-paper) underline decoration-(--holo-lilac) decoration-2 underline-offset-4 hover:decoration-(--holo-gold)"
              >
                See price history
              </Link>
            </figcaption>
          </figure>
        )}
      </section>

      <section aria-labelledby="holo-top">
        <div className="holo-band">
          <div className="mx-auto flex max-w-[1280px] items-baseline justify-between gap-4 px-5 py-3 sm:px-8">
            <h2 id="holo-top" className="holo-display text-sm font-bold tracking-[0.06em] whitespace-nowrap uppercase sm:text-base">
              Top of the market
            </h2>
            <p className="text-right text-xs font-semibold sm:text-sm">Highest Near Mint prices</p>
          </div>
        </div>
        {topCards.length ? (
          <ol className="holo-rail mx-auto flex max-w-[1280px] snap-x gap-4 overflow-x-auto px-5 pt-8 pb-6 sm:px-8">
            {topCards.map((card, i) => (
              <li key={card.slug} className="flex">
                <RailCard card={card} rank={i + 1} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="mx-auto max-w-[1280px] px-5 py-8 text-(--holo-mist) sm:px-8">
            No prices synced yet.
          </p>
        )}
      </section>

      <section
        aria-labelledby="holo-movers"
        className="mx-auto mt-16 grid max-w-[1280px] gap-8 px-5 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16"
      >
        <div className="lg:sticky lg:top-8 lg:self-start">
          <p aria-hidden className="holo-display text-[clamp(5rem,14vw,10rem)] leading-[0.8] font-black text-(--holo-lilac)">
            7D
          </p>
          <h2 id="holo-movers" className="holo-display mt-4 text-3xl font-bold sm:text-4xl">
            Biggest movers
          </h2>
          <p className="mt-3 max-w-[26rem] text-(--holo-mist)">
            Largest seven-day price swings on Near Mint and sealed cards, up or down.
          </p>
        </div>
        {movers.length ? (
          <ol className="divide-y divide-(--holo-line) border-y border-(--holo-line)">
            {movers.map((card, i) => (
              <li key={card.slug}>
                <Link
                  to={cardPath(card.slug)}
                  className="group grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-4 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto_6.5rem]"
                >
                  <span className="holo-num text-sm text-(--holo-mist)">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold group-hover:underline group-hover:decoration-(--holo-lilac) group-hover:underline-offset-4">
                      {card.name}
                    </span>
                    <span className="block truncate text-sm text-(--holo-mist)">{card.setName}</span>
                  </span>
                  <span className="holo-display holo-num text-right text-base font-bold sm:text-lg">
                    {formatPrice(card.priceCents)}
                  </span>
                  <span className="col-start-3 justify-self-end sm:col-start-auto">
                    <ChangeChip pct={card.change7dPct} />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-(--holo-mist)">No price moves this week.</p>
        )}
      </section>
    </HoloShell>
  );
}
