import type { CardSummary } from "@tcg/core";
import { useState } from "react";
import { shortName, symbolFor } from "./labels";

type FaceCard = Pick<CardSummary, "name" | "setName" | "number" | "gameId" | "imageUrl">;

/** Credit for each game's card art: the site it is hotlinked from and the rights holder. */
const IMAGE_CREDITS: Record<string, { source: string; href: string; owner: string }> = {
  pokemon: { source: "TCGdex", href: "https://tcgdex.net", owner: "The Pokémon Company" },
  "disney-lorcana": { source: "Lorcast", href: "https://lorcast.com", owner: "Disney" },
};

export interface CardFaceProps {
  card: FaceCard;
  /** Sizes the face (its width); text scales with it, and the face keeps a 63:88 card shape. */
  className?: string;
  /** Above-the-fold hero: load the art eagerly at high priority instead of lazily. */
  priority?: boolean;
  /** Caption the art with its source and rights holder (only while art is shown). */
  credit?: boolean;
}

/**
 * Card art when `card.imageUrl` is set, shown whole (never cropped) over a typographic
 * stand-in: the ticker symbol, a large initial and the card name. The stand-in shows while
 * the art loads, if it fails (without JS too), and for cards without art; it reads as
 * "symbol name", so the face can sit inside a link as its text.
 */
export function CardFace({
  card,
  className = "",
  priority = false,
  credit = false,
}: CardFaceProps) {
  // Keyed by URL, so a reused face (card to card navigation) retries the next card's art.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const name = shortName(card.name);
  const imageUrl = card.imageUrl === brokenUrl ? null : card.imageUrl;
  const source = imageUrl && credit ? IMAGE_CREDITS[card.gameId] : undefined;
  return (
    <>
      <div
        className={`@container relative flex aspect-[63/88] flex-col overflow-hidden border border-wire bg-void ${className}`}
      >
        <p
          aria-hidden={imageUrl ? true : undefined}
          className="truncate border-b border-grid px-[6cqw] py-[4cqw] text-[7.5cqw] font-bold tracking-[0.06em] text-amber"
        >
          {symbolFor(card)}
        </p>
        <div aria-hidden className="dot-matrix grid min-h-0 flex-1 place-items-center">
          <span className="font-sans text-[46cqw] leading-none font-bold text-transparent [-webkit-text-stroke:1px_var(--color-mute)]">
            {(Array.from(name.trim())[0] ?? "·").toUpperCase()}
          </span>
        </div>
        <p
          aria-hidden={imageUrl ? true : undefined}
          className="line-clamp-3 border-t border-grid px-[6cqw] py-[5cqw] font-sans text-[9cqw] leading-[1.15] font-semibold"
        >
          {name}
        </p>
        {imageUrl && (
          <img
            src={imageUrl}
            alt={card.name}
            width={630}
            height={880}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
            decoding={priority ? undefined : "async"}
            onError={() => setBrokenUrl(imageUrl)}
            // An error before hydration fires no onError; catch it when React attaches.
            ref={(img) => {
              if (img?.complete && img.naturalWidth === 0) setBrokenUrl(imageUrl);
            }}
            className="absolute inset-0 size-full object-contain"
          />
        )}
      </div>
      {source && (
        <p className="micro mt-2">
          Image via{" "}
          <a
            href={source.href}
            rel="noopener"
            className="underline decoration-wire underline-offset-4 hover:decoration-amber"
          >
            {source.source}
          </a>{" "}
          · © {source.owner}
        </p>
      )}
    </>
  );
}
