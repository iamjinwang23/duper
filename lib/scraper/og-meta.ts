import * as cheerio from "cheerio";

export type ProductMeta = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  priceAmount: number | null;
  priceCurrency: string | null;
};

/** og:image values that are site chrome (logos/placeholders), not the product. */
const PLACEHOLDER_IMAGE = /logo|meta-image|placeholder|default/i;

function cleanImage(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed || PLACEHOLDER_IMAGE.test(trimmed)) return null;
  return trimmed;
}

/** Pull the first usable image URL out of a JSON-LD `image` value. */
function imageFromLd(image: unknown): string | null {
  if (!image) return null;
  if (typeof image === "string") return cleanImage(image);
  if (Array.isArray(image)) {
    for (const item of image) {
      const found = imageFromLd(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof image === "object") {
    return cleanImage((image as { url?: string }).url);
  }
  return null;
}

/** Pull amount + currency out of a JSON-LD `offers` value. */
function offerFromLd(offers: unknown): { amount: number | null; currency: string | null } {
  const pick = (o: Record<string, unknown>) => {
    const raw = o.price ?? o.lowPrice ?? (o.priceSpecification as Record<string, unknown>)?.price;
    const amount = raw != null ? Number(raw) : null;
    const currency =
      (o.priceCurrency as string) ??
      ((o.priceSpecification as Record<string, unknown>)?.priceCurrency as string) ??
      null;
    return { amount: amount != null && Number.isFinite(amount) ? amount : null, currency };
  };
  if (Array.isArray(offers)) {
    for (const o of offers) {
      if (o && typeof o === "object") {
        const r = pick(o as Record<string, unknown>);
        if (r.amount != null) return r;
      }
    }
    return { amount: null, currency: null };
  }
  if (offers && typeof offers === "object") return pick(offers as Record<string, unknown>);
  return { amount: null, currency: null };
}

type LdProduct = {
  name: string | null;
  description: string | null;
  image: string | null;
  priceAmount: number | null;
  priceCurrency: string | null;
};

/**
 * Walk every <script type="application/ld+json"> block and return the first
 * Product node. Sites like COS KR (run by Hyundai) put the real product image,
 * name and price here while og:image is just a broken logo placeholder.
 */
function parseJsonLd($: cheerio.CheerioAPI): LdProduct | null {
  const isProduct = (node: unknown): node is Record<string, unknown> => {
    if (!node || typeof node !== "object") return false;
    const t = (node as Record<string, unknown>)["@type"];
    return Array.isArray(t) ? t.includes("Product") : t === "Product";
  };

  const scripts = $('script[type="application/ld+json"]').toArray();
  for (const el of scripts) {
    const raw = $(el).contents().text();
    if (!raw.trim()) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue; // malformed block — skip, don't fail the whole scrape
    }
    // Flatten the shapes JSON-LD comes in: single node, array, or @graph.
    const candidates: unknown[] = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>)["@graph"])
        ? ((parsed as Record<string, unknown>)["@graph"] as unknown[])
        : [parsed];

    const product = candidates.find(isProduct);
    if (product) {
      const offer = offerFromLd(product.offers);
      return {
        name: typeof product.name === "string" ? product.name.trim() : null,
        description: typeof product.description === "string" ? product.description.trim() : null,
        image: imageFromLd(product.image),
        priceAmount: offer.amount,
        priceCurrency: offer.currency,
      };
    }
  }
  return null;
}

export function parseProductMeta(html: string): ProductMeta {
  const $ = cheerio.load(html);
  const get = (sel: string) => $(sel).attr("content") ?? null;

  const ld = parseJsonLd($);

  const title =
    get("meta[property='og:title']") ??
    get("meta[name='twitter:title']") ??
    ld?.name ??
    ($("title").text() || null);

  const description =
    get("meta[property='og:description']") ??
    get("meta[name='description']") ??
    ld?.description;

  // Prefer og:image, but fall back to JSON-LD when og:image is missing or is a
  // logo/placeholder (e.g. COS KR ships a broken logo as og:image).
  const imageUrl =
    cleanImage(get("meta[property='og:image']")) ??
    cleanImage(get("meta[name='twitter:image']")) ??
    ld?.image ??
    null;

  const priceRaw =
    get("meta[property='product:price:amount']") ??
    get("meta[property='og:price:amount']");
  const priceFromMeta = priceRaw ? Number(priceRaw) : null;
  const priceAmount =
    priceFromMeta !== null && Number.isFinite(priceFromMeta) ? priceFromMeta : ld?.priceAmount ?? null;

  const priceCurrency =
    get("meta[property='product:price:currency']") ??
    get("meta[property='og:price:currency']") ??
    ld?.priceCurrency ??
    null;

  return {
    title: title ? title.trim() : null,
    description: description ? description.trim() : null,
    imageUrl,
    priceAmount,
    priceCurrency,
  };
}
