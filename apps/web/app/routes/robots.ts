import { env } from "~/.server/env";

export function loader() {
  const body = [
    "User-agent: *",
    "Disallow: /app",
    "Disallow: /api/",
    "",
    `Sitemap: ${env.appUrl}/sitemap.xml`,
  ].join("\n");
  return new Response(body, {
    headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=86400" },
  });
}
