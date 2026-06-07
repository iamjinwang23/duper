import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("openai", () => ({
  default: class {
    embeddings = { create };
  },
}));

beforeEach(() => create.mockReset());

describe("embedText", () => {
  it("returns a 1536-length vector from the API response", async () => {
    create.mockResolvedValue({ data: [{ embedding: new Array(1536).fill(0.5) }] });
    const { embedText } = await import("@/lib/openai");
    const vec = await embedText("LE 5 À 7 — soft lambskin hobo");
    expect(vec).toHaveLength(1536);
    expect(vec[0]).toBe(0.5);
    expect(create).toHaveBeenCalledWith({
      model: "text-embedding-3-small",
      input: "LE 5 À 7 — soft lambskin hobo",
    });
  });

  it("throws when input is empty", async () => {
    const { embedText } = await import("@/lib/openai");
    await expect(embedText("")).rejects.toThrow("empty");
  });
});
