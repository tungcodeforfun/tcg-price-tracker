// Paints the card face for the WebGL texture. Mirrors the static faces in holo-card.tsx: same
// u-unit layout, text positioned by CSS line-box top so the crossfade from static to 3D lines up.
// "mask" mode paints the glow map instead: white where the shader blooms lit strokes, black where not.
import { FACE_H, TERMINAL, initialOf, priceSize, titleSize, type FaceText } from "./face-layout";

type Mode = "color" | "mask";

interface Pen {
  ctx: CanvasRenderingContext2D;
  /** Canvas pixels per u. */
  k: number;
}

function setFont(pen: Pen, font: string, sizeU: number, spacingEm = 0) {
  pen.ctx.font = font.replace("{px}", `${sizeU * pen.k}px`);
  pen.ctx.letterSpacing = `${spacingEm * sizeU * pen.k}px`;
}

/** Draws lines the way CSS lays out a block with `top`, `font-size` and `line-height`. */
function textBlock(
  pen: Pen,
  lines: string[],
  x: number,
  top: number,
  sizeU: number,
  lineHeight: number,
  align: CanvasTextAlign = "left",
) {
  const { ctx, k } = pen;
  const metrics = ctx.measureText("Hg");
  const ascent = metrics.fontBoundingBoxAscent;
  const descent = metrics.fontBoundingBoxDescent;
  const lineH = sizeU * lineHeight * k;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  lines.forEach((line, i) => {
    const baseline = top * k + i * lineH + (lineH - ascent - descent) / 2 + ascent;
    ctx.fillText(line, x * k, baseline);
  });
}

function ellipsize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  force = false,
): string {
  if (!force && ctx.measureText(text).width <= maxW) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxW) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/** Greedy word wrap with an ellipsis on the last allowed line, like `line-clamp`. */
function wrap(pen: Pen, text: string, widthU: number, maxLines: number): string[] {
  const { ctx } = pen;
  const maxW = widthU * pen.k;
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(next).width <= maxW) {
      line = next;
      continue;
    }
    if (lines.length === maxLines - 1) {
      // Like line-clamp: the last line keeps the words that fit, then marks the cut.
      lines.push(ellipsize(ctx, line, maxW, true));
      return lines;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(ellipsize(ctx, line, maxW));
  return lines;
}

function rect(pen: Pen, x: number, y: number, w: number, h: number, fill: string) {
  const { ctx, k } = pen;
  ctx.fillStyle = fill;
  ctx.fillRect(x * k, y * k, w * k, h * k);
}

export function paintFace(canvas: HTMLCanvasElement, text: FaceText, mode: Mode) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  const k = canvas.width / 100;
  const pen = { ctx, k };
  const c =
    mode === "mask"
      ? {
          screen: "#000",
          panel: "#1c1c1c",
          grid: "#fff",
          phosphor: "#fff",
          dim: "#666",
          amber: "#888",
        }
      : TERMINAL;

  rect(pen, 0, 0, 100, FACE_H, c.screen);
  ctx.strokeStyle = c.dim;
  ctx.lineWidth = 0.3 * k;
  ctx.beginPath();
  ctx.roundRect(2.4 * k, 2.4 * k, 95.2 * k, (FACE_H - 4.8) * k, 2.4 * k);
  ctx.stroke();

  setFont(pen, `500 {px} ${TERMINAL.mono}`, 3.3, 0.06);
  ctx.fillStyle = c.dim;
  textBlock(pen, [ellipsize(ctx, text.subtitle.toUpperCase(), 86 * k)], 7, 6, 3.3, 1.2);

  // Art: plotting grid with crosshair and the outlined initial.
  rect(pen, 7, 12, 86, 68, c.panel);
  for (let x = 7; x < 93; x += 4.3) rect(pen, x, 12, 0.15, 68, c.grid);
  for (let y = 12; y < 80; y += 4.25) rect(pen, 7, y, 86, 0.15, c.grid);
  rect(pen, 49.9, 12, 0.2, 68, c.dim);
  rect(pen, 7, 45.9, 86, 0.2, c.dim);
  setFont(pen, `800 {px} ${TERMINAL.mono}`, 50);
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = c.phosphor;
  textBlock(pen, [initialOf(text.title)], 50, 21, 50, 1, "center");
  ctx.globalAlpha = 1;
  ctx.strokeStyle = c.phosphor;
  ctx.lineWidth = 0.35 * k;
  const glyphMetrics = ctx.measureText("Hg");
  const glyphBaseline =
    21 * k +
    (50 * k - glyphMetrics.fontBoundingBoxAscent - glyphMetrics.fontBoundingBoxDescent) / 2 +
    glyphMetrics.fontBoundingBoxAscent;
  ctx.strokeText(initialOf(text.title), 50 * k, glyphBaseline);
  for (const [x, y, dx, dy] of [
    [7, 12, 1, 1],
    [93, 12, -1, 1],
    [7, 80, 1, -1],
    [93, 80, -1, -1],
  ] as const) {
    rect(pen, dx > 0 ? x : x - 3, dy > 0 ? y : y - 0.5, 3, 0.5, c.phosphor);
    rect(pen, dx > 0 ? x : x - 0.5, dy > 0 ? y : y - 3, 0.5, 3, c.phosphor);
  }

  const size = titleSize(text.title);
  setFont(pen, `700 {px} ${TERMINAL.mono}`, size);
  ctx.fillStyle = c.phosphor;
  textBlock(pen, wrap(pen, text.title.toUpperCase(), 86, 2), 7, 84, size, 1.12);

  for (let x = 7; x < 93; x += 2.1) rect(pen, x, 109.5, Math.min(1.2, 93 - x), 0.25, c.dim);

  setFont(pen, `500 {px} ${TERMINAL.mono}`, 3.2, 0.08);
  ctx.fillStyle = c.dim;
  textBlock(pen, ["MKT PRICE"], 7, 116, 3.2, 1);
  const priceU = priceSize(text.price);
  setFont(pen, `700 {px} ${TERMINAL.mono}`, priceU);
  ctx.fillStyle = c.amber;
  textBlock(pen, [text.price], 93, 124 - priceU, priceU, 1, "right");

  for (const [x, y, dx, dy] of [
    [2.4, 2.4, 1, 1],
    [97.6, 2.4, -1, 1],
    [2.4, FACE_H - 2.4, 1, -1],
    [97.6, FACE_H - 2.4, -1, -1],
  ] as const) {
    rect(pen, dx > 0 ? x : x - 6, dy > 0 ? y : y - 0.7, 6, 0.7, c.phosphor);
    rect(pen, dx > 0 ? x : x - 0.7, dy > 0 ? y : y - 6, 0.7, 6, c.phosphor);
  }
}
