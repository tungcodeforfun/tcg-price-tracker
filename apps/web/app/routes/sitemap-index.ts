import { countCardSitemapPages } from "~/.server/catalog";
import { db } from "~/.server/db";
import { env } from "~/.server/env";
import { CATALOG_CACHE } from "~/lib/http";

export async function loader() {
  const cardPages = await countCardSitemapPages(db);
  const urls = [
    `${env.appUrl}/sitemaps/pages.xml`,
    ...Array.from({ length: cardPages }, (_, i) => `${env.appUrl}/sitemaps/cards-${i + 1}.xml`),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <sitemap><loc>${u}</loc></sitemap>`).join("\n")}
</sitemapindex>`;
  return new Response(body, {
    headers: { "Content-Type": "application/xml", "Cache-Control": CATALOG_CACHE },
  });
}
