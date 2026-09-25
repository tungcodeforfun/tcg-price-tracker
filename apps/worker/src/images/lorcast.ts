import { JsonClient, TtlCache, type Fetch } from "./http.ts";
import { matchSourceSet, type ImageSource } from "./source.ts";

const API = "https://api.lorcast.com/v0";
const DAY_MS = 86_400_000;

interface LorcastSet {
  id: string;
  code: string;
  name: string;
}

interface LorcastCard {
  tcgplayer_id: number | null;
  image_uris?: { digital?: { large?: string } };
}

/**
 * Disney Lorcana from Lorcast: one request lists a set's cards with TCGplayer ids and image URLs.
 * Lorcast asks for 50–100 ms between requests and at least a day of caching.
 */
export function createLorcastSource(options: { fetch?: Fetch; gapMs?: number } = {}): ImageSource {
  const client = new JsonClient({ fetch: options.fetch, gapMs: options.gapMs ?? 100 });
  const cache = new TtlCache();

  return {
    gameId: "disney-lorcana",
    name: "lorcast",
    get requestCount() {
      return client.requestCount;
    },
    async setImages(set) {
      const { results } = await cache.get("sets", DAY_MS, () =>
        client.get<{ results: LorcastSet[] }>(`${API}/sets`),
      );
      const match = matchSourceSet(set, results);
      if ("reason" in match) return { status: "unmatched", reason: match.reason };

      const sourceSetId = match.set.id;
      const cards = await cache.get(`set:${sourceSetId}`, DAY_MS, () =>
        client.get<LorcastCard[]>(`${API}/sets/${encodeURIComponent(sourceSetId)}/cards`),
      );
      const images = cards.flatMap(({ tcgplayer_id, image_uris }) => {
        const imageUrl = image_uris?.digital?.large;
        return tcgplayer_id && imageUrl ? [{ tcgplayerId: String(tcgplayer_id), imageUrl }] : [];
      });
      return { status: "matched", sourceSetId, images };
    },
  };
}
