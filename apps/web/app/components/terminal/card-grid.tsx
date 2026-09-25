import type { CardSummary } from "@tcg/core";
import { Link } from "react-router";
import { CardFace } from "./card-face";
import { Price } from "./figures";
import { known } from "./labels";

export interface CardTileProps {
  card: CardSummary;
  /** Caption the tile with the set name (mixed-set lists) instead of the rarity. */
  showSet?: boolean;
}

/** A card face linking to the card page, captioned with rarity or set and the headline price. */
export function CardTile({ card, showSet = false }: CardTileProps) {
  const caption = showSet ? card.setName : known(card.rarity);
  return (
    <Link
      to={`/cards/${card.slug}`}
      className="group block h-full p-2 hover:bg-rail focus-visible:outline-offset-[-2px]"
    >
      <CardFace card={card} className="group-hover:border-amber" />
      <span className="mt-2 flex items-baseline justify-between gap-2">
        <span className="micro min-w-0 truncate">{caption}</span>
        <Price cents={card.priceCents} className="ml-auto shrink-0 text-[12.5px] font-semibold" />
      </span>
    </Link>
  );
}

export interface CardGridProps {
  cards: CardSummary[];
  /** See `CardTile`. */
  showSet?: boolean;
}

/** Responsive grid of `CardTile`s: 2 columns on phones up to 6 on wide screens. */
export function CardGrid({ cards, showSet }: CardGridProps) {
  return (
    <ul className="grid grid-cols-2 border-t border-l border-grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {cards.map((card) => (
        <li key={card.slug} className="border-r border-b border-grid bg-deck">
          <CardTile card={card} showSet={showSet} />
        </li>
      ))}
    </ul>
  );
}
