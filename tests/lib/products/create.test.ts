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
const uploadImageFromUrl = vi.fn();
vi.mock("@/lib/scraper/image", () => ({ uploadImageFromUrl: (...a: unknown[]) => uploadImageFromUrl(...a) }));
const embedSafe = vi.fn();
vi.mock("@/lib/embeddings", () => ({ embedSafe: (...a: unknown[]) => embedSafe(...a) }));

import { createProductFromScrape } from "@/lib/products/create";

describe("createProductFromScrape", () => {
  beforeEach(() => {
    insert.mockReset();
    trInsert.mockReset();
    maybeSingle.mockReset();
    scrapeProductUrl.mockReset();
    uploadImageFromUrl.mockReset();
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
    uploadImageFromUrl.mockResolvedValue("https://storage/cos.jpg");
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
    expect(uploadImageFromUrl).toHaveBeenCalledWith("https://src/cos.jpg");
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
    expect(uploadImageFromUrl).not.toHaveBeenCalled();
    const inserted = insert.mock.calls[0][0];
    expect(inserted.image_url).toBeNull();
    expect(inserted.image_original_url).toBeNull();
    expect(inserted.price_currency).toBe("KRW"); // defaulted
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
