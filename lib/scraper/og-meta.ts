import * as cheerio from "cheerio";

export type ProductMeta = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  priceAmount: number | null;
  priceCurrency: string | null;
};

export function parseProductMeta(html: string): ProductMeta {
  const $ = cheerio.load(html);
  const get = (sel: string) => $(sel).attr("content") ?? null;

  const title =
    get("meta[property='og:title']") ??
    get("meta[name='twitter:title']") ??
    ($("title").text() || null);

  const description =
    get("meta[property='og:description']") ??
    get("meta[name='description']");

  const imageUrl =
    get("meta[property='og:image']") ??
    get("meta[name='twitter:image']");

  const priceRaw =
    get("meta[property='product:price:amount']") ??
    get("meta[property='og:price:amount']");
  const priceAmount = priceRaw ? Number(priceRaw) : null;

  const priceCurrency =
    get("meta[property='product:price:currency']") ??
    get("meta[property='og:price:currency']");

  return {
    title: title ? title.trim() : null,
    description: description ? description.trim() : null,
    imageUrl,
    priceAmount: priceAmount !== null && Number.isFinite(priceAmount) ? priceAmount : null,
    priceCurrency,
  };
}
