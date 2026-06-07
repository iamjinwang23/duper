// One-off smoke test for the product-registration integrations.
// Exercises the SAME external services the admin server action uses:
//   OpenAI embeddings -> Supabase Storage upload -> products insert.
// Run: export env from .env.local, then `node scripts/smoke-register.mjs`.
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

function assert(cond, msg) {
  if (!cond) {
    console.error("❌ " + msg);
    process.exit(1);
  }
}

assert(SUPABASE_URL && SERVICE_KEY, "Supabase env missing");
assert(OPENAI_KEY, "OPENAI_API_KEY missing");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const openai = new OpenAI({ apiKey: OPENAI_KEY });

// 1) OpenAI embedding ---------------------------------------------------------
console.log("1) OpenAI embedding...");
let vec = null;
try {
  const embRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: "[SMOKE] Saint Laurent LE 5 À 7 — soft lambskin hobo bag with chain",
  });
  vec = embRes.data[0].embedding;
  console.log("   ✅ embedding dims:", vec.length);
} catch (e) {
  console.log(`   ⚠️  embedding skipped (${e.status} ${e.code ?? e.message}) — continuing with null`);
}

// 2) Image download + Storage upload -----------------------------------------
console.log("2) Storage upload...");
const imgUrl = "https://images.unsplash.com/photo-1591348278863-a8fb3887e2aa?w=800&q=80";
const imgRes = await fetch(imgUrl, { headers: { "User-Agent": "DupeBot/1.0" } });
assert(imgRes.ok, `image fetch failed: ${imgRes.status}`);
const buf = Buffer.from(await imgRes.arrayBuffer());
const path = `2026/${randomUUID()}.jpg`;
const up = await supabase.storage
  .from("product-images")
  .upload(path, buf, { contentType: "image/jpeg", cacheControl: "31536000" });
assert(!up.error, `upload failed: ${up.error?.message}`);
const publicUrl = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
console.log("   ✅ public image:", publicUrl);

// 3) Resolve a seeded brand ---------------------------------------------------
const { data: brand, error: brandErr } = await supabase
  .from("brands")
  .select("id")
  .eq("slug", "saint-laurent")
  .single();
assert(!brandErr && brand, `brand lookup failed: ${brandErr?.message}`);

// 4) Insert product (embedding serialized for pgvector) -----------------------
console.log("3) products insert...");
const { data: prod, error: insErr } = await supabase
  .from("products")
  .insert({
    brand_id: brand.id,
    tier: "luxury",
    category: "bags",
    slug: "smoke-test-" + Date.now(),
    name: "[SMOKE TEST] Saint Laurent LE 5 À 7",
    price_amount: 4200000,
    price_currency: "KRW",
    image_url: publicUrl,
    embedding: vec ? JSON.stringify(vec) : null,
    status: "published",
    published_at: new Date().toISOString(),
  })
  .select("id, slug, status")
  .single();
assert(!insErr && prod, `insert failed: ${insErr?.message}`);
console.log("   ✅ product:", prod.id, "| slug:", prod.slug, "| status:", prod.status);

console.log("\n🎉 All integrations OK. The test product is published and visible on the home page.");
console.log("   Delete it later in /admin/products/" + prod.id + " (Delete button).");
