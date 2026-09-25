// PROTOTYPE (UI redesign) — design C price chart: server-rendered SVG, monotone curve, foil fill.
import { useId } from "react";
import type { PricePoint } from "@tcg/core";
import { formatPrice, formatShortDate } from "~/lib/format";

const W = 1000;
const H = 400;
const PAD_Y = 28;

type Pt = [number, number];

/** Monotone cubic (Fritsch–Butland, evenly spaced points): smooth without overshooting real prices. */
function monotonePath(pts: Pt[]): string {
  const n = pts.length;
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    slopes.push((pts[i + 1]![1] - pts[i]![1]) / (pts[i + 1]![0] - pts[i]![0]));
  }
  const tangents = pts.map((_, i) => {
    if (i === 0) return slopes[0]!;
    if (i === n - 1) return slopes[n - 2]!;
    const a = slopes[i - 1]!;
    const b = slopes[i]!;
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  });
  let d = `M${pts[0]![0].toFixed(1)},${pts[0]![1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    const dx = (x1 - x0) / 3;
    d += `C${(x0 + dx).toFixed(1)},${(y0 + tangents[i]! * dx).toFixed(1)} ${(x1 - dx).toFixed(1)},${(y1 - tangents[i + 1]! * dx).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return d;
}

export function HoloChart({ points }: { points: PricePoint[] }) {
  const id = useId();
  if (points.length < 2) {
    return (
      <div className="grid h-56 place-items-center rounded-3xl border border-dashed border-(--holo-line) text-sm text-(--holo-mist) sm:h-72">
        Not enough price history yet.
      </div>
    );
  }
  const prices = points.map((p) => p.priceCents);
  let min = Math.min(...prices);
  let max = Math.max(...prices);
  if (min === max) {
    min = Math.floor(min * 0.95);
    max = Math.ceil(max * 1.05) || 1;
  }
  const y = (cents: number) => PAD_Y + (1 - (cents - min) / (max - min)) * (H - 2 * PAD_Y);
  const pts: Pt[] = points.map((p, i) => [(i / (points.length - 1)) * W, y(p.priceCents)]);
  const line = monotonePath(pts);
  const area = `${line}L${W},${H}L0,${H}Z`;
  const first = points[0]!;
  const last = points.at(-1)!;
  const pct = (v: number) => `${((v / H) * 100).toFixed(2)}%`;
  const label = `Price went from ${formatPrice(first.priceCents)} on ${formatShortDate(first.day)} to ${formatPrice(last.priceCents)} on ${formatShortDate(last.day)}; low ${formatPrice(min)}, high ${formatPrice(max)}.`;
  const guides = [max, (max + min) / 2, min];

  return (
    <figure className="m-0">
      <div className="relative h-56 sm:h-72">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={label}
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          <defs>
            <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#b79cff" stopOpacity="0.45" />
              <stop offset="55%" stopColor="#ff9fd6" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#120c22" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${id}-stroke`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#7ef5d8" />
              <stop offset="45%" stopColor="#b79cff" />
              <stop offset="80%" stopColor="#ff9fd6" />
              <stop offset="100%" stopColor="#ffe08a" />
            </linearGradient>
          </defs>
          {guides.map((v) => (
            <line
              key={v}
              x1={0}
              x2={W}
              y1={y(v)}
              y2={y(v)}
              stroke="#3a2f5e"
              strokeDasharray="2 6"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={area} fill={`url(#${id}-fill)`} />
          <path
            d={line}
            fill="none"
            stroke={`url(#${id}-stroke)`}
            strokeWidth={3}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {guides.map((v) => (
          <span
            key={v}
            aria-hidden
            style={{ top: pct(y(v)) }}
            className="holo-num absolute right-0 -translate-y-[calc(100%+4px)] text-[11px] font-medium text-(--holo-mist)"
          >
            {formatPrice(Math.round(v))}
          </span>
        ))}
        <span
          aria-hidden
          style={{ top: pct(y(last.priceCents)), left: "100%" }}
          className="absolute size-3 -translate-1/2 rounded-full bg-(--holo-gold) shadow-[0_0_0_4px_rgb(255_224_138/0.25)]"
        />
      </div>
      <figcaption className="holo-num mt-3 flex justify-between text-xs text-(--holo-mist)">
        <span>{formatShortDate(first.day)}</span>
        <span>{formatShortDate(last.day)}</span>
      </figcaption>
    </figure>
  );
}
