import { describe, it, expect } from "vitest";
import { parseProductMeta } from "@/lib/scraper/og-meta";

const SAMPLE_HTML = `
<!doctype html>
<html>
  <head>
    <meta property="og:title" content="LE 5 À 7 in smooth leather" />
    <meta property="og:image" content="https://example.com/le5a7.jpg" />
    <meta property="product:price:amount" content="4200000" />
    <meta property="product:price:currency" content="KRW" />
    <meta name="description" content="Soft lambskin hobo bag with chain detail." />
  </head>
  <body></body>
</html>
`;

describe("parseProductMeta", () => {
  it("extracts title, image, price, and description from OG tags", () => {
    const meta = parseProductMeta(SAMPLE_HTML);
    expect(meta.title).toBe("LE 5 À 7 in smooth leather");
    expect(meta.imageUrl).toBe("https://example.com/le5a7.jpg");
    expect(meta.priceAmount).toBe(4200000);
    expect(meta.priceCurrency).toBe("KRW");
    expect(meta.description).toContain("lambskin");
  });

  it("returns nulls when tags are missing", () => {
    const meta = parseProductMeta("<html><head></head><body></body></html>");
    expect(meta.title).toBeNull();
    expect(meta.imageUrl).toBeNull();
    expect(meta.priceAmount).toBeNull();
  });
});
