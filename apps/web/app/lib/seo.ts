import type { MetaDescriptor } from "react-router";

export function pageMeta(opts: {
  title: string;
  description: string;
  origin: string;
  path: string;
}): MetaDescriptor[] {
  const url = `${opts.origin}${opts.path}`;
  return [
    { title: opts.title },
    { name: "description", content: opts.description },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:title", content: opts.title },
    { property: "og:description", content: opts.description },
    { property: "og:url", content: url },
    { property: "og:type", content: "website" },
  ];
}
