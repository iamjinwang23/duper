import { adminClient } from "@/lib/supabase/admin";
import { scrapeProductUrl } from "@/lib/scraper";
import { uploadImageFromUrl } from "@/lib/scraper/image";
import { embedSafe } from "@/lib/embeddings";
import { slugify } from "@/lib/slug";

export type CreateProductInput = {
  url: string;
  brandId: string;
  tier: "luxury" | "spa";
  category: "bags" | "shoes" | "outerwear";
};

export type CreateProductResult =
  | { ok: true; id: string; name: string }
  | { ok: false; error: string; url: string };

/** Fully-resolved fields for a product row insert (post-scrape / post-form). */
export type ProductRowInput = {
  brandId: string;
  tier: "luxury" | "spa";
  category: "bags" | "shoes" | "outerwear";
  name: string;
  description?: string | null;
  priceAmount?: number | null;
  priceCurrency?: string | null;
  sourceUrl?: string | null;
  /** Already-mirrored Storage URL (uploadImageFromUrl result), or null. */
  imageUrl?: string | null;
  /** Original remote image URL recorded for provenance, or null. */
  imageOriginalUrl?: string | null;
};

export type InsertProductResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Shared core: embed -> ensure unique slug -> insert product (status 'draft')
 * -> insert KO translation. Used by both the URL-driven scrape path
 * (createProductFromScrape) and the form-driven single registration so the row
 * shape, embedding serialization and slug strategy stay identical.
 */
export async function insertProductRow(row: ProductRowInput): Promise<InsertProductResult> {
  const supabase = adminClient();

  // Provider-agnostic, non-fatal embedding: on failure the product is still
  // saved with a null embedding to be backfilled later.
  const embedInput = [row.name, row.description ?? ""].filter(Boolean).join(" — ");
  const { vector: embedding, error: embedError } = await embedSafe(embedInput);
  if (embedError) {
    console.warn(`[insertProductRow] embedding skipped: ${embedError}`);
  }

  // Generate slug; ensure uniqueness with a numeric suffix.
  const baseSlug = slugify(row.name);
  let slug = baseSlug;
  for (let i = 2; i < 99; i++) {
    const { data } = await supabase.from("products").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = `${baseSlug}-${i}`;
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("products")
    .insert({
      brand_id: row.brandId,
      tier: row.tier,
      category: row.category,
      slug,
      name: row.name,
      price_amount: row.priceAmount ?? null,
      // KR-targeted catalog: default currency to KRW when a scrape/form omits it
      // (the form path already supplies "KRW" via its zod default).
      price_currency: row.priceCurrency ?? "KRW",
      source_url: row.sourceUrl ?? null,
      image_url: row.imageUrl ?? null,
      image_original_url: row.imageOriginalUrl ?? null,
      // pgvector accepts the text format "[0.1,0.2,...]"; serialize the array.
      embedding: embedding ? JSON.stringify(embedding) : null,
      status: "draft",
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    return { ok: false, error: insertErr?.message ?? "Insert failed" };
  }

  // Also write KO translation when a description is available.
  if (row.description) {
    await supabase.from("product_translations").insert({
      product_id: inserted.id,
      locale: "ko",
      name: row.name,
      description: row.description,
    });
  }

  return { ok: true, id: inserted.id };
}

/**
 * Shared scrape -> (image upload) -> embed -> insert product (status 'draft')
 * -> insert KO translation pipeline. Behavior-identical to the URL-driven core
 * of registerProduct, but NON-throwing: failures are returned as a result so a
 * batch run can continue past individual errors.
 */
export async function createProductFromScrape(
  input: CreateProductInput,
): Promise<CreateProductResult> {
  try {
    const meta = await scrapeProductUrl(input.url);
    const name = meta.title?.trim();
    if (!name) return { ok: false, error: "상품명을 추출하지 못했습니다.", url: input.url };

    // Mirror image to our Storage if the scrape found one.
    const imageUrl = meta.imageUrl ? await uploadImageFromUrl(meta.imageUrl) : null;

    const res = await insertProductRow({
      brandId: input.brandId,
      tier: input.tier,
      category: input.category,
      name,
      description: meta.description,
      priceAmount: meta.priceAmount,
      priceCurrency: meta.priceCurrency,
      sourceUrl: meta.sourceUrl,
      imageUrl,
      imageOriginalUrl: meta.imageUrl,
    });
    if (!res.ok) return { ok: false, error: res.error, url: input.url };

    return { ok: true, id: res.id, name };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), url: input.url };
  }
}
