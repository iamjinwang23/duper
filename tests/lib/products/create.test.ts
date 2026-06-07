import { describe, it, expect, vi, beforeEach } from "vitest";

const insert = vi.fn();
const trInsert = vi.fn();
const maybeSingle = vi.fn();
const from = vi.fn((table: string) => {
  if (table === "product_translations") return { insert: trInsert };
  return {
    insert: (...a: unknown[]) => insert(...a),
    select: () => ({ eq: () => ({ maybeSingle }) }),
  };
});
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => ({ from }) }));

const scrapeProductUrl = vi.fn();
vi.mock("@/lib/scraper", () => ({ scrapeProductUrl: (...a: unknown[]) => scrapeProductUrl(...a) }));
const uploadImageFromUrlSafe = vi.fn();
vi.mock("@/lib/scraper/image", () => ({
  uploadImageFromUrlSafe: (...a: unknown[]) => uploadImageFromUrlSafe(...a),
}));
const embedSafe = vi.fn();
vi.mock("@/lib/embeddings", () => ({ embedSafe: (...a: unknown[]) => embedSafe(...a) }));

import { createProductFromScrape } from "@/lib/products/create";

describe("createProductFromScrape", () => {
  beforeEach(() => {
    insert.mockReset();
    trInsert.mockReset();
    maybeSingle.mockReset();
    scrapeProductUrl.mockReset();
    uploadImageFromUrlSafe.mockReset();
    embedSafe.mockReset();
    maybeSingle.mockResolvedValue({ data: null, error: null }); // slug is unique
    // registerProduct uses .insert(...).select("id").single()
    insert.mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: { id: "p-1" }, error: null }) }),
    });
    trInsert.mockResolvedValue({ error: null });
    scrapeProductUrl.mockResolvedValue({
      title: "COS Leather Bag",
      description: "A clean leather bag",
      imageUrl: "https://src/cos.jpg",
      priceAmount: 159000,
      priceCurrency: "KRW",
      sourceUrl: "https://cos.com/bag",
    });
    uploadImageFromUrlSafe.mockResolvedValue({ url: "https://storage/cos.jpg", error: null });
    embedSafe.mockResolvedValue({ vector: new Array(1536).fill(0.1), error: null });
  });

  it("scrapes, uploads image, embeds, inserts product + KO translation", async () => {
    const result = await createProductFromScrape({
      url: "https://cos.com/bag",
      brandId: "brand-cos",
      tier: "spa",
      category: "bags",
    });
    expect(result.ok).toBe(true);
    expect(uploadImageFromUrlSafe).toHaveBeenCalledWith("https://src/cos.jpg");
    expect(embedSafe).toHaveBeenCalled();
    const inserted = insert.mock.calls[0][0];
    expect(inserted).toMatchObject({
      brand_id: "brand-cos",
      tier: "spa",
      category: "bags",
      name: "COS Leather Bag",
      image_url: "https://storage/cos.jpg",
      source_url: "https://cos.com/bag",
      status: "draft",
    });
    expect(trInsert).toHaveBeenCalled();
  });

  it("returns an error result when scraping fails (does not throw)", async () => {
    scrapeProductUrl.mockRejectedValue(new Error("404"));
    const result = await createProductFromScrape({
      url: "https://cos.com/missing",
      brandId: "brand-cos",
      tier: "spa",
      category: "bags",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("404");
  });

  it("skips image upload and stores null image_url when the scrape has no image", async () => {
    scrapeProductUrl.mockResolvedValue({
      title: "No Image Bag",
      description: "desc",
      imageUrl: null,
      priceAmount: null,
      priceCurrency: null,
      sourceUrl: "https://cos.com/no-image",
    });

    const result = await createProductFromScrape({
      url: "https://cos.com/no-image",
      brandId: "brand-cos",
      tier: "spa",
      category: "bags",
    });

    expect(result.ok).toBe(true);
    expect(uploadImageFromUrlSafe).not.toHaveBeenCalled();
    const inserted = insert.mock.calls[0][0];
    expect(inserted.image_url).toBeNull();
    expect(inserted.image_original_url).toBeNull();
    expect(inserted.price_currency).toBe("KRW"); // defaulted
  });

  it("is non-fatal when image mirroring fails: saves product with null image_url but keeps original URL", async () => {
    // e.g. COS KR image on image.thehyundai.com returns 404
    uploadImageFromUrlSafe.mockResolvedValue({ url: null, error: "Image fetch failed: 404" });

    const result = await createProductFromScrape({
      url: "https://www.cos.com/ko-kr/bag",
      brandId: "brand-cos",
      tier: "spa",
      category: "bags",
    });

    expect(result.ok).toBe(true); // product still saved
    const inserted = insert.mock.calls[0][0];
    expect(inserted.image_url).toBeNull(); // mirror skipped
    expect(inserted.image_original_url).toBe("https://src/cos.jpg"); // provenance kept
    expect(trInsert).toHaveBeenCalled();
  });

  it("returns an error result (does not throw) when the product insert fails", async () => {
    insert.mockReturnValue({
      select: () => ({
        single: () => Promise.resolve({ data: null, error: { message: "duplicate slug" } }),
      }),
    });

    const result = await createProductFromScrape({
      url: "https://cos.com/bag",
      brandId: "brand-cos",
      tier: "spa",
      category: "bags",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("duplicate slug");
    expect(trInsert).not.toHaveBeenCalled(); // no translation when insert fails
  });
});
