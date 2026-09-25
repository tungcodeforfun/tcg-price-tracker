import type { CardSummary } from "@tcg/core";
import { Link } from "react-router";
import { Price } from "./figures";
import { known, shortName, symbolFor } from "./labels";

type FaceCard = Pick<CardSummary, "name" | "setName" | "number">;

export interface CardFaceProps {
  card: FaceCard;
  /** Sizes the face (its width); text scales with it, and the face keeps a 63:88 card shape. */
  className?: string;
}

/**
 * Typographic stand-in for card art (there are no card images): the ticker symbol, a large
 * initial and the card name. Reads as "symbol name", so it can sit inside a link as its text.
 */
export function CardFace({ card, className = "" }: CardFaceProps) {
  const name = shortName(card.name);
  return (
    <div
      className={`@container flex aspect-[63/88] flex-col overflow-hidden border border-wire bg-void ${className}`}
    >
      <p className="truncate border-b border-grid px-[6cqw] py-[4cqw] text-[7.5cqw] font-bold tracking-[0.06em] text-amber">
        {symbolFor(card)}
      </p>
      <div aria-hidden className="dot-matrix grid min-h-0 flex-1 place-items-center">
        <span className="font-sans text-[46cqw] leading-none font-bold text-transparent [-webkit-text-stroke:1px_var(--color-mute)]">
          {(Array.from(name.trim())[0] ?? "·").toUpperCase()}
        </span>
      </div>
      <p className="line-clamp-3 border-t border-grid px-[6cqw] py-[5cqw] font-sans text-[9cqw] leading-[1.15] font-semibold">
        {name}
      </p>
    </div>
  );
}

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
