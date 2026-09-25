// SVG draws in a 0–100 box stretched to the plot (non-scaling strokes); text is HTML positioned
// by percent so it stays crisp at any width. Server-rendered, no client JavaScript needed.
import { useId } from "react";
import { formatPrice, formatShortDate } from "~/lib/format";

export interface ChartPoint {
  /** `YYYY-MM-DD` (UTC). */
  day: string;
  /** Value in USD cents. */
  cents: number;
}

export interface TradingChartProps {
  /** Chronological series; fewer than two points shows an empty state. */
  points: ChartPoint[];
  /** What is plotted, for the accessible summary, e.g. "Holofoil Near Mint price, 30D". */
  subject: string;
}

const Y_TICKS = 5;
const X_TICKS = 5;

/** Round a raw tick step up to 1, 2, 2.5 or 5 × 10ⁿ cents. */
function niceStep(raw: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * magnitude >= raw)!;
  return step * magnitude;
}

/** Line chart with a right-hand price axis, last-value marker and high/low labels. */
export function TradingChart({ points, subject }: TradingChartProps) {
  const fillId = `chart-fill-${useId().replace(/[^\w-]/g, "")}`;
  if (points.length < 2) {
    return (
      <div className="grid h-[240px] place-items-center px-4 text-center sm:h-[320px]">
        <p className="micro">No prints in range · not enough history yet</p>
      </div>
    );
  }

  const values = points.map((p) => p.cents);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const step = niceStep(Math.max(high - low, high * 0.02, 1) / (Y_TICKS - 1));
  const lo = Math.max(0, Math.floor(low / step) * step - step / 2);
  const hi = Math.ceil(high / step) * step + step / 2;
  const times = points.map((p) => Date.parse(`${p.day}T00:00:00Z`));
  const start = times[0]!;
  const span = times.at(-1)! - start || 1;
  const x = (i: number) => ((times[i]! - start) / span) * 100;
  const y = (cents: number) => (1 - (cents - lo) / (hi - lo)) * 100;

  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  const dateTicks = Array.from({ length: X_TICKS }, (_, k) => (k / (X_TICKS - 1)) * 100);

  const line = points
    .map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(p.cents).toFixed(2)}`)
    .join("");
  const first = points[0]!;
  const last = points.at(-1)!;
  const tone = last.cents < first.cents ? "var(--color-down)" : "var(--color-up)";
  const lastY = y(last.cents);

  return (
    <figure
      role="img"
      aria-label={`${subject}: ${formatPrice(first.cents)} on ${formatShortDate(first.day)} to ${formatPrice(last.cents)} on ${formatShortDate(last.day)}. High ${formatPrice(high)}, low ${formatPrice(low)}.`}
      className="relative h-[240px] select-none sm:h-[320px]"
    >
      <div aria-hidden className="absolute top-3 right-[72px] bottom-7 left-3">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          <defs>
            <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={tone} stopOpacity="0.22" />
              <stop offset="1" stopColor={tone} stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((v) => (
            <line
              key={v}
              x1="0"
              x2="100"
              y1={y(v)}
              y2={y(v)}
              className="stroke-grid"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {dateTicks.map((pct) => (
            <line
              key={pct}
              x1={pct}
              x2={pct}
              y1="0"
              y2="100"
              className="stroke-grid"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={`${line}L100,100L0,100Z`} fill={`url(#${fillId})`} />
          <line
            x1="0"
            x2="100"
            y1={lastY}
            y2={lastY}
            stroke={tone}
            strokeDasharray="3 3"
            strokeOpacity="0.8"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={line}
            fill="none"
            stroke={tone}
            strokeWidth="1.75"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <span
          className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2"
          style={{ left: "100%", top: `${lastY}%`, background: tone }}
        />
        <Extreme kind="H" cents={high} left={x(values.indexOf(high))} top={y(high)} />
        <Extreme kind="L" cents={low} left={x(values.indexOf(low))} top={y(low)} />
      </div>

      <div aria-hidden className="absolute top-3 right-0 bottom-7 w-[72px] border-l border-wire">
        {ticks.map((v) => (
          <span
            key={v}
            className="absolute left-2 -translate-y-1/2 text-[10.5px] text-mute"
            style={{ top: `${y(v)}%` }}
          >
            {formatPrice(v)}
          </span>
        ))}
        <span
          className="absolute left-0 -translate-y-1/2 px-1.5 py-0.5 text-[11px] font-bold text-void"
          style={{ top: `${lastY}%`, background: tone }}
        >
          {formatPrice(last.cents)}
        </span>
      </div>

      <div aria-hidden className="absolute right-[72px] bottom-0 left-3 h-7 border-t border-wire">
        {dateTicks.map((pct, k) => (
          <span
            key={pct}
            className={`absolute top-1.5 text-[10.5px] whitespace-nowrap text-mute uppercase ${
              k === 0 ? "" : k === X_TICKS - 1 ? "-translate-x-full" : "-translate-x-1/2"
            } ${k % 2 ? "hidden sm:block" : ""}`}
            style={{ left: `${pct}%` }}
          >
            {formatShortDate(new Date(start + (pct / 100) * span))}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** High/low label at a data point, flipped left near the right edge. */
function Extreme({
  kind,
  cents,
  left,
  top,
}: {
  kind: "H" | "L";
  cents: number;
  left: number;
  top: number;
}) {
  return (
    <span
      className={`absolute text-[10px] whitespace-nowrap ${left > 70 ? "-translate-x-full" : ""} ${
        kind === "H" ? "-translate-y-full pb-1" : "pt-1"
      }`}
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      <span className="text-amber">{kind}</span> {formatPrice(cents)}
    </span>
  );
}
