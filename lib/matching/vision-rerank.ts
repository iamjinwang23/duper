import OpenAI from "openai"
import { env } from "@/lib/env"
import type { RankedDupe } from "./types"

export type RerankInput = {
  lux: { name: string; description: string | null; imageUrl: string }
  candidates: { id: string; name: string; imageUrl: string }[]
}

const SYSTEM_PROMPT = [
  "You are a fashion dupe-matching expert.",
  "Given a luxury product and several SPA (fast-fashion) candidates,",
  "judge how visually similar each candidate is to the luxury item.",
  "Weight visual similarity (silhouette, shape, hardware, material) 0.7 and",
  "name/description 0.3. Return STRICT JSON of the form",
  '{"results":[{"dupeId":"<id>","score":<0..1>,"reason":"<short Korean reason>"}]}',
  "ranked best-first, at most the top 5. Use only the candidate ids provided.",
].join(" ")

/**
 * Rerank SPA candidates against a luxury product using GPT-4o-mini vision.
 * Throws on empty candidates or API failure — the pipeline wraps this in a
 * non-fatal fallback.
 */
export async function visionRerank(input: RerankInput): Promise<RankedDupe[]> {
  if (input.candidates.length === 0) {
    throw new Error("visionRerank: no candidates")
  }

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY })

  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    {
      type: "text",
      text: `LUXURY: ${input.lux.name}${input.lux.description ? ` — ${input.lux.description}` : ""}`,
    },
    { type: "image_url", image_url: { url: input.lux.imageUrl } },
    { type: "text", text: "CANDIDATES (id · name, then image):" },
  ]
  for (const c of input.candidates) {
    content.push({ type: "text", text: `${c.id} · ${c.name}` })
    content.push({ type: "image_url", image_url: { url: c.imageUrl } })
  }
  content.push({
    type: "text",
    text: "Return the top 5 dupes as JSON per the system instructions.",
  })

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content },
    ],
  })

  const raw = res.choices[0]?.message?.content
  if (!raw) throw new Error("visionRerank: empty model response")

  let parsed: { results?: unknown }
  try {
    parsed = JSON.parse(raw) as { results?: unknown }
  } catch {
    // Keep the error contract uniform with the other throws here; the pipeline
    // (Task 5) wraps visionRerank in a non-fatal try/catch fallback.
    throw new Error("visionRerank: model returned non-JSON content")
  }
  const validIds = new Set(input.candidates.map((c) => c.id))
  const results = Array.isArray(parsed.results) ? parsed.results : []

  return results
    .map((r) => r as { dupeId?: unknown; score?: unknown; reason?: unknown })
    .filter((r) => typeof r.dupeId === "string" && validIds.has(r.dupeId))
    .map((r) => ({
      dupeId: r.dupeId as string,
      score: clamp01(Number(r.score)),
      reason: typeof r.reason === "string" ? r.reason : "",
    }))
    .slice(0, 5)
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(1, n))
}
