// PROTOTYPE (UI redesign) — Design A price history: a fine-line, hatched "engraving".
// Server-rendered: HTML/CSS positions in percent, one SVG path with non-scaling strokes.
import type { PricePoint } from "@tcg/core";
import { formatPrice, formatShortDate } from "~/lib/format";

const PAD = 0.14;

function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}

function scale(prices: number[]) {
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || Math.max(max * 0.1, 100);
  const lo = Math.max(0, min - span * PAD);
  const hi = max + span * PAD;
  const step = niceStep((hi - lo) / 4);
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t);
  return { lo, hi, ticks };
}

function tickEvery(n: number): number {
  if (n <= 31) return 1;
  if (n <= 100) return 7;
  return 30;
}

const anchor = (x: number) =>
  x > 85
    ? "-translate-x-full pr-2 text-right"
    : x < 15
      ? "pl-2 text-left"
      : "-translate-x-1/2 text-center";

export function EngravedChart({ points, caption }: { points: PricePoint[]; caption: string }) {
  if (points.length < 2) {
    return (
      <figure>
        <div className="ledger-hatch grid h-48 place-items-center border-y border-(--ink)">
          <p className="bg-(--paper) px-3 italic text-(--ink-soft)">
            Not enough price history yet.
          </p>
        </div>
      </figure>
    );
  }

  const prices = points.map((p) => p.priceCents);
  const { lo, hi, ticks } = scale(prices);
  const last = points.length - 1;
  const x = (i: number) => (i / last) * 100;
  const y = (cents: number) => (1 - (cents - lo) / (hi - lo)) * 100;
  const coords = points.map((p, i) => `${x(i).toFixed(2)} ${y(p.priceCents).toFixed(2)}`);
  const line = `M${coords.join("L")}`;
  const hatch = `polygon(0% 100%, ${coords.map((c) => c.replace(" ", "% ") + "%").join(", ")}, 100% 100%)`;

  const highIndex = prices.indexOf(Math.max(...prices));
  const lowIndex = prices.indexOf(Math.min(...prices));
  const first = points[0]!;
  const final = points[last]!;
  const finalY = y(final.priceCents);
  const every = tickEvery(points.length);
  const summary = `Price went from ${formatPrice(first.priceCents)} on ${formatShortDate(first.day)} to ${formatPrice(final.priceCents)} on ${formatShortDate(final.day)}; high ${formatPrice(prices[highIndex])}, low ${formatPrice(prices[lowIndex])}.`;

  // The latest point already carries its own price tag.
  const notes = [
    { i: highIndex, label: `High ${formatPrice(prices[highIndex])}`, above: true },
    { i: lowIndex, label: `Low ${formatPrice(prices[lowIndex])}`, above: false },
  ].filter((note, n) => note.i !== last && (n === 0 || lowIndex !== highIndex));

  return (
    <figure>
      <div role="img" aria-label={summary} className="relative h-[16rem] select-none sm:h-[21rem]">
        <div className="absolute top-0 right-[4.75rem] bottom-10 left-0 border-y border-(--ink)">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0" style={{ top: `${y(t)}%` }}>
              <div className="border-t border-dotted border-(--rule)" />
              {Math.abs(y(t) - finalY) > 9 && (
                <span className="ledger-num absolute left-[calc(100%+0.6rem)] -translate-y-1/2 text-[0.8rem] italic whitespace-nowrap text-(--ink-soft)">
                  {formatPrice(t)}
                </span>
              )}
            </div>
          ))}

          <div className="ledger-hatch absolute inset-0" style={{ clipPath: hatch }} />
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
            aria-hidden
          >
            <path
              d={line}
              fill="none"
              stroke="var(--paper)"
              strokeWidth={5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={line}
              fill="none"
              stroke="var(--ink)"
              strokeWidth={1.35}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {notes.map((note) => (
            <div
              key={note.label}
              className="absolute"
              style={{ left: `${x(note.i)}%`, top: `${y(prices[note.i]!)}%` }}
            >
              <span className="absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-(--ink) bg-(--paper)" />
              <span
                className={`ledger-caps absolute text-[0.8rem] whitespace-nowrap text-(--ink) ${anchor(x(note.i))} ${
                  note.above ? "-top-[1.55rem]" : "top-[0.45rem]"
                }`}
              >
                {note.label}
              </span>
            </div>
          ))}

          <div className="absolute right-0" style={{ top: `${finalY}%` }}>
            <span className="absolute size-[9px] translate-x-1/2 -translate-y-1/2 rounded-full bg-(--oxblood) ring-2 ring-(--paper)" />
            <span className="ledger-num absolute left-[0.6rem] -translate-y-1/2 bg-(--oxblood) px-1.5 py-px text-[0.85rem] whitespace-nowrap text-(--paper)">
              {formatPrice(final.priceCents)}
            </span>
          </div>

          <div className="absolute inset-x-0 top-full" aria-hidden>
            {points.map((p, i) => {
              const major = i === 0 || i === last || i === Math.round(last / 2);
              if (!major && i % every) return null;
              return (
                <div key={p.day} className="absolute top-0" style={{ left: `${x(i)}%` }}>
                  <span className={`absolute w-px bg-(--ink) ${major ? "h-2.5" : "h-1.5"}`} />
                  {major && (
                    <span
                      className={`ledger-num absolute top-3 text-[0.8rem] italic whitespace-nowrap text-(--ink-soft) ${anchor(x(i))}`}
                    >
                      {formatShortDate(p.day)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <figcaption className="mt-1 text-[0.95rem] italic text-(--ink-soft)">
        <span className="ledger-caps not-italic text-(--ink)">Fig. 1.</span> {caption} Recorded{" "}
        {formatShortDate(first.day)} to {formatShortDate(final.day)}.
      </figcaption>
    </figure>
  );
}
