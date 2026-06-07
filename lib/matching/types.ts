// SPA candidate returned from the vector-similarity RPC.
export type SpaCandidate = {
  id: string
  name: string
  slug: string
  imageUrl: string | null
  priceAmount: number | null
  priceCurrency: string
  similarity: number // 0..1, higher = closer
}

// One ranked result from the vision reranker.
export type RankedDupe = {
  dupeId: string
  score: number // 0..1, higher = better visual+text match
  reason: string
}

// A candidate enriched with the final score + reason (vision or fallback).
export type MatchSuggestion = SpaCandidate & {
  score: number
  reason: string
}

// An admin-confirmed pick from the suggestions UI.
export type MatchPick = {
  dupeId: string
  rank: number // 1..5
  score: number // carried from the suggestion
  editorNote: string
}

// A row ready for insert/upsert into the `matches` table.
export type MatchRow = {
  lux_id: string
  dupe_id: string
  score: number | null
  editor_note: string | null
  rank: number
  status: "published"
}
