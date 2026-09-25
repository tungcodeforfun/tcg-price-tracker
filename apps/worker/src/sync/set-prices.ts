import { cards, pricePoints, sets, variants, type Db } from "@tcg/db";
import type { PriceProvider, ProviderCard, ProviderVariant } from "@tcg/pricing";
import { eq, sql } from "drizzle-orm";
import { excluded, insertBatches } from "./bulk.ts";
import { trackRun, type RunResult } from "./runs.ts";

const utcDay = (date: Date): string => date.toISOString().slice(0, 10);

/** One point per UTC day: the history, with the current price winning the day it was updated. */
function dailyPoints(variant: ProviderVariant) {
  const byDay = new Map(variant.history.map((point) => [point.day, point.priceCents]));
  if (variant.priceCents !== null && variant.priceUpdatedAt !== null) {
    byDay.set(utcDay(variant.priceUpdatedAt), variant.priceCents);
  }
  return Array.from(byDay, ([day, priceCents]) => ({ variantId: variant.id, day, priceCents }));
}

/** Upserts one page of cards in a single transaction; returns the number of variants written. */
async function savePage(
  db: Db,
  set: { id: string; gameId: string },
  page: ProviderCard[],
): Promise<number> {
  if (page.length === 0) return 0;
  const cardRows = page.map((card) => ({
    id: card.id,
    slug: card.slug,
    gameId: set.gameId,
    setId: set.id,
    name: card.name,
    number: card.number,
    rarity: card.rarity,
    tcgplayerId: card.tcgplayerId,
    details: card.details,
  }));
  const variantRows = page.flatMap((card) =>
    card.variants.map((variant) => ({
      id: variant.id,
      cardId: card.id,
      condition: variant.condition,
      printing: variant.printing,
      language: variant.language,
      tcgplayerSkuId: variant.tcgplayerSkuId,
      priceCents: variant.priceCents,
      priceChange7dPct: variant.priceChange7dPct,
      priceUpdatedAt: variant.priceUpdatedAt,
    })),
  );
  const pointRows = page.flatMap((card) => card.variants.flatMap(dailyPoints));

  await db.transaction(async (tx) => {
    for (const batch of insertBatches(cardRows)) {
      await tx
        .insert(cards)
        .values(batch)
        .onConflictDoUpdate({
          target: cards.id,
          set: {
            slug: excluded(cards.slug),
            gameId: excluded(cards.gameId),
            setId: excluded(cards.setId),
            name: excluded(cards.name),
            number: excluded(cards.number),
            rarity: excluded(cards.rarity),
            tcgplayerId: excluded(cards.tcgplayerId),
            details: excluded(cards.details),
            updatedAt: sql`now()`,
          },
        });
    }
    for (const batch of insertBatches(variantRows)) {
      await tx
        .insert(variants)
        .values(batch)
        .onConflictDoUpdate({
          target: variants.id,
          set: {
            tcgplayerSkuId: excluded(variants.tcgplayerSkuId),
            priceCents: excluded(variants.priceCents),
            priceChange7dPct: excluded(variants.priceChange7dPct),
            priceUpdatedAt: excluded(variants.priceUpdatedAt),
            updatedAt: sql`now()`,
          },
        });
    }
    for (const batch of insertBatches(pointRows)) {
      await tx
        .insert(pricePoints)
        .values(batch)
        .onConflictDoUpdate({
          target: [pricePoints.variantId, pricePoints.day],
          set: { priceCents: excluded(pricePoints.priceCents) },
          // Most history repeats on every sync; skip rewriting unchanged rows.
          setWhere: sql`${pricePoints.priceCents} is distinct from ${excluded(pricePoints.priceCents)}`,
        });
    }
  });
  return variantRows.length;
}

/**
 * Mirrors one set's cards, variants and 30-day price history, one committed transaction per page.
 * `prices_synced_at` only moves once every page is in, so a set cut short by the quota stays stale.
 */
export async function syncSetPrices({
  db,
  provider,
  setId,
}: {
  db: Db;
  provider: PriceProvider;
  setId: string;
}): Promise<RunResult> {
  return trackRun(db, provider, { kind: "set-prices", target: setId }, async (counts) => {
    const [set] = await db
      .select({ id: sets.id, gameId: sets.gameId })
      .from(sets)
      .where(eq(sets.id, setId));
    if (!set) throw new Error(`Unknown set "${setId}"; sync the catalog first`);

    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const page = await provider.listCardsPage({ gameId: set.gameId, setId, offset });
      counts.variantsUpserted += await savePage(db, set, page.cards);
      counts.cardsUpserted += page.cards.length;
      offset += page.cards.length;
      hasMore = page.hasMore && page.cards.length > 0;
    }
    await db
      .update(sets)
      .set({ pricesSyncedAt: sql`now()` })
      .where(eq(sets.id, setId));
  });
}
