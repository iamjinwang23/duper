import { adminClient } from "@/lib/supabase/admin";
import { randomUUID } from "node:crypto";

const BUCKET = "product-images";

export async function uploadImageFromUrl(originalUrl: string): Promise<string> {
  const res = await fetch(originalUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; DupeBot/1.0)" },
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
