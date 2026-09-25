/** Catalog prices change at most daily; let the CDN serve them for an hour and refresh in the background. */
export const CATALOG_CACHE = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";
export const SEARCH_CACHE = "public, max-age=60, s-maxage=300, stale-while-revalidate=3600";

export function notFound(message = "Not found"): Response {
  return new Response(message, { status: 404 });
}
