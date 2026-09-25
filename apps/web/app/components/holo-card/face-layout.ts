// Shared by the static face (holo-card.tsx) and the WebGL face texture (face-canvas.ts) so both
// paint the same card. Layout units: 1u = 1% of the card face width (CSS `cqw`).

export interface FaceText {
  title: string;
  subtitle: string;
  price: string;
}

/** Face height in u for a 63:88 card. */
export const FACE_H = (100 * 88) / 63;

/** Phosphor-screen palette. */
export const TERMINAL = {
  screen: "#07120c",
  panel: "#0a1b12",
  grid: "#16402a",
  phosphor: "#6af7a6",
  dim: "#3a9a66",
  amber: "#ffb547",
  edge: "#0f2a1b",
  shadow: "#1d7a4a",
  mono: '"JetBrains Mono Variable", ui-monospace, monospace',
} as const;

/** Title size in u, stepped by length so the canvas and CSS faces pick the same size. */
export function titleSize(title: string): number {
  const n = title.length;
  return n <= 16 ? 6.8 : n <= 26 ? 5.8 : 5;
}

export function initialOf(title: string): string {
  return (Array.from(title.trim())[0] ?? "·").toUpperCase();
}

/** Price size in u, stepped by length so long prices keep clear of their labels. */
export function priceSize(price: string): number {
  return price.length <= 9 ? 11 : 9;
}
