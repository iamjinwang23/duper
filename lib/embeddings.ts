import { env } from "@/lib/env";
import { embedText as embedTextOpenAI } from "@/lib/openai";
import { embedTextMiniMax } from "@/lib/minimax";

// All supported providers must return vectors of this dimensionality so they
// stay compatible with the products.embedding column (vector(1536)).
export const EMBEDDING_DIMS = 1536;

export type EmbeddingProvider = "openai" | "minimax" | "none";

export function embeddingProvider(): EmbeddingProvider {
  return env.EMBEDDING_PROVIDER;
}

// Returns a 1536-dim vector, or null when embeddings are disabled ("none").
// Throws if the configured provider is enabled but the call fails.
export async function embed(input: string): Promise<number[] | null> {
  switch (env.EMBEDDING_PROVIDER) {
    case "none":
      return null;
    case "minimax":
      return embedTextMiniMax(input);
    case "openai":
    default:
      return embedTextOpenAI(input);
  }
}

// Never throws: returns the vector (or null) plus an error message when the
// provider failed. Callers like product registration use this so a billing /
// quota / availability problem never hard-blocks the write — the embedding is
// simply left null and can be backfilled later.
export async function embedSafe(
  input: string,
): Promise<{ vector: number[] | null; error: string | null }> {
  try {
    return { vector: await embed(input), error: null };
  } catch (e) {
    return { vector: null, error: (e as Error).message };
  }
}
