import { describe, it, expect, vi, beforeEach } from "vitest";

// Default provider in the test env is "openai" (EMBEDDING_PROVIDER unset).
const embedTextMock = vi.fn();
vi.mock("@/lib/openai", () => ({ embedText: embedTextMock }));
vi.mock("@/lib/minimax", () => ({ embedTextMiniMax: vi.fn() }));

beforeEach(() => embedTextMock.mockReset());

describe("embeddings dispatcher (provider=openai)", () => {
  it("embed returns the provider's vector on success", async () => {
    embedTextMock.mockResolvedValue(new Array(1536).fill(0.1));
    const { embed } = await import("@/lib/embeddings");
    const vec = await embed("hello world");
    expect(vec).toHaveLength(1536);
  });

  it("embed delegates to the configured provider with the raw input", async () => {
    embedTextMock.mockResolvedValue(new Array(1536).fill(0));
    const { embed } = await import("@/lib/embeddings");
    await embed("café crème");
    expect(embedTextMock).toHaveBeenCalledWith("café crème");
  });

  it("embedSafe wraps a success as { vector, error: null }", async () => {
    embedTextMock.mockResolvedValue(new Array(1536).fill(0.2));
    const { embedSafe } = await import("@/lib/embeddings");
    const { vector, error } = await embedSafe("hello world");
    expect(error).toBeNull();
    expect(vector).toHaveLength(1536);
  });
});
