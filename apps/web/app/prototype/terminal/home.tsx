// PROTOTYPE (UI redesign): design B "Trading terminal" home, a market monitor.
import type { CardMover, CardSummary } from "@tcg/core";
import { Link } from "react-router";
import { HoloCard } from "~/components/holo-card/holo-card";
import { formatPrice } from "~/lib/format";
import type { HomeData } from "../types";
import {
  cardHref,
  Delta,
  direction,
  known,
  Panel,
  shortName,
  Stat,
  symbolFor,
  TerminalShell,
} from "./chrome";

/** Enough tape to overflow a wide screen before the loop repeats. */
const TAPE_MIN_ITEMS = 12;

function Ticker({ movers }: { movers: CardMover[] }) {
  const tape = movers.length
    ? Array.from({ length: Math.ceil(TAPE_MIN_ITEMS / movers.length) }, () => movers).flat()
    : [];
  const items = (copy: boolean) =>
    tape.map((m, i) => {
      const repeat = copy || i >= movers.length;
      return (
        <li
          key={`${m.slug}-${i}`}
          data-copy={repeat ? "" : undefined}
          aria-hidden={repeat || undefined}
          className="flex"
        >
          <Link
            to={cardHref(m.slug)}
            tabIndex={repeat ? -1 : undefined}
            className="flex items-center gap-2.5 border-r border-(--t-grid) px-4 text-[12px] hover:bg-(--t-rail)"
          >
            <span className="font-bold text-(--t-text)">{symbolFor(m)}</span>
            <span className="text-(--t-mute) uppercase">{shortName(m.name)}</span>
            <span className="text-(--t-text)">{formatPrice(m.priceCents)}</span>
            <Delta pct={m.change7dPct} />
          </Link>
        </li>
      );
    });

  return (
    <div className="flex h-9 border-b border-(--t-grid) bg-(--t-void)">
      <p className="t-micro flex shrink-0 items-center bg-(--t-amber) px-3 font-bold text-(--t-void)!">
        7D Movers
      </p>
      {tape.length ? (
        <div className="t-tape-wrap min-w-0 flex-1 overflow-hidden">
          <div className="t-tape h-full">
            <ul aria-label="Biggest 7-day movers" className="flex h-full">
              {items(false)}
            </ul>
            <ul aria-hidden data-copy="" className="flex h-full">
              {items(true)}
            </ul>
          </div>
        </div>
      ) : (
        <p className="t-micro flex items-center px-4">No moves in the last 7 days</p>
      )}
    </div>
  );
}

function Spotlight({ card }: { card: CardSummary | undefined }) {
  if (!card) {
    return (
      <Panel code="F1" title="Spotlight" className="lg:col-span-4 lg:row-span-2">
        <p className="t-micro p-6">No priced cards yet</p>
      </Panel>
    );
  }
  return (
    <Panel
      code="F1"
      title="Spotlight · Top card"
      meta="Rank 01"
      className="lg:col-span-4 lg:row-span-2"
    >
      <div className="t-dots flex flex-1 items-center justify-center border-b border-(--t-grid) px-6 py-8">
        <HoloCard
          title={card.name}
          subtitle={[card.setName, known(card.number)].filter(Boolean).join(" · ")}
          price={formatPrice(card.priceCents)}
          tone="terminal"
          className="w-56 sm:w-64"
        />
      </div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-x-4 gap-y-1 px-4 py-4">
        <p className="t-micro">{symbolFor(card)}</p>
        <p className="t-micro text-right">Last · NM</p>
        <h3 className="t-head text-[22px] leading-tight font-semibold text-balance">
          {shortName(card.name)}
        </h3>
        <p className="text-right text-[22px] leading-tight font-semibold">
          {formatPrice(card.priceCents)}
        </p>
        <p className="col-span-2 truncate text-[12px] text-(--t-mute)">
          {[card.setName, known(card.number), known(card.rarity)].filter(Boolean).join(" · ")}
        </p>
      </div>
      <Link
        to={cardHref(card.slug)}
        className="flex h-10 items-center justify-between border-t border-(--t-grid) px-4 text-[11.5px] tracking-[0.12em] text-(--t-amber) uppercase hover:bg-(--t-rail)"
      >
        Open quote
        <kbd aria-hidden>↵</kbd>
      </Link>
    </Panel>
  );
}

function Overview({ highlights }: HomeData) {
  const { counts, movers } = highlights;
  const up = movers.filter((m) => direction(m.change7dPct) === "up").length;
  const down = movers.length - up;
  const upShare = movers.length ? (up / movers.length) * 100 : 50;
  return (
    <Panel code="F4" title="Market overview" meta="USD · NM/Sealed" className="lg:col-span-8">
      <dl className="grid grid-cols-2 gap-px bg-(--t-grid) sm:grid-cols-4">
        <Stat label="Games">{counts.games.toLocaleString("en-US")}</Stat>
        <Stat label="Sets priced">{counts.sets.toLocaleString("en-US")}</Stat>
        <Stat label="Cards tracked">{counts.cards.toLocaleString("en-US")}</Stat>
        <Stat label="Largest move">
          <Delta pct={movers[0]?.change7dPct} />
        </Stat>
      </dl>
      <div className="border-t border-(--t-grid) px-3 py-3">
        <div className="flex items-baseline justify-between">
          <p className="t-micro">Breadth · top movers, 7D</p>
          <p className="text-[12px]">
            <span className="t-up">{up} adv</span>
            <span className="px-2 text-(--t-mute)">/</span>
            <span className="t-down">{down} dec</span>
          </p>
        </div>
        <div aria-hidden className="mt-2 flex h-1.5 bg-(--t-down)">
          <div className="bg-(--t-up)" style={{ width: `${upShare}%` }} />
        </div>
      </div>
    </Panel>
  );
}

function NameCell({ card }: { card: CardSummary }) {
  return (
    <td className="max-w-0 w-full">
      <Link
        to={cardHref(card.slug)}
        className="t-row-link block truncate font-medium text-(--t-text)"
      >
        {shortName(card.name)}
      </Link>
      <span className="block truncate text-[11px] text-(--t-mute)">
        {symbolFor(card)}
        {known(card.rarity) && ` · ${card.rarity}`}
      </span>
    </td>
  );
}

function TopCards({ cards }: { cards: CardSummary[] }) {
  return (
    <Panel code="F5" title="Top cards" meta="By last price" className="lg:col-span-4">
      <table className="t-table">
        <thead>
          <tr>
            <th scope="col" className="t-micro w-10">
              #
            </th>
            <th scope="col" className="t-micro">
              Card
            </th>
            <th scope="col" className="t-micro text-right!">
              Last
            </th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card, i) => (
            <tr key={card.slug}>
              <td className="text-(--t-mute)">{String(i + 1).padStart(2, "0")}</td>
              <NameCell card={card} />
              <td className="text-right font-medium">{formatPrice(card.priceCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function Movers({ movers }: { movers: CardMover[] }) {
  const maxMove = Math.max(...movers.map((m) => Math.abs(m.change7dPct)), 0.01);
  return (
    <Panel code="F6" title="Movers · 7D" meta="Sorted by |Δ|" className="lg:col-span-4">
      {movers.length === 0 ? (
        <p className="t-micro p-4">No moves in the last 7 days</p>
      ) : (
        <table className="t-table">
          <thead>
            <tr>
              <th scope="col" className="t-micro">
                Card
              </th>
              <th scope="col" className="t-micro text-right!">
                Last
              </th>
              <th scope="col" className="t-micro text-right!">
                Chg 7D
              </th>
            </tr>
          </thead>
          <tbody>
            {movers.map((m) => (
              <tr key={m.slug}>
                <NameCell card={m} />
                <td className="text-right">{formatPrice(m.priceCents)}</td>
                <td className="text-right">
                  <Delta pct={m.change7dPct} className="font-medium" />
                  <span aria-hidden className="mt-1 ml-auto block h-0.5 bg-(--t-grid)">
                    <span
                      className={`ml-auto block h-full ${m.change7dPct > 0 ? "bg-(--t-up)" : "bg-(--t-down)"}`}
                      style={{ width: `${(Math.abs(m.change7dPct) / maxMove) * 100}%` }}
                    />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

export function TerminalHome({ highlights }: HomeData) {
  return (
    <TerminalShell ticker={<Ticker movers={highlights.movers} />}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-1 sm:mb-4">
        <div>
          <p className="t-micro">MKT ▸ Overview</p>
          <h1 className="t-head mt-1 text-[28px] leading-none font-semibold sm:text-[34px]">
            Market monitor
          </h1>
        </div>
        <p className="t-micro">Trading-card prices · updated daily</p>
      </div>
      <div className="t-grid lg:grid-cols-12">
        <Spotlight card={highlights.topCards[0]} />
        <Overview highlights={highlights} />
        <TopCards cards={highlights.topCards} />
        <Movers movers={highlights.movers} />
      </div>
    </TerminalShell>
  );
}
