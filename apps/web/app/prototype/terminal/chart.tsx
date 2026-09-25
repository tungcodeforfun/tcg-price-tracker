// PROTOTYPE (UI redesign): design B trading chart. SVG draws in a 0–100 box stretched to the plot
// (non-scaling strokes); text is HTML positioned by percent so it stays crisp at any width.
import type { PricePoint } from "@tcg/core";
import { formatPrice, formatShortDate } from "~/lib/format";
import { direction } from "./chrome";

const Y_TICKS = 5;
const X_TICKS = 5;

/** Round a raw tick step up to 1, 2, 2.5 or 5 × 10ⁿ cents. */
function niceStep(raw: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * magnitude >= raw)!;
  return step * magnitude;
}

export function TradingChart({ points, label }: { points: PricePoint[]; label: string }) {
  if (points.length < 2) {
    return (
      <div className="grid h-[240px] place-items-center sm:h-[320px]">
        <p className="t-micro">No prints in range · not enough price history yet</p>
      </div>
    );
  }

  const prices = points.map((p) => p.priceCents);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const step = niceStep(Math.max(high - low, high * 0.02, 1) / (Y_TICKS - 1));
  const lo = Math.max(0, Math.floor(low / step) * step - step / 2);
  const hi = Math.ceil(high / step) * step + step / 2;
  const times = points.map((p) => Date.parse(`${p.day}T00:00:00Z`));
  const span = times.at(-1)! - times[0]! || 1;
  const x = (i: number) => ((times[i]! - times[0]!) / span) * 100;
  const y = (cents: number) => (1 - (cents - lo) / (hi - lo)) * 100;

  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  const dateTicks = Array.from({ length: X_TICKS }, (_, k) => (k / (X_TICKS - 1)) * 100);

  const line = points
    .map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(p.priceCents).toFixed(2)}`)
    .join("");
  const first = points[0]!;
  const last = points.at(-1)!;
  const tone =
    direction(last.priceCents - first.priceCents) === "down" ? "var(--t-down)" : "var(--t-up)";
  const highIndex = prices.indexOf(high);
  const lowIndex = prices.indexOf(low);
  const lastY = y(last.priceCents);

  return (
    <figure
      role="img"
      aria-label={`${label}: ${formatPrice(first.priceCents)} on ${formatShortDate(first.day)} to ${formatPrice(last.priceCents)} on ${formatShortDate(last.day)}. High ${formatPrice(high)}, low ${formatPrice(low)}.`}
      className="relative h-[240px] select-none sm:h-[320px]"
    >
      {/* plot area */}
      <div aria-hidden className="absolute top-3 right-[72px] bottom-7 left-3">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          <defs>
            <linearGradient id="t-chart-fill" x1="0" x2="0" y1="0" y2="1">
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
              stroke="var(--t-grid)"
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
              stroke="var(--t-grid)"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={`${line}L100,100L0,100Z`} fill="url(#t-chart-fill)" />
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
        <Extreme kind="H" cents={high} left={x(highIndex)} top={y(high)} />
        <Extreme kind="L" cents={low} left={x(lowIndex)} top={y(low)} />
      </div>

      {/* right price axis */}
      <div
        aria-hidden
        className="absolute top-3 right-0 bottom-7 w-[72px] border-l border-(--t-wire)"
      >
        {ticks.map((v) => (
          <span
            key={v}
            className="absolute left-2 -translate-y-1/2 text-[10.5px] text-(--t-mute)"
            style={{ top: `${y(v)}%` }}
          >
            {formatPrice(v)}
          </span>
        ))}
        <span
          className="absolute left-0 -translate-y-1/2 px-1.5 py-0.5 text-[11px] font-bold text-(--t-void)"
          style={{ top: `${lastY}%`, background: tone }}
        >
          {formatPrice(last.priceCents)}
        </span>
      </div>

      {/* time axis */}
      <div
        aria-hidden
        className="absolute right-[72px] bottom-0 left-3 h-7 border-t border-(--t-wire)"
      >
        {dateTicks.map((pct, k) => (
          <span
            key={pct}
            className={`absolute top-1.5 text-[10.5px] whitespace-nowrap text-(--t-mute) uppercase ${
              k === 0 ? "" : k === X_TICKS - 1 ? "-translate-x-full" : "-translate-x-1/2"
            } ${k % 2 ? "hidden sm:block" : ""}`}
            style={{ left: `${pct}%` }}
          >
            {formatShortDate(new Date(times[0]! + (pct / 100) * span))}
          </span>
        ))}
      </div>
    </figure>
  );
}

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
  const alignRight = left > 70;
  return (
    <span
      className={`absolute text-[10px] whitespace-nowrap text-(--t-text) ${alignRight ? "-translate-x-full" : ""} ${
        kind === "H" ? "-translate-y-full pb-1" : "pt-1"
      }`}
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      <span className="text-(--t-amber)">{kind}</span> {formatPrice(cents)}
    </span>
  );
}
