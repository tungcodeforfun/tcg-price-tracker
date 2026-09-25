import { defaultVariant, getCard, getPriceHistory } from "~/.server/catalog";
import { Link } from "react-router";
import { db } from "~/.server/db";
import { env } from "~/.server/env";
import { CardFace } from "~/components/card-tile";
import { PriceChart } from "~/components/price-chart";
import { Breadcrumbs } from "~/components/site-header";
import { formatDate, formatPercent, formatPrice } from "~/lib/format";
import { CATALOG_CACHE, notFound } from "~/lib/http";
import { pageMeta } from "~/lib/seo";
import type { Route } from "./+types/card";

const RANGES = [30, 90, 365] as const;

export async function loader({ params, request }: Route.LoaderArgs) {
  const card = await getCard(db, params.slug);
  if (!card) throw notFound();
  const url = new URL(request.url);
  const requested = card.variants.find((v) => v.id === url.searchParams.get("variant"));
  const selected = requested ?? defaultVariant(card.variants);
  const range = RANGES.find((r) => String(r) === url.searchParams.get("range")) ?? 30;
  const history = selected ? await getPriceHistory(db, selected.id, range) : [];
  return { card, selectedId: selected?.id ?? null, range, history, origin: env.appUrl };
}

export const headers: Route.HeadersFunction = () => ({ "Cache-Control": CATALOG_CACHE });

export const meta: Route.MetaFunction = ({ loaderData }) => {
  if (!loaderData) return [];
  const { card } = loaderData;
  return pageMeta({
    title: `${card.name} · ${card.setName} price · TCG Price Tracker`,
    description: `${card.name} from ${card.gameName} ${card.setName}: market price ${formatPrice(card.priceCents)} (Near Mint), with price history by condition and printing.`,
    origin: loaderData.origin,
    path: `/cards/${card.slug}`,
  });
};

export default function CardPage({ loaderData }: Route.ComponentProps) {
  const { card, selectedId, range, history } = loaderData;
  const selected = card.variants.find((v) => v.id === selectedId);
  const linkTo = (variant: string | null, r: number) => {
    const search = new URLSearchParams();
    if (variant) search.set("variant", variant);
    if (r !== 30) search.set("range", String(r));
    const qs = search.toString();
    return qs ? `?${qs}` : ".";
  };

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Games", to: "/games" },
          { label: card.gameName, to: `/games/${card.gameId}` },
          { label: card.setName, to: `/sets/${card.setId}` },
          { label: card.name },
        ]}
      />
      <div className="mt-4 grid gap-8 md:grid-cols-[220px_1fr]">
        <div className="max-w-[220px]">
          <CardFace name={card.name} number={card.number} />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{card.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {[card.setName, card.number, card.rarity].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-4 text-4xl font-semibold tabular-nums">{formatPrice(card.priceCents)}</p>
          <p className="text-sm text-gray-500">Market price, Near Mint</p>
          <Link
            to={`/app/add?${new URLSearchParams(selectedId ? { card: card.slug, variant: selectedId } : { card: card.slug })}`}
            className="mt-4 inline-block rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
          >
            Add to collection
          </Link>

          <section className="mt-8" aria-labelledby="history-heading">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="history-heading" className="text-lg font-semibold">
                Price history
                {selected && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    {selected.printing} · {selected.condition}
                  </span>
                )}
              </h2>
              <nav aria-label="History range" className="flex gap-1 text-sm">
                {RANGES.map((r) => (
                  <Link
                    key={r}
                    to={linkTo(selectedId, r)}
                    preventScrollReset
                    aria-current={r === range ? "true" : undefined}
                    className="rounded px-2 py-1 aria-[current]:bg-gray-900 aria-[current]:text-white dark:aria-[current]:bg-gray-100 dark:aria-[current]:text-gray-900"
                  >
                    {r === 365 ? "1Y" : `${r}D`}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="mt-3">
              <PriceChart points={history} />
            </div>
          </section>

          <section className="mt-8" aria-labelledby="variants-heading">
            <h2 id="variants-heading" className="text-lg font-semibold">
              Prices by printing and condition
            </h2>
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-gray-500">
                <tr>
                  <th className="py-2 font-medium">Printing</th>
                  <th className="py-2 font-medium">Condition</th>
                  <th className="py-2 text-right font-medium">Price</th>
                  <th className="py-2 text-right font-medium">7 days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {card.variants.map((v) => (
                  <tr
                    key={v.id}
                    aria-selected={v.id === selectedId}
                    className="aria-selected:bg-gray-100 dark:aria-selected:bg-gray-900"
                  >
                    <td className="py-2">
                      <Link to={linkTo(v.id, range)} preventScrollReset className="hover:underline">
                        {v.printing}
                        {v.language !== "English" && (
                          <span className="text-gray-500"> ({v.language})</span>
                        )}
                      </Link>
                    </td>
                    <td className="py-2">{v.condition}</td>
                    <td className="py-2 text-right tabular-nums">{formatPrice(v.priceCents)}</td>
                    <td
                      className={`py-2 text-right tabular-nums ${
                        (v.priceChange7dPct ?? 0) > 0
                          ? "text-green-700 dark:text-green-400"
                          : (v.priceChange7dPct ?? 0) < 0
                            ? "text-red-700 dark:text-red-400"
                            : ""
                      }`}
                    >
                      {formatPercent(v.priceChange7dPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selected?.priceUpdatedAt && (
              <p className="mt-2 text-xs text-gray-500">
                Updated {formatDate(selected.priceUpdatedAt)}
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
