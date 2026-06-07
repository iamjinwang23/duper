"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { scrapeProductUrl } from "@/lib/scraper";
import { uploadImageFromUrl } from "@/lib/scraper/image";
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
  let imageUrl: string | null = null;
  if (v.image_original_url) {
    try {
      imageUrl = await uploadImageFromUrl(v.image_original_url);
    } catch (e) {
      return { error: `Image upload failed: ${(e as Error).message}` };
    }
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
