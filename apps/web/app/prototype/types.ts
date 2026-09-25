// PROTOTYPE (UI redesign): shared data shapes each design variant renders. Delete with the prototype.
import type { CardDetail, HomeHighlights, PricePoint } from "@tcg/core";

export const VARIANTS = ["A", "B", "C"] as const;
export type Variant = (typeof VARIANTS)[number];
export const VARIANT_NAMES: Record<Variant, string> = {
  A: "Collector's ledger",
  B: "Trading terminal",
  C: "Holo showcase",
};

export function readVariant(search: URLSearchParams): Variant | null {
  const value = search.get("design");
  return import.meta.env.PROD ? null : (VARIANTS.find((v) => v === value) ?? null);
}

/** Keeps the chosen design on links between prototype pages. */
export function withDesign(path: string, design: Variant): string {
  return `${path}${path.includes("?") ? "&" : "?"}design=${design}`;
}

export interface HomeData {
  highlights: HomeHighlights;
}

export interface CardPageData {
  card: CardDetail;
  selectedId: string | null;
  range: number;
  history: PricePoint[];
}
