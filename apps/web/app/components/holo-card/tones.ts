// Shared by the static face (holo-card.tsx) and the WebGL face texture (face-canvas.ts) so both
// paint the same card. Layout units: 1u = 1% of the card face width (CSS `cqw`).

export type HoloTone = "ledger" | "terminal" | "holo";

export interface FaceText {
  title: string;
  subtitle: string;
  price: string;
}

/** Face height in u for a 63:88 card. */
export const FACE_H = (100 * 88) / 63;

export const LEDGER = {
  paper: "#f3ead3",
  panel: "#e9dcbc",
  ink: "#2b2118",
  inkSoft: "#5c4a36",
  accent: "#7b2d26",
  gold: "#a8823a",
  goldLight: "#f3d98f",
  goldDark: "#6b4f1d",
  edge: "#d8c7a0",
  shadow: "#3a2612",
  serif: '"Fraunces Variable", Georgia, serif',
} as const;

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

export const HOLO = {
  night: "#0f0c22",
  ink: "#f7f4ff",
  inkSoft: "#c1b9e6",
  prism: ["#ff7eb3", "#ffd36e", "#86ffc6", "#6fd3ff", "#b39bff", "#ff7eb3"],
  edge: "#2d2560",
  shadow: "#5b3fd9",
  display: '"Unbounded Variable", "Arial Black", sans-serif',
  body: '"Space Grotesk Variable", ui-sans-serif, sans-serif',
} as const;

/** Title size in u, stepped by length so the canvas and CSS faces pick the same size. */
export function titleSize(tone: HoloTone, title: string): number {
  const steps = ({ ledger: [9.5, 8, 6.6], terminal: [6.8, 5.8, 5], holo: [6.2, 5.2, 4.4] } as const)[tone];
  const n = title.length;
  return n <= 16 ? steps[0] : n <= 26 ? steps[1] : steps[2];
}

export function initialOf(title: string): string {
  return (Array.from(title.trim())[0] ?? "·").toUpperCase();
}

/** Price size in u, stepped by length so long prices keep clear of their labels. */
export function priceSize(tone: HoloTone, price: string): number {
  const steps = ({ ledger: [10, 8.5, 7], terminal: [11, 11, 9], holo: [8.5, 7, 6] } as const)[tone];
  const n = price.length;
  return n <= 7 ? steps[0] : n <= 9 ? steps[1] : steps[2];
}
