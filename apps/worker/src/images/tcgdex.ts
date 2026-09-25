import { JsonClient, TtlCache, type Fetch } from "./http.ts";
import { matchSourceSet, type ImageSource, type SourceImage } from "./source.ts";

const API = "https://api.tcgdex.net/v2/en";
const DAY_MS = 86_400_000;

/** Our sets whose TCGdex code and name differ from JustTCG's, checked by hand (name, date, size). */
const SET_ALIASES: Record<string, string> = {
  "mcdonald-s-promos-2014-pokemon": "2014xy",
  "me-30th-celebration-classic-collection-pokemon": "30th-c",
};

interface TcgdexSetBrief {
  id: string;
  name: string;
}

interface TcgdexSet {
  id: string;
  /** `image` is a base URL, absent until TCGdex has the scan. */
  cards: { id: string; image?: string }[];
}

interface TcgdexCard {
  variants_detailed?: { thirdParty?: { tcgplayer?: number } }[];
}

/**
 * Pokémon (English) from TCGdex. Only card details carry TCGplayer product ids (no list, set or
 * GraphQL query returns them), so this costs one request per card with an image; results are
 * cached, and a card without ids is re-checked after a day.
 */
export function createTcgdexSource(options: { fetch?: Fetch; gapMs?: number } = {}): ImageSource {
  const client = new JsonClient({ fetch: options.fetch, gapMs: options.gapMs ?? 50 });
  const cache = new TtlCache();

  async function tcgplayerIds(cardId: string): Promise<string[]> {
    return cache.get(
      `card:${cardId}`,
      (ids) => (ids.length > 0 ? 30 * DAY_MS : DAY_MS),
      async () => {
        const card = await client.get<TcgdexCard>(`${API}/cards/${encodeURIComponent(cardId)}`);
        const ids = (card.variants_detailed ?? []).map((v) => v.thirdParty?.tcgplayer);
        return [...new Set(ids.filter((id) => typeof id === "number").map(String))];
      },
    );
  }

  return {
    gameId: "pokemon",
    name: "tcgdex",
    get requestCount() {
      return client.requestCount;
    },
    async setImages(set) {
      const sets = await cache.get("sets", DAY_MS, () =>
        client.get<TcgdexSetBrief[]>(`${API}/sets`),
      );
      const match = matchSourceSet(
        set,
        sets.map((s) => ({ id: s.id, code: s.id, name: s.name })),
        SET_ALIASES,
      );
      if ("reason" in match) return { status: "unmatched", reason: match.reason };

      const sourceSetId = match.set.id;
      const detail = await cache.get(`set:${sourceSetId}`, DAY_MS, () =>
        client.get<TcgdexSet>(`${API}/sets/${encodeURIComponent(sourceSetId)}`),
      );
      const images: SourceImage[] = [];
      for (const card of detail.cards) {
        if (!card.image) continue;
        for (const tcgplayerId of await tcgplayerIds(card.id)) {
          images.push({ tcgplayerId, imageUrl: `${card.image}/high.webp` });
        }
      }
      return { status: "matched", sourceSetId, images };
    },
  };
}
