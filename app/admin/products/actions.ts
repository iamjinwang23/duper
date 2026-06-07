"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { scrapeProductUrl } from "@/lib/scraper";
import { uploadImageFromUrlSafe } from "@/lib/scraper/image";
import { insertProductRow } from "@/lib/products/create";

const Schema = z.object({
  source_url: z.string().url().optional().or(z.literal("")),
  brand_id: z.string().uuid(),
  tier: z.enum(["luxury", "spa"]),
  category: z.enum(["bags", "shoes", "outerwear"]),
  name: z.string().min(1),
  description: z.string().optional(),
  price_amount: z.coerce.number().optional(),
  price_currency: z.string().default("KRW"),
  image_original_url: z.string().url().optional().or(z.literal("")),
});

export type RegisterState = { error?: string; ok?: boolean };

export async function registerProduct(
  formData: FormData,
): Promise<RegisterState> {
  const session = await auth();
  if (!session?.user?.email) return { error: "Not authenticated" };

  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", ") };
  }
  const v = parsed.data;

  // Mirror image to our Storage if provided. The form is admin-editable, so the
  // image (and name/price/description below) come from the form fields rather
  // than a re-scrape — this preserves manual entry and admin edits.
  // Non-fatal: a CDN 404 (e.g. COS KR images on image.thehyundai.com) must not
  // block registration — the product is saved with the original URL recorded
  // and the mirrored image backfilled later.
  let imageUrl: string | null = null;
  if (v.image_original_url) {
    const { url, error } = await uploadImageFromUrlSafe(v.image_original_url);
    imageUrl = url;
    if (error) console.warn(`[registerProduct] image mirror skipped: ${error}`);
  }

  // Delegate the embed -> unique slug -> insert -> KO translation core to the
  // shared helper so this stays behavior-identical to the batch scrape path.
  const res = await insertProductRow({
    brandId: v.brand_id,
    tier: v.tier,
    category: v.category,
    name: v.name,
    description: v.description,
    priceAmount: v.price_amount,
    priceCurrency: v.price_currency,
    sourceUrl: v.source_url || null,
    imageUrl,
    imageOriginalUrl: v.image_original_url || null,
  });

  if (!res.ok) {
    return { error: `Insert failed: ${res.error}` };
  }

  redirect(`/admin/products/${res.id}`);
}

export async function prefillFromUrl(url: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Not authenticated");
  return scrapeProductUrl(url);
}
