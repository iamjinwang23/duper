import { env } from "@/lib/env";

// MiniMax international API. The `embo-01` embedding model returns 1536-dim
// vectors (matching our products.embedding column). NOTE: this provider is
// best-effort and unverified against a live MiniMax account — validate the
// request/response shape before relying on it in production.
const MINIMAX_BASE = "https://api.minimaxi.chat/v1";

export async function embedTextMiniMax(input: string): Promise<number[]> {
  if (!input || !input.trim()) {
    throw new Error("embedText: input is empty");
  }
  if (!env.MINIMAX_API_KEY) {
    throw new Error("MINIMAX_API_KEY is required for the MiniMax embedding provider");
  }
  const url = env.MINIMAX_GROUP_ID
    ? `${MINIMAX_BASE}/embeddings?GroupId=${env.MINIMAX_GROUP_ID}`
    : `${MINIMAX_BASE}/embeddings`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: "embo-01",
      texts: [input],
      // "db" for documents we store; "query" for search-time text.
      type: "db",
    }),
  });

  if (!res.ok) {
    throw new Error(`MiniMax embeddings failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { vectors?: number[][] };
  const vec = json.vectors?.[0];
  if (!Array.isArray(vec)) {
    throw new Error("MiniMax embeddings: unexpected response shape");
  }
  return vec;
}
