import OpenAI from "openai";
import { env } from "@/lib/env";

let client: OpenAI | null = null;

function openai(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required");
  }
  if (!client) {
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return client;
}

export async function embedText(input: string): Promise<number[]> {
  if (!input || !input.trim()) {
    throw new Error("embedText: input is empty");
  }
  const res = await openai().embeddings.create({
    model: "text-embedding-3-small",
    input,
  });
  return res.data[0].embedding;
}
