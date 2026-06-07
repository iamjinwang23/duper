import { parseProductMeta, type ProductMeta } from "./og-meta";

export type ScrapeResult = ProductMeta & { sourceUrl: string };

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** Plain fetch — works for SSR sites that ship OG tags (most luxury houses). */
async function fetchHtmlDirect(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,ko;q=0.8",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

/**
 * Firecrawl renders JS and bypasses bot protection (Akamai/PerimeterX), then
 * returns the fully-rendered raw HTML — which we feed to the same OG parser.
 * Required for SPA / bot-protected retailers like Zara and COS, where a plain
 * fetch returns a 403 or an empty JS shell with no product meta.
 */
async function fetchHtmlFirecrawl(url: string): Promise<string> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY is not set");
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    // rawHtml keeps the <head>/<meta> + JSON-LD the parser needs; onlyMainContent
    // would strip them. waitFor lets JS-heavy SPAs (COS KR) inject their product
    // JSON-LD before Firecrawl snapshots the HTML.
    body: JSON.stringify({ url, formats: ["rawHtml"], onlyMainContent: false, waitFor: 2500 }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const detail = json?.error ?? `HTTP ${res.status}`;
    throw new Error(`Firecrawl failed for ${url}: ${detail}`);
  }
  const html = json?.data?.rawHtml as string | undefined;
  if (!html) throw new Error(`Firecrawl returned no HTML for ${url}`);
  return html;
}

export async function scrapeProductUrl(url: string): Promise<ScrapeResult> {
  const hasFirecrawl = Boolean(process.env.FIRECRAWL_API_KEY);

  // Try a cheap direct fetch first: it succeeds for SSR sites with OG tags and
  // avoids spending Firecrawl credits.
  try {
    const directMeta = parseProductMeta(await fetchHtmlDirect(url));
    // Usable result, or no fallback configured → return what we got.
    if (directMeta.title || !hasFirecrawl) {
      return { ...directMeta, sourceUrl: url };
    }
  } catch (e) {
    if (!hasFirecrawl) throw e; // no fallback available — surface the real error
  }

  // Direct fetch was blocked (403) or returned a JS shell with no OG tags.
  // Fall back to Firecrawl's rendered HTML and parse it the same way.
  const meta = parseProductMeta(await fetchHtmlFirecrawl(url));
  return { ...meta, sourceUrl: url };
}
