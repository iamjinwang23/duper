import { adminClient } from "@/lib/supabase/admin";
import { randomUUID } from "node:crypto";

const BUCKET = "product-images";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function uploadImageFromUrl(originalUrl: string): Promise<string> {
  // Some retailer CDNs (e.g. image.thehyundai.com, which hosts COS KR images)
  // reject non-browser agents or hotlinks without a same-origin Referer.
  const origin = (() => {
    try {
      return new URL(originalUrl).origin;
    } catch {
      return undefined;
    }
  })();
  const res = await fetch(originalUrl, {
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,ko;q=0.8",
      ...(origin ? { Referer: `${origin}/` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Image fetch failed: ${res.status}`);
  }
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const buf = Buffer.from(await res.arrayBuffer());

  const path = `${new Date().getFullYear()}/${randomUUID()}.${ext}`;
  const supabase = adminClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Non-fatal variant: mirror an image but never throw. On failure (e.g. a 404
 * from a region-specific CDN) the product is still saved with the original URL
 * recorded for provenance and the image backfilled later — mirroring the
 * provider-agnostic, non-fatal embedding layer (embedSafe).
 */
export async function uploadImageFromUrlSafe(
  originalUrl: string,
): Promise<{ url: string | null; error: string | null }> {
  try {
    return { url: await uploadImageFromUrl(originalUrl), error: null };
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : String(e) };
  }
}
