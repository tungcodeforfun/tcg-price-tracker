// Catalog queries are server-only; importing them via `.server` makes a client-bundle leak a build error.
import * as core from "@tcg/core";
import { env } from "./env";

export * from "@tcg/core";

type Imaged = Pick<core.CardSummary, "gameId" | "imageUrl">;

/** Blanks the card art of games in `disabledGames` (the IMAGES_DISABLED_GAMES kill switch). */
export function hideDisabledImage<T extends Imaged>(card: T, disabledGames: readonly string[]): T {
  return card.imageUrl !== null && disabledGames.includes(card.gameId)
    ? { ...card, imageUrl: null }
    : card;
}

const hide = <T extends Imaged>(card: T) => hideDisabledImage(card, env.imagesDisabledGames);

// The queries below feed public pages; they shadow the `@tcg/core` versions re-exported above.

export async function getCard(...args: Parameters<typeof core.getCard>) {
  const card = await core.getCard(...args);
  return card && hide(card);
}

export async function getSet(...args: Parameters<typeof core.getSet>) {
  const result = await core.getSet(...args);
  return result && { ...result, cards: result.cards.map(hide) };
}

export async function searchCards(...args: Parameters<typeof core.searchCards>) {
  const result = await core.searchCards(...args);
  return { ...result, cards: result.cards.map(hide) };
}

export async function getHomeHighlights(...args: Parameters<typeof core.getHomeHighlights>) {
  const highlights = await core.getHomeHighlights(...args);
  return {
    ...highlights,
    topCards: highlights.topCards.map(hide),
    movers: highlights.movers.map(hide),
  };
}
