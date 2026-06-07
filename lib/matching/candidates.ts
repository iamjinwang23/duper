import { adminClient } from "@/lib/supabase/admin"
import type { SpaCandidate } from "./types"

/**
 * Retrieve same-category SPA products nearest to the given luxury product
 * by cosine similarity (via the match_spa_candidates_for RPC).
 */
export async function findSpaCandidates(
  luxProductId: string,
  limit = 20,
): Promise<SpaCandidate[]> {
  const { data, error } = await adminClient().rpc("match_spa_candidates_for", {
    lux_id: luxProductId,
    match_limit: limit,
  })

  if (error) throw new Error(error.message)
  if (!data) return []

  return (data as RpcRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    imageUrl: row.image_url,
    priceAmount: row.price_amount,
    priceCurrency: row.price_currency,
    similarity: row.similarity,
  }))
}

// Hand-written instead of the generated Functions["match_spa_candidates_for"]
// Returns type: Supabase type-gen emits `returns table(...)` columns as
// non-null, but image_url/price_amount come straight from products where they
// are nullable. Keep this so a future "use the generated type" refactor doesn't
// silently drop that nullability.
type RpcRow = {
  id: string
  name: string
  slug: string
  image_url: string | null
  price_amount: number | null
  price_currency: string
  similarity: number
}
