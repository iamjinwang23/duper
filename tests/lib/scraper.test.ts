import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseProductMeta } from "@/lib/scraper/og-meta";
import { scrapeProductUrl } from "@/lib/scraper";

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

  it("falls back to JSON-LD for image/name/price when og:image is a placeholder logo (COS KR)", () => {
    // COS KR ships a broken logo as og:image; the real data is in JSON-LD.
    const html = `
      <html><head>
        <meta property="og:image" content="https://image.thehyundai.com/images/cos/cos-rebrand-logo-meta-image.jpg" />
        <title>COS - 공식 온라인 스토어</title>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Product",
         "name":"테크니컬 후드 파카 재킷",
         "description":"발수 가공 파카",
         "image":["https://image.thehyundai.com/0/6/0/25/A2/hnm40A2250601_1.jpg"],
         "offers":{"@type":"Offer","price":"220000","priceCurrency":"KRW"}}
        </script>
      </head><body></body></html>`;
    const meta = parseProductMeta(html);
    expect(meta.imageUrl).toBe("https://image.thehyundai.com/0/6/0/25/A2/hnm40A2250601_1.jpg");
    expect(meta.title).toBe("테크니컬 후드 파카 재킷"); // og:title absent → JSON-LD name
    expect(meta.priceAmount).toBe(220000);
    expect(meta.priceCurrency).toBe("KRW");
  });

  it("reads a Product node out of a JSON-LD @graph array", () => {
    const html = `
      <html><head><script type="application/ld+json">
      {"@graph":[
        {"@type":"WebSite","name":"COS"},
        {"@type":"Product","name":"Wool Coat","image":"https://cdn/x_1.jpg",
         "offers":[{"@type":"Offer","price":"329","priceCurrency":"USD"}]}
      ]}
      </script></head><body></body></html>`;
    const meta = parseProductMeta(html);
    expect(meta.title).toBe("Wool Coat");
    expect(meta.imageUrl).toBe("https://cdn/x_1.jpg");
    expect(meta.priceAmount).toBe(329);
  });

  it("prefers a real og:image over JSON-LD and ignores malformed JSON-LD", () => {
    const html = `
      <html><head>
        <meta property="og:image" content="https://cdn/real-product.jpg" />
        <meta property="og:title" content="Real Title" />
        <script type="application/ld+json">{ not valid json }</script>
      </head><body></body></html>`;
    const meta = parseProductMeta(html);
    expect(meta.imageUrl).toBe("https://cdn/real-product.jpg");
    expect(meta.title).toBe("Real Title");
  });
});

const EMPTY_SHELL = "<html><head></head><body><div id='app'></div></body></html>";

function htmlResponse(html: string, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => html };
}
function firecrawlResponse(html: string) {
  return { ok: true, status: 200, json: async () => ({ success: true, data: { rawHtml: html } }) };
}
const isFirecrawl = (input: unknown) => String(input).includes("api.firecrawl.dev");

describe("scrapeProductUrl", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    delete process.env.FIRECRAWL_API_KEY;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the cheap direct fetch when it yields OG tags, skipping Firecrawl", async () => {
    process.env.FIRECRAWL_API_KEY = "fc-test";
    fetchMock.mockImplementation(async () => htmlResponse(SAMPLE_HTML));

    const meta = await scrapeProductUrl("https://www.ysl.com/product");

    expect(meta.title).toBe("LE 5 À 7 in smooth leather");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(isFirecrawl(fetchMock.mock.calls[0][0])).toBe(false);
  });

  it("falls back to Firecrawl when the direct fetch is blocked (403)", async () => {
    process.env.FIRECRAWL_API_KEY = "fc-test";
    fetchMock.mockImplementation(async (input: unknown) =>
      isFirecrawl(input) ? firecrawlResponse(SAMPLE_HTML) : htmlResponse("", 403),
    );

    const meta = await scrapeProductUrl("https://www.cos.com/product");

    expect(meta.title).toBe("LE 5 À 7 in smooth leather");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(isFirecrawl(fetchMock.mock.calls[1][0])).toBe(true);
  });

  it("falls back to Firecrawl when the direct fetch returns a JS shell with no OG tags", async () => {
    process.env.FIRECRAWL_API_KEY = "fc-test";
    fetchMock.mockImplementation(async (input: unknown) =>
      isFirecrawl(input) ? firecrawlResponse(SAMPLE_HTML) : htmlResponse(EMPTY_SHELL),
    );

    const meta = await scrapeProductUrl("https://www.zara.com/product");

    expect(meta.title).toBe("LE 5 À 7 in smooth leather");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws the original error when blocked and no Firecrawl key is configured", async () => {
    fetchMock.mockImplementation(async () => htmlResponse("", 403));

    await expect(scrapeProductUrl("https://www.cos.com/product")).rejects.toThrow("403");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
