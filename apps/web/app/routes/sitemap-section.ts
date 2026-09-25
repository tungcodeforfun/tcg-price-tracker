import { listCardPaths, listGameAndSetPaths, type SitemapEntry } from "~/.server/catalog";
import { db } from "~/.server/db";
import { env } from "~/.server/env";
import { CATALOG_CACHE, notFound } from "~/lib/http";
import type { Route } from "./+types/sitemap-section";

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function urlset(entries: SitemapEntry[]): string {
  const rows = entries.map((e) => {
    const lastmod = e.lastModified
      ? `<lastmod>${e.lastModified.toISOString().slice(0, 10)}</lastmod>`
      : "";
    return `  <url><loc>${escapeXml(env.appUrl + e.path)}</loc>${lastmod}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows.join("\n")}
</urlset>`;
}

export async function loader({ params }: Route.LoaderArgs) {
  let entries: SitemapEntry[];
  if (params.section === "pages") {
    entries = [
      { path: "/", lastModified: null },
      { path: "/games", lastModified: null },
      ...(await listGameAndSetPaths(db)),
    ];
  } else {
    const page = /^cards-([1-9]\d*)$/.exec(params.section)?.[1];
    if (!page) throw notFound();
    entries = await listCardPaths(db, Number(page) - 1);
    if (entries.length === 0) throw notFound();
  }
  return new Response(urlset(entries), {
    headers: { "Content-Type": "application/xml", "Cache-Control": CATALOG_CACHE },
  });
}
