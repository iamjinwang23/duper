import { describe, it, expect } from "vitest"
import { buildMatchRows } from "@/lib/matching/rows"

describe("buildMatchRows", () => {
  it("maps picks to published match rows", () => {
    const rows = buildMatchRows("lux-1", [
      { dupeId: "spa-2", rank: 1, score: 0.91, editorNote: "최고" },
      { dupeId: "spa-1", rank: 2, score: 0.7, editorNote: "" },
    ])

    expect(rows).toEqual([
      { lux_id: "lux-1", dupe_id: "spa-2", score: 0.91, editor_note: "최고", rank: 1, status: "published" },
      { lux_id: "lux-1", dupe_id: "spa-1", score: 0.7, editor_note: null, rank: 2, status: "published" },
    ])
  })

  it("returns [] for no picks", () => {
    expect(buildMatchRows("lux-1", [])).toEqual([])
  })
})
