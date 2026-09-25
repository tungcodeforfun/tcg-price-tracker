import type { CardMover, CardSummary, HomeHighlights } from "@tcg/core";
import { Link } from "react-router";
import { getHomeHighlights } from "~/.server/catalog";
import { db } from "~/.server/db";
import { HoloCard } from "~/components/holo-card/holo-card";
import { DataTable, RowLink, Th } from "~/components/terminal/data-table";
import { EmptyState } from "~/components/terminal/empty-state";
import { Delta, direction, Price, Stat, StatGrid } from "~/components/terminal/figures";
import { known, shortName, symbolFor } from "~/components/terminal/labels";
import { PageBody, PageHeader } from "~/components/terminal/page";
import { Panel, PanelGrid } from "~/components/terminal/panel";
import { TickerStrip, TickerTape } from "~/components/terminal/ticker";
import { formatPrice } from "~/lib/format";
import { CATALOG_CACHE } from "~/lib/http";
import type { Route } from "./+types/home";

export const meta: Route.MetaFunction = () => [
  { title: "TCG Price Tracker" },
  { name: "description", content: "Track trading card prices and your collection's value." },
];

export const headers: Route.HeadersFunction = () => ({ "Cache-Control": CATALOG_CACHE });

export async function loader() {
  return { highlights: await getHomeHighlights(db) };
}

function MoversTicker({ movers }: { movers: CardMover[] }) {
  return (
    <TickerStrip label="7D Movers">
      {movers.length ? (
        <TickerTape label="Biggest 7-day movers">
          {movers.map((m) => (
            <li key={m.slug} className="flex">
              <Link
                to={`/cards/${m.slug}`}
                className="flex items-center gap-2.5 border-r border-grid px-4 hover:bg-rail focus-visible:outline-offset-[-2px]"
              >
                <span className="font-bold">{symbolFor(m)}</span>
                <span className="text-mute uppercase">{shortName(m.name)}</span>
                <Price cents={m.priceCents} />
                <Delta pct={m.change7dPct} />
              </Link>
            </li>
          ))}
        </TickerTape>
      ) : (
        <p className="micro px-4">No moves in the last 7 days</p>
      )}
    </TickerStrip>
  );
}

function Spotlight({ card }: { card: CardSummary | undefined }) {
  if (!card) {
    return (
      <Panel code="F1" title="Spotlight" className="lg:col-span-4 lg:row-span-2">
        <EmptyState title="No priced cards yet" />
      </Panel>
    );
  }
  const details = [card.setName, known(card.number), known(card.rarity)].filter(Boolean);
  return (
    <Panel
      code="F1"
      title="Spotlight · Top card"
      meta="Rank 01"
      className="lg:col-span-4 lg:row-span-2"
    >
      <div className="dot-matrix flex flex-1 items-center justify-center border-b border-grid px-6 py-8">
        <HoloCard
          title={card.name}
          subtitle={[card.setName, known(card.number)].filter(Boolean).join(" · ")}
          price={formatPrice(card.priceCents)}
          className="w-56 sm:w-64"
        />
      </div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-x-4 gap-y-1 px-4 py-4">
        <p className="micro">{symbolFor(card)}</p>
        <p className="micro text-right">Last · NM</p>
        <h3 className="font-sans text-[22px] leading-tight font-semibold tracking-[-0.02em] text-balance">
          {shortName(card.name)}
        </h3>
        <Price
          cents={card.priceCents}
          className="text-right text-[22px] leading-tight font-semibold"
        />
        <p className="col-span-2 truncate text-[12px] text-mute">{details.join(" · ")}</p>
      </div>
      <Link
        to={`/cards/${card.slug}`}
        className="flex h-10 items-center justify-between border-t border-grid px-4 text-[11.5px] tracking-[0.12em] text-amber uppercase hover:bg-rail focus-visible:outline-offset-[-2px]"
      >
        Open quote
        <kbd aria-hidden>↵</kbd>
      </Link>
    </Panel>
  );
}

function Overview({ counts, movers }: HomeHighlights) {
  const up = movers.filter((m) => direction(m.change7dPct) === "up").length;
  const down = movers.length - up;
  const upShare = movers.length ? (up / movers.length) * 100 : 50;
  return (
    <Panel code="F4" title="Market overview" meta="USD · NM/Sealed" className="lg:col-span-8">
      <StatGrid className="grid-cols-2 sm:grid-cols-4">
        <Stat label="Games">{counts.games.toLocaleString("en-US")}</Stat>
        <Stat label="Sets priced">{counts.sets.toLocaleString("en-US")}</Stat>
        <Stat label="Cards tracked">{counts.cards.toLocaleString("en-US")}</Stat>
        <Stat label="Largest move">
          <Delta pct={movers[0]?.change7dPct} />
        </Stat>
      </StatGrid>
      <div className="border-t border-grid px-3 py-3">
        <div className="flex items-baseline justify-between gap-4">
          <p className="micro">Breadth · top movers, 7D</p>
          <p className="text-[12px] whitespace-nowrap">
            <span className="text-up">{up} adv</span>
            <span className="px-2 text-mute">/</span>
            <span className="text-down">{down} dec</span>
          </p>
        </div>
        <div aria-hidden className="mt-2 flex h-1.5 bg-down">
          <div className="bg-up" style={{ width: `${upShare}%` }} />
        </div>
      </div>
    </Panel>
  );
}

function NameCell({ card }: { card: CardSummary }) {
  return (
    <td className="w-full max-w-0">
      <RowLink to={`/cards/${card.slug}`} className="block truncate font-medium">
        {shortName(card.name)}
      </RowLink>
      <span className="block truncate text-[11px] text-mute">
        {[symbolFor(card), known(card.rarity)].filter(Boolean).join(" · ")}
      </span>
    </td>
  );
}

function TopCards({ cards }: { cards: CardSummary[] }) {
  return (
    <Panel code="F5" title="Top cards" meta="By last price" className="lg:col-span-4">
      {cards.length === 0 ? (
        <EmptyState title="No priced cards yet" />
      ) : (
        <DataTable>
          <thead>
            <tr>
              <Th className="w-10">#</Th>
              <Th>Card</Th>
              <Th numeric>Last</Th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card, i) => (
              <tr key={card.slug}>
                <td className="text-mute">{String(i + 1).padStart(2, "0")}</td>
                <NameCell card={card} />
                <td className="text-right font-medium">
                  <Price cents={card.priceCents} />
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </Panel>
  );
}

function Movers({ movers }: { movers: CardMover[] }) {
  const maxMove = Math.max(...movers.map((m) => Math.abs(m.change7dPct)), 0.01);
  return (
    <Panel code="F6" title="Movers · 7D" meta="Sorted by |Δ|" className="lg:col-span-4">
      {movers.length === 0 ? (
        <EmptyState title="No moves in the last 7 days" />
      ) : (
        <DataTable>
          <thead>
            <tr>
              <Th>Card</Th>
              <Th numeric>Last</Th>
              <Th numeric>Chg 7D</Th>
            </tr>
          </thead>
          <tbody>
            {movers.map((m) => (
              <tr key={m.slug}>
                <NameCell card={m} />
                <td className="text-right">
                  <Price cents={m.priceCents} />
                </td>
                <td className="text-right">
                  <Delta pct={m.change7dPct} className="font-medium" />
                  <span aria-hidden className="mt-1 ml-auto block h-0.5 bg-grid">
                    <span
                      className={`ml-auto block h-full ${m.change7dPct > 0 ? "bg-up" : "bg-down"}`}
                      style={{ width: `${(Math.abs(m.change7dPct) / maxMove) * 100}%` }}
                    />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </Panel>
  );
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { highlights } = loaderData;
  return (
    <>
      <MoversTicker movers={highlights.movers} />
      <PageBody>
        <PageHeader
          eyebrow="MKT ▸ Overview"
          title="Market monitor"
          meta="Trading-card prices · updated daily"
        />
        <PanelGrid className="lg:grid-cols-12">
          <Spotlight card={highlights.topCards[0]} />
          <Overview {...highlights} />
          <TopCards cards={highlights.topCards} />
          <Movers movers={highlights.movers} />
        </PanelGrid>
      </PageBody>
    </>
  );
}
