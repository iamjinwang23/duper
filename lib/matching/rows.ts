import type { MatchPick, MatchRow } from "./types"

/** Convert admin-confirmed picks into rows for the `matches` table. */
export function buildMatchRows(luxId: string, picks: MatchPick[]): MatchRow[] {
  return picks.map((p) => ({
    lux_id: luxId,
    dupe_id: p.dupeId,
    score: p.score,
    editor_note: p.editorNote.trim() === "" ? null : p.editorNote.trim(),
    rank: p.rank,
    status: "published" as const,
  }))
}
