// Paints the card face for the WebGL texture. Mirrors the static faces in holo-card.tsx: same
// u-unit layout, text positioned by CSS line-box top so the crossfade from static to 3D lines up.
// "mask" mode paints the foil map instead: white where the shader applies foil, black where not.
import { FACE_H, HOLO, LEDGER, TERMINAL, initialOf, priceSize, titleSize } from "./tones";
import type { FaceText, HoloTone } from "./tones";

type Mode = "color" | "mask";

interface Pen {
  ctx: CanvasRenderingContext2D;
  /** Canvas pixels per u. */
  k: number;
}

export function paintFace(canvas: HTMLCanvasElement, tone: HoloTone, text: FaceText, mode: Mode) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  const pen = { ctx, k: canvas.width / 100 };
  ({ ledger: paintLedger, terminal: paintTerminal, holo: paintHolo })[tone](pen, text, mode);
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

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxW: number, force = false): string {
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

function paintLedger(pen: Pen, text: FaceText, mode: Mode) {
  const { ctx, k } = pen;
  const mask = mode === "mask";
  const c = mask
    ? { paper: "#000", panel: "#000", ink: "#000", inkSoft: "#000", accent: "#000", gold: "#fff" }
    : LEDGER;

  rect(pen, 0, 0, 100, FACE_H, c.paper);

  ctx.strokeStyle = c.gold;
  ctx.lineWidth = 0.55 * k;
  ctx.strokeRect(3.2 * k, 3.2 * k, 93.6 * k, (FACE_H - 6.4) * k);
  ctx.lineWidth = 0.22 * k;
  ctx.strokeRect(4.6 * k, 4.6 * k, 90.8 * k, (FACE_H - 9.2) * k);
  ctx.fillStyle = c.gold;
  for (const [cx, cy] of [
    [4.6, 4.6],
    [95.4, 4.6],
    [4.6, FACE_H - 4.6],
    [95.4, FACE_H - 4.6],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(cx * k, (cy - 1.4) * k);
    ctx.lineTo((cx + 1.4) * k, cy * k);
    ctx.lineTo(cx * k, (cy + 1.4) * k);
    ctx.lineTo((cx - 1.4) * k, cy * k);
    ctx.fill();
  }

  setFont(pen, `italic 400 {px} ${LEDGER.serif}`, 4.2);
  ctx.fillStyle = c.inkSoft;
  textBlock(pen, [ellipsize(ctx, text.subtitle, 80 * k)], 10, 8, 4.2, 1.2);
  rect(pen, 10, 14.6, 80, 0.25, c.inkSoft);

  // Art panel: engraved guilloché rings behind a gold-leaf medallion holding the initial.
  rect(pen, 10, 18, 80, 66, c.panel);
  ctx.save();
  ctx.beginPath();
  ctx.rect(10 * k, 18 * k, 80 * k, 66 * k);
  ctx.clip();
  ctx.strokeStyle = c.gold;
  ctx.lineWidth = 0.16 * k;
  for (let r = 2.3; r < 60; r += 2.3) {
    ctx.beginPath();
    ctx.ellipse(50 * k, 51 * k, (r - 0.08) * k, (r - 0.08) * 1.18 * k, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = c.gold;
  ctx.lineWidth = 0.35 * k;
  ctx.strokeRect(10 * k, 18 * k, 80 * k, 66 * k);
  ctx.fillStyle = c.gold;
  ctx.beginPath();
  ctx.ellipse(50 * k, 51 * k, 21 * k, 25 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = c.panel;
  ctx.lineWidth = 0.5 * k;
  ctx.beginPath();
  ctx.ellipse(50 * k, 51 * k, 19 * k, 23 * k, 0, 0, Math.PI * 2);
  ctx.stroke();
  setFont(pen, `italic 700 {px} ${LEDGER.serif}`, 40);
  ctx.fillStyle = c.ink;
  textBlock(pen, [initialOf(text.title)], 50, 31, 40, 1, "center");

  const size = titleSize("ledger", text.title);
  setFont(pen, `600 {px} ${LEDGER.serif}`, size);
  ctx.fillStyle = c.ink;
  textBlock(pen, wrap(pen, text.title, 80, 2), 10, 88, size, 1.06);

  setFont(pen, `600 {px} ${LEDGER.serif}`, 3, 0.14);
  ctx.fillStyle = c.inkSoft;
  textBlock(pen, ["MARKET PRICE"], 10, 121, 3, 1);

  // The price sits on a fixed baseline band, ruled off with an accountant's double underline.
  const priceU = priceSize("ledger", text.price);
  setFont(pen, `700 {px} ${LEDGER.serif}`, priceU);
  ctx.fillStyle = c.accent;
  textBlock(pen, [text.price], 90, 127 - priceU, priceU, 1, "right");
  const priceW = ctx.measureText(text.price).width / k;
  rect(pen, 90 - priceW, 127.8, priceW, 0.4, c.gold);
  rect(pen, 90 - priceW, 128.6, priceW, 0.4, c.gold);
}

function paintTerminal(pen: Pen, text: FaceText, mode: Mode) {
  const { ctx, k } = pen;
  const mask = mode === "mask";
  const c = mask
    ? { screen: "#000", panel: "#1c1c1c", grid: "#fff", phosphor: "#fff", dim: "#666", amber: "#888" }
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

  const size = titleSize("terminal", text.title);
  setFont(pen, `700 {px} ${TERMINAL.mono}`, size);
  ctx.fillStyle = c.phosphor;
  textBlock(pen, wrap(pen, text.title.toUpperCase(), 86, 2), 7, 84, size, 1.12);

  for (let x = 7; x < 93; x += 2.1) rect(pen, x, 109.5, Math.min(1.2, 93 - x), 0.25, c.dim);

  setFont(pen, `500 {px} ${TERMINAL.mono}`, 3.2, 0.08);
  ctx.fillStyle = c.dim;
  textBlock(pen, ["MKT PRICE"], 7, 116, 3.2, 1);
  const priceU = priceSize("terminal", text.price);
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

function paintHolo(pen: Pen, text: FaceText, mode: Mode) {
  const { ctx, k } = pen;
  const mask = mode === "mask";

  rect(pen, 0, 0, 100, FACE_H, mask ? "#262626" : HOLO.night);

  const border = ctx.createLinearGradient(0, 0, 100 * k, FACE_H * k);
  HOLO.prism.forEach((stop, i) => border.addColorStop(i / (HOLO.prism.length - 1), stop));
  ctx.strokeStyle = mask ? "#b3b3b3" : border;
  ctx.lineWidth = 0.4 * k;
  ctx.beginPath();
  ctx.roundRect(2 * k, 2 * k, 96 * k, (FACE_H - 4) * k, 3 * k);
  ctx.stroke();

  // Art window: prism field with fine diagonal etching; the shader adds the moving foil.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(5 * k, 5 * k, 90 * k, 80 * k, 3 * k);
  ctx.clip();
  if (mask) {
    rect(pen, 5, 5, 90, 80, "#fff");
  } else {
    // CSS `conic-gradient(from 200deg at 35% 32%)`: canvas conic angles start at 3 o'clock.
    const conic = ctx.createConicGradient(((200 - 90) * Math.PI) / 180, 36.5 * k, 30.6 * k);
    HOLO.prism.forEach((stop, i) => conic.addColorStop(i / (HOLO.prism.length - 1), stop));
    ctx.fillStyle = conic;
    ctx.fillRect(5 * k, 5 * k, 90 * k, 80 * k);
    ctx.save();
    ctx.translate(5 * k, 5 * k);
    ctx.rotate((25 * Math.PI) / 180);
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    for (let x = -60; x < 140; x += 2.4) ctx.fillRect(x * k, -80 * k, 0.2 * k, 240 * k);
    ctx.restore();
    const fade = ctx.createLinearGradient(0, 5 * k, 0, 85 * k);
    fade.addColorStop(0.62, "rgba(15, 12, 34, 0)");
    fade.addColorStop(1, "rgba(15, 12, 34, 0.55)");
    ctx.fillStyle = fade;
    ctx.fillRect(5 * k, 5 * k, 90 * k, 80 * k);
  }
  setFont(pen, `900 {px} ${HOLO.display}`, 58);
  ctx.fillStyle = mask ? "#404040" : "rgba(15, 12, 34, 0.88)";
  textBlock(pen, [initialOf(text.title)], 50, 16, 58, 1, "center");
  ctx.restore();

  const size = titleSize("holo", text.title);
  setFont(pen, `700 {px} ${HOLO.display}`, size);
  ctx.fillStyle = mask ? "#000" : HOLO.ink;
  textBlock(pen, wrap(pen, text.title.toUpperCase(), 88, 2), 6, 89, size, 1.1);

  rect(pen, 6, 116.5, 88, 0.2, mask ? "#000" : "rgba(193, 185, 230, 0.35)");

  // Footer row mirrors the static face's flex row: the price keeps its width, the subtitle takes the rest.
  const priceU = priceSize("holo", text.price);
  setFont(pen, `700 {px} ${HOLO.display}`, priceU);
  ctx.fillStyle = mask ? "#000" : HOLO.ink;
  textBlock(pen, [text.price], 94, 120.5, priceU, 1, "right");
  const priceW = ctx.measureText(text.price).width / k;

  setFont(pen, `500 {px} ${HOLO.body}`, 3.3);
  ctx.fillStyle = mask ? "#000" : HOLO.inkSoft;
  textBlock(pen, wrap(pen, text.subtitle, 88 - priceW - 3, 2), 6, 120, 3.3, 1.25);
}
