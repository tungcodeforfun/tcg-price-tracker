import { Link } from "react-router";
import type { CardSummary } from "@tcg/core";
import { formatPrice } from "~/lib/format";

/** Text card face until licensed card images are available. */
export function CardFace({ name, number }: { name: string; number: string | null }) {
  return (
    <div className="flex aspect-[63/88] flex-col justify-between rounded-lg border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-3 dark:border-gray-800 dark:from-gray-900 dark:to-gray-950">
      <span className="line-clamp-3 text-sm font-medium">{name}</span>
      {number && <span className="font-mono text-xs text-gray-500">{number}</span>}
    </div>
  );
}

export function CardTile({ card, showSet = false }: { card: CardSummary; showSet?: boolean }) {
  return (
    <Link to={`/cards/${card.slug}`} className="group block">
      <CardFace name={card.name} number={card.number} />
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="truncate text-sm group-hover:underline">
          {showSet ? card.setName : card.rarity}
        </span>
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          {formatPrice(card.priceCents)}
        </span>
      </div>
    </Link>
  );
}

export function CardGrid({ cards, showSet }: { cards: CardSummary[]; showSet?: boolean }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {cards.map((card) => (
        <li key={card.slug}>
          <CardTile card={card} showSet={showSet} />
        </li>
      ))}
    </ul>
  );
}
