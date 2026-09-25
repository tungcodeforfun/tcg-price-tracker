import { formatPrice, formatShortDate } from "~/lib/format";

export interface ChartPoint {
  day: string;
  priceCents: number;
}

const WIDTH = 640;
const HEIGHT = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 64 };

/** Server-rendered SVG line chart: no client JavaScript. */
/** `subject` names what's charted in the accessible summary ("Price", "Portfolio value"). */
export function PriceChart({
  points,
  subject = "Price",
}: {
  points: ChartPoint[];
  subject?: string;
}) {
  if (points.length < 2) {
    return (
      <p className="rounded-md border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-700">
        Not enough price history yet.
      </p>
    );
  }
  const prices = points.map((p) => p.priceCents);
  let min = Math.min(...prices);
  let max = Math.max(...prices);
  if (min === max) {
    min = Math.floor(min * 0.95);
    max = Math.ceil(max * 1.05) || 1;
  }
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * innerW;
  const y = (cents: number) => PAD.top + (1 - (cents - min) / (max - min)) * innerH;
  const line = points
    .map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.priceCents).toFixed(1)}`)
    .join("");
  const area = `${line}L${x(points.length - 1).toFixed(1)},${PAD.top + innerH}L${PAD.left},${PAD.top + innerH}Z`;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const rising = last.priceCents >= first.priceCents;
  const stroke = rising
    ? "stroke-green-600 dark:stroke-green-400"
    : "stroke-red-600 dark:stroke-red-400";
  const fill = rising ? "fill-green-600/10" : "fill-red-600/10";
  const label = `${subject} went from ${formatPrice(first.priceCents)} on ${formatShortDate(first.day)} to ${formatPrice(last.priceCents)} on ${formatShortDate(last.day)}.`;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label} className="h-auto w-full">
      {[max, (max + min) / 2, min].map((v) => (
        <g key={v}>
          <line
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={y(v)}
            y2={y(v)}
            className="stroke-gray-200 dark:stroke-gray-800"
          />
          <text
            x={PAD.left - 8}
            y={y(v)}
            dy="0.32em"
            textAnchor="end"
            className="fill-gray-500 text-[11px]"
          >
            {formatPrice(Math.round(v))}
          </text>
        </g>
      ))}
      <path d={area} className={fill} />
      <path d={line} fill="none" strokeWidth={2} strokeLinejoin="round" className={stroke} />
      <text x={PAD.left} y={HEIGHT - 8} className="fill-gray-500 text-[11px]">
        {formatShortDate(first.day)}
      </text>
      <text
        x={WIDTH - PAD.right}
        y={HEIGHT - 8}
        textAnchor="end"
        className="fill-gray-500 text-[11px]"
      >
        {formatShortDate(last.day)}
      </text>
    </svg>
  );
}
