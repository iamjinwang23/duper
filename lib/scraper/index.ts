import { parseProductMeta, type ProductMeta } from "./og-meta";

export type ScrapeResult = ProductMeta & { sourceUrl: string };

export async function scrapeProductUrl(url: string): Promise<ScrapeResult> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; DupeBot/1.0; +https://dupe.kr)",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  const html = await res.text();
  const meta = parseProductMeta(html);
  return { ...meta, sourceUrl: url };
}
