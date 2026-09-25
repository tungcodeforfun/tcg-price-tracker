// PROTOTYPE (UI redesign) — design C "Holo showcase": card detail page.
import { Link } from "react-router";
import type { CardDetail, VariantDetail } from "@tcg/core";
import { formatDate, formatPercent, formatPrice } from "~/lib/format";
import { withDesign, type CardPageData } from "../types";
import { HoloChart } from "./chart";
import { ChangeChip, DESIGN, HoloShell } from "./chrome";

const RANGES = [
  [30, "30D"],
  [90, "90D"],
  [365, "1Y"],
] as const;

function FoilCardFace({ card }: { card: CardDetail }) {
  return (
    <div aria-hidden className="holo-frame aspect-[63/88] w-full rounded-[26px]">
      <div className="relative flex h-full flex-col gap-3 overflow-hidden rounded-[20px] bg-(--holo-ink) p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="holo-display text-[clamp(1.1rem,3.4vw,1.6rem)] leading-[1.05] font-bold text-balance break-words hyphens-auto">
            {card.name}
          </p>
          {card.priceCents != null && (
            <p className="holo-display holo-num shrink-0 pt-1 text-sm font-semibold text-(--holo-gold)">
              {formatPrice(card.priceCents)}
            </p>
          )}
        </div>
        <div className="holo-engrave relative grid flex-1 place-items-center overflow-hidden rounded-xl border border-(--holo-line)"
        >
          <span className="holo-display holo-foil-text text-[clamp(8rem,28vw,15rem)] leading-none font-black">
            {card.name.charAt(0)}
          </span>
          <span className="holo-band absolute inset-x-0 bottom-0 h-1 opacity-80" />
        </div>
        <div className="space-y-1 rounded-xl bg-(--holo-ink-2) px-3 py-2.5 text-xs text-(--holo-mist)">
          <p className="font-semibold tracking-[0.12em] text-(--holo-paper) uppercase">
            {card.rarity ?? card.gameName}
          </p>
          <p>{card.setName}</p>
        </div>
        <div className="holo-num flex items-center justify-between text-[11px] font-medium tracking-[0.14em] text-(--holo-mist) uppercase">
          <span>{card.gameName}</span>
          <span>{card.number ?? "—"}</span>
        </div>
      </div>
    </div>
  );
}

/** "$1,042.77" → big dollars, small cents. */
function BigPrice({ cents }: { cents: number | null }) {
  const [whole, fraction] = formatPrice(cents).split(".");
  return (
    <p className="holo-display holo-num text-[clamp(3.75rem,11vw,8.5rem)] leading-[0.9] font-black tracking-[-0.045em]">
      {whole}
      {fraction && (
        <span className="align-top text-[0.42em] tracking-normal text-(--holo-mist)">.{fraction}</span>
      )}
    </p>
  );
}

function groupByPrinting(variants: VariantDetail[]): [string, VariantDetail[]][] {
  const groups = new Map<string, VariantDetail[]>();
  for (const v of variants) {
    const key = v.language === "English" ? v.printing : `${v.printing} · ${v.language}`;
    const list = groups.get(key);
    if (list) list.push(v);
    else groups.set(key, [v]);
  }
  return [...groups];
}

export function HoloCardPage({ card, selectedId, range, history }: CardPageData) {
  const selected = card.variants.find((v) => v.id === selectedId);
  const hrefFor = (variantId: string | null, r: number) => {
    const search = new URLSearchParams();
    if (variantId) search.set("variant", variantId);
    if (r !== 30) search.set("range", String(r));
    const qs = search.toString();
    return withDesign(`/cards/${card.slug}${qs ? `?${qs}` : ""}`, DESIGN);
  };
  const actionQuery = new URLSearchParams(
    selectedId ? { card: card.slug, variant: selectedId } : { card: card.slug },
  );
  const first = history[0];
  const last = history.at(-1);
  const rangePct =
    first && last && history.length > 1 && first.priceCents > 0
      ? ((last.priceCents - first.priceCents) / first.priceCents) * 100
      : null;
  const rangeLabel = RANGES.find(([r]) => r === range)?.[1] ?? `${range}D`;
  const meta = [card.setName, card.number, card.rarity].filter(Boolean).join(" · ");

  return (
    <HoloShell>
      <div className="mx-auto max-w-[1280px] px-5 pt-6 sm:px-8">
        <nav aria-label="Breadcrumb" className="text-sm text-(--holo-mist)">
          <ol className="flex flex-wrap gap-x-2 gap-y-1">
            <li>
              <Link to="/games" className="hover:text-(--holo-paper) hover:underline">
                Games
              </Link>
            </li>
            <li className="before:mr-2 before:text-(--holo-line) before:content-['/']">
              <Link to={`/games/${card.gameId}`} className="hover:text-(--holo-paper) hover:underline">
                {card.gameName}
              </Link>
            </li>
            <li className="before:mr-2 before:text-(--holo-line) before:content-['/']">
              <Link to={`/sets/${card.setId}`} className="hover:text-(--holo-paper) hover:underline">
                {card.setName}
              </Link>
            </li>
            <li className="text-(--holo-paper) before:mr-2 before:text-(--holo-line) before:content-['/']">
              <span aria-current="page">{card.name}</span>
            </li>
          </ol>
        </nav>

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-16">
          <div className="mx-auto w-full max-w-[16rem] sm:max-w-[340px] lg:sticky lg:top-8 lg:max-w-none lg:self-start">
            <FoilCardFace card={card} />
            {card.details && (
              <p className="mt-6 text-sm leading-relaxed text-(--holo-mist)">{card.details}</p>
            )}
          </div>

          <div className="min-w-0">
            <h1 className="holo-display text-[clamp(2rem,5.5vw,4.25rem)] leading-[0.95] font-bold text-balance">
              {card.name}
            </h1>
            <p className="mt-3 text-(--holo-mist)">{meta}</p>

            <section aria-labelledby="holo-price" className="mt-10 border-t border-(--holo-line) pt-6">
              <h2
                id="holo-price"
                className="text-xs font-semibold tracking-[0.18em] text-(--holo-mist) uppercase"
              >
                Market price
                {selected ? ` · ${selected.printing} · ${selected.condition}` : " · Near Mint"}
              </h2>
              <div className="mt-3">
                <BigPrice cents={selected ? selected.priceCents : card.priceCents} />
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-(--holo-mist)">
                {selected && (
                  <span className="flex items-center gap-2">
                    <ChangeChip pct={selected.priceChange7dPct} /> 7 days
                  </span>
                )}
                {rangePct != null && (
                  <span className="flex items-center gap-2">
                    <ChangeChip pct={rangePct} /> {rangeLabel}
                  </span>
                )}
                {selected?.priceUpdatedAt && <span>Updated {formatDate(selected.priceUpdatedAt)}</span>}
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  to={`/app/add?${actionQuery}`}
                  className="rounded-full bg-(--holo-paper) px-5 py-2.5 text-sm font-semibold text-(--holo-ink) hover:bg-(--holo-gold)"
                >
                  Add to collection
                </Link>
                <Link
                  to={`/app/alerts/new?${actionQuery}`}
                  className="rounded-full border border-(--holo-line) px-5 py-2.5 text-sm font-semibold hover:border-(--holo-lilac)"
                >
                  Set price alert
                </Link>
              </div>
            </section>

            <section aria-labelledby="holo-history" className="mt-14">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2 id="holo-history" className="holo-display text-xl font-bold">
                  Price history
                </h2>
                <nav
                  aria-label="History range"
                  className="flex rounded-full border border-(--holo-line) bg-(--holo-ink-2) p-1"
                >
                  {RANGES.map(([r, label]) => (
                    <Link
                      key={r}
                      to={hrefFor(selectedId, r)}
                      preventScrollReset
                      aria-current={r === range ? "true" : undefined}
                      className="holo-num rounded-full px-4 py-1.5 text-sm font-semibold text-(--holo-mist) hover:text-(--holo-paper) aria-[current]:bg-(--holo-lilac) aria-[current]:text-(--holo-ink)"
                    >
                      {label}
                    </Link>
                  ))}
                </nav>
              </div>
              <div className="mt-6">
                <HoloChart points={history} />
              </div>
            </section>

            <section aria-labelledby="holo-variants" className="mt-14">
              <h2 id="holo-variants" className="holo-display text-xl font-bold">
                Printings &amp; conditions
              </h2>
              <p className="mt-1 text-sm text-(--holo-mist)">
                Pick one to chart its price. Change is over 7 days.
              </p>
              <div className="mt-6 space-y-7">
                {groupByPrinting(card.variants).map(([printing, list], g) => (
                  <div key={printing} role="group" aria-labelledby={`holo-p-${g}`}>
                    <h3
                      id={`holo-p-${g}`}
                      className="mb-3 flex items-center gap-3 text-xs font-semibold tracking-[0.18em] text-(--holo-paper) uppercase after:h-px after:flex-1 after:bg-(--holo-line)"
                    >
                      {printing}
                    </h3>
                    <ul className="flex flex-wrap gap-2.5">
                      {list.map((v) => (
                        <li key={v.id}>
                          <Link
                            to={hrefFor(v.id, range)}
                            preventScrollReset
                            aria-current={v.id === selectedId ? "true" : undefined}
                            className="holo-foil-hover group flex min-w-[9.5rem] flex-col rounded-2xl px-4 py-3 [--holo-fill:var(--holo-ink-2)] aria-[current]:[--holo-fill:var(--holo-ink-3)]"
                          >
                            <span className="text-xs font-medium text-(--holo-mist) group-aria-[current]:text-(--holo-paper)">
                              {v.condition}
                            </span>
                            <span className="holo-display holo-num mt-1 text-lg font-bold">
                              {formatPrice(v.priceCents)}
                            </span>
                            <span
                              className={`holo-num mt-0.5 text-xs font-semibold ${
                                (v.priceChange7dPct ?? 0) > 0
                                  ? "text-(--holo-up)"
                                  : (v.priceChange7dPct ?? 0) < 0
                                    ? "text-(--holo-down)"
                                    : "text-(--holo-mist)"
                              }`}
                            >
                              {formatPercent(v.priceChange7dPct).replace("-", "−")}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </HoloShell>
  );
}
