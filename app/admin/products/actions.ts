"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { scrapeProductUrl } from "@/lib/scraper";
import { uploadImageFromUrl } from "@/lib/scraper/image";
import { embedSafe } from "@/lib/embeddings";
import { slugify } from "@/lib/slug";

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
  const supabase = adminClient();

  // Mirror image to our Storage if provided
  let imageUrl: string | null = null;
  if (v.image_original_url) {
    try {
      imageUrl = await uploadImageFromUrl(v.image_original_url);
    } catch (e) {
      return { error: `Image upload failed: ${(e as Error).message}` };
    }
  }

  // Generate text embedding (provider-agnostic, non-fatal). If embeddings are
  // disabled ("none") or the provider is unavailable (e.g. no quota), the
  // product is still saved with a null embedding to be backfilled later.
  const embedInput = [v.name, v.description ?? ""].filter(Boolean).join(" — ");
  const { vector: embedding, error: embedError } = await embedSafe(embedInput);
  if (embedError) {
    console.warn(`[registerProduct] embedding skipped: ${embedError}`);
  }

  // Generate slug; ensure uniqueness with a numeric suffix
  const baseSlug = slugify(v.name);
  let slug = baseSlug;
  for (let i = 2; i < 99; i++) {
    const { data } = await supabase.from("products").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = `${baseSlug}-${i}`;
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("products")
    .insert({
      brand_id: v.brand_id,
      tier: v.tier,
      category: v.category,
      slug,
      name: v.name,
      price_amount: v.price_amount ?? null,
      price_currency: v.price_currency,
      source_url: v.source_url || null,
      image_url: imageUrl,
      image_original_url: v.image_original_url || null,
      // pgvector accepts the text format "[0.1,0.2,...]"; the generated column
      // type is `string | null`, so serialize the embedding array.
      embedding: embedding ? JSON.stringify(embedding) : null,
      status: "draft",
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    return { error: `Insert failed: ${insertErr?.message}` };
  }

  // Also write KO translation
  if (v.description) {
    await supabase.from("product_translations").insert({
      product_id: inserted.id,
      locale: "ko",
      name: v.name,
      description: v.description,
    });
  }

  redirect(`/admin/products/${inserted.id}`);
}

export async function prefillFromUrl(url: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Not authenticated");
  return scrapeProductUrl(url);
}
