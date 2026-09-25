import { cards, sets, type Db } from "@tcg/db";
import { and, asc, desc, eq, exists, inArray, isNotNull, or, sql } from "drizzle-orm";
import type { Fetch } from "./http.ts";
import { createLorcastSource } from "./lorcast.ts";
import type { ImageSource, SourceImage } from "./source.ts";
import { createTcgdexSource } from "./tcgdex.ts";

/** Image sources by our game id. */
export type ImageSources = ReadonlyMap<string, ImageSource>;

/** Images older than this are fetched again. */
const MAX_IMAGE_AGE_MS = 30 * 86_400_000;

/** Every supported source except those for `disabledGames` (the IMAGES_DISABLED_GAMES kill switch). */
export function createImageSources(
  options: { disabledGames?: string[]; fetch?: Fetch; gapMs?: number } = {},
): ImageSources {
  const { disabledGames = [], ...sourceOptions } = options;
  const all = [createTcgdexSource(sourceOptions), createLorcastSource(sourceOptions)];
  return new Map(all.filter((s) => !disabledGames.includes(s.gameId)).map((s) => [s.gameId, s]));
}

export interface SetImagesResult {
  /**
   * `unsupported`: the game has no enabled source. `unmatched`: the source has no such set.
   * `up-to-date`: no card needed an image, so the source wasn't called.
   */
  status: "synced" | "up-to-date" | "unmatched" | "unsupported";
  reason: string | null;
  source: string | null;
  sourceSetId: string | null;
  /** Cards in the set. */
  cards: number;
  /** Cards that needed an image: none yet, or one from a source that is over 30 days old. */
  due: number;
  /** Due cards the source has an image for, by TCGplayer id. */
  matched: number;
  /** Rows written. */
  updated: number;
  /** Due cards left as they were. */
  unmatched: number;
  requests: number;
}

/**
 * Cards whose image is missing or stale. A URL without a source is a manual override: never due.
 */
function isDue(staleBefore: Date) {
  return sql`(${cards.imageUrl} is null or (${cards.imageSource} is not null and
    (${cards.imageUpdatedAt} is null or ${cards.imageUpdatedAt} <= ${staleBefore})))`;
}

/** The https image for each wanted TCGplayer id; an id claimed by two different images is dropped. */
function joinImages(wantedIds: string[], images: SourceImage[]): Map<string, string> {
  const urlById = new Map<string, string | null>();
  for (const { tcgplayerId, imageUrl } of images) {
    if (!imageUrl.startsWith("https://")) continue;
    const seen = urlById.get(tcgplayerId);
    urlById.set(tcgplayerId, seen === undefined || seen === imageUrl ? imageUrl : null);
  }
  const joined = new Map<string, string>();
  for (const id of wantedIds) {
    const url = urlById.get(id);
    if (url) joined.set(id, url);
  }
  return joined;
}

/**
 * Fills `image_url`, `image_source` and `image_updated_at` for the set's due cards from its game's
 * source, joined on TCGplayer product id, in one UPDATE. Unmatched cards are left untouched.
 */
export async function syncSetImages({
  db,
  sources,
  setId,
  now = new Date(),
}: {
  db: Db;
  sources: ImageSources;
  setId: string;
  now?: Date;
}): Promise<SetImagesResult> {
  const [set] = await db
    .select({ id: sets.id, gameId: sets.gameId, name: sets.name })
    .from(sets)
    .where(eq(sets.id, setId));
  if (!set) throw new Error(`Unknown set "${setId}"; sync the catalog first`);

  const source = sources.get(set.gameId);
  const base = {
    reason: null,
    source: source?.name ?? null,
    sourceSetId: null,
    cards: 0,
    due: 0,
    matched: 0,
    updated: 0,
    unmatched: 0,
    requests: 0,
  };
  if (!source) {
    return { ...base, status: "unsupported", reason: `no image source enabled for ${set.gameId}` };
  }

  const due = isDue(new Date(now.getTime() - MAX_IMAGE_AGE_MS));
  const rows = await db
    .select({ tcgplayerId: cards.tcgplayerId, due: sql<boolean>`${due}` })
    .from(cards)
    .where(eq(cards.setId, set.id));
  const dueIds = rows.flatMap((row) => (row.due && row.tcgplayerId ? [row.tcgplayerId] : []));
  const counts = { ...base, cards: rows.length, due: dueIds.length };
  if (dueIds.length === 0) return { ...counts, status: "up-to-date" };

  const requestsBefore = source.requestCount;
  const found = await source.setImages(set);
  const requests = source.requestCount - requestsBefore;
  if (found.status === "unmatched") {
    const { reason } = found;
    return { ...counts, status: "unmatched", reason, unmatched: dueIds.length, requests };
  }

  const images = joinImages(dueIds, found.images);
  const matched = dueIds.filter((id) => images.has(id)).length;
  let updated = 0;
  if (images.size > 0) {
    const values = sql.join(
      Array.from(images, ([id, url]) => sql`(${id}, ${url})`),
      sql`, `,
    );
    const written = await db.execute(sql`
      update ${cards}
      set image_url = v.image_url, image_source = ${source.name}, image_updated_at = ${now}
      from (values ${values}) as v (tcgplayer_id, image_url)
      where ${cards.setId} = ${set.id} and ${cards.tcgplayerId} = v.tcgplayer_id and ${due}
    `);
    updated = written.rowCount ?? 0;
  }
  return {
    ...counts,
    status: "synced",
    sourceSetId: found.sourceSetId,
    matched,
    updated,
    unmatched: dueIds.length - matched,
    requests,
  };
}

/** Kill switch: blanks every image of a game, manual overrides included; returns cards cleared. */
export async function clearGameImages(db: Db, gameId: string): Promise<number> {
  const cleared = await db
    .update(cards)
    .set({ imageUrl: null, imageSource: null, imageUpdatedAt: null })
    .where(
      and(
        eq(cards.gameId, gameId),
        or(
          isNotNull(cards.imageUrl),
          isNotNull(cards.imageSource),
          isNotNull(cards.imageUpdatedAt),
        ),
      ),
    );
  return cleared.rowCount ?? 0;
}

/** Sets that have cards, for the games with an image source; newest first within each game. */
export async function setsWithImageSource(db: Db, sources: ImageSources): Promise<string[]> {
  const gameIds = [...sources.keys()];
  if (gameIds.length === 0) return [];
  const rows = await db
    .select({ id: sets.id })
    .from(sets)
    .where(
      and(
        inArray(sets.gameId, gameIds),
        exists(
          db
            .select({ one: sql`1` })
            .from(cards)
            .where(eq(cards.setId, sets.id)),
        ),
      ),
    )
    .orderBy(asc(sets.gameId), desc(sets.releaseDate), asc(sets.id));
  return rows.map((row) => row.id);
}

export function describeSetImages(setId: string, r: SetImagesResult): string {
  const counts =
    `${r.cards} cards, ${r.due} due, ${r.matched} matched, ${r.updated} updated, ` +
    `${r.unmatched} unmatched, ${r.requests} requests`;
  const source = r.source ? ` ${r.source}${r.sourceSetId ? `:${r.sourceSetId}` : ""}` : "";
  return `images ${setId} ${r.status}${source}: ${counts}${r.reason ? ` (${r.reason})` : ""}`;
}
