import { adminClient } from "@/lib/supabase/admin"
import { findSpaCandidates } from "./candidates"
import { visionRerank } from "./vision-rerank"
import type { MatchSuggestion, SpaCandidate } from "./types"

const FALLBACK_REASON = "유사도 기반 (Vision 미적용)"
const NOT_RANKED_REASON = "유사도 기반 (Vision 후보 외)"

/**
 * Run the full matching pipeline for a luxury product:
 * candidate retrieval -> vision rerank (non-fatal) -> top 5.
 */
export async function runMatchPipeline(luxProductId: string): Promise<MatchSuggestion[]> {
  const supa = adminClient()

  const { data: lux, error } = await supa
    .from("products")
    .select("id, name, image_url, category, tier")
    .eq("id", luxProductId)
    .single()

  if (error) throw new Error(error.message)
  if (!lux) throw new Error("Luxury product not found")
  if (lux.tier !== "luxury") throw new Error("Product is not a luxury item")

  const candidates = await findSpaCandidates(luxProductId, 20)
  if (candidates.length === 0) return []

  // Vision rerank requires the luxury image and candidate images.
  const withImages = candidates.filter((c) => c.imageUrl)
  if (!lux.image_url || withImages.length === 0) {
    return fallback(candidates)
  }

  // Optional KO description enriches the text signal.
  const { data: tr } = await supa
    .from("product_translations")
    .select("description")
    .eq("product_id", luxProductId)
    .eq("locale", "ko")
    .maybeSingle()

  try {
    const ranked = await visionRerank({
      lux: { name: lux.name, description: tr?.description ?? null, imageUrl: lux.image_url },
      candidates: withImages.map((c) => ({ id: c.id, name: c.name, imageUrl: c.imageUrl as string })),
    })
    const byId = new Map(ranked.map((r) => [r.dupeId, r]))

    const merged: MatchSuggestion[] = candidates.map((c) => {
      const r = byId.get(c.id)
      return {
        ...c,
        score: r ? r.score : c.similarity,
        reason: r ? r.reason : NOT_RANKED_REASON,
      }
    })
    // Deliberate mixed-scale sort: vision score and similarity are different
    // signals but share a 0..1 range. The reranker returns only its best picks,
    // so unranked candidates fall back to similarity — the only signal left for
    // them. NOT_RANKED_REASON keeps that provenance visible in the admin UI.
    merged.sort((a, b) => b.score - a.score)
    return merged.slice(0, 5)
  } catch {
    return fallback(candidates)
  }
}

function fallback(candidates: SpaCandidate[]): MatchSuggestion[] {
  return [...candidates]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5)
    .map((c) => ({ ...c, score: c.similarity, reason: FALLBACK_REASON }))
}
