import { describe, it, expect, vi, beforeEach } from "vitest"
import type { SpaCandidate } from "@/lib/matching/types"

const findSpaCandidates = vi.fn()
const visionRerank = vi.fn()

vi.mock("@/lib/matching/candidates", () => ({ findSpaCandidates: (...a: unknown[]) => findSpaCandidates(...a) }))
vi.mock("@/lib/matching/vision-rerank", () => ({ visionRerank: (...a: unknown[]) => visionRerank(...a) }))

// Minimal adminClient mock: products.select.eq.single returns the lux row;
// product_translations path returns no description.
const single = vi.fn()
const maybeSingle = vi.fn()
vi.mock("@/lib/supabase/admin", () => ({
  adminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single,
          eq: () => ({ maybeSingle }),
        }),
      }),
    }),
  }),
}))

import { runMatchPipeline } from "@/lib/matching/pipeline"

const luxRow = {
  id: "lux-1",
  name: "Saint Laurent LE 5 A 7",
  image_url: "https://img/lux.jpg",
  category: "bags",
  tier: "luxury",
}

const cands: SpaCandidate[] = [
  { id: "spa-1", name: "COS Bag", slug: "cos-bag", imageUrl: "https://img/c1.jpg", priceAmount: 159000, priceCurrency: "KRW", similarity: 0.6 },
  { id: "spa-2", name: "Zara Bag", slug: "zara-bag", imageUrl: "https://img/c2.jpg", priceAmount: 49000, priceCurrency: "KRW", similarity: 0.5 },
]

describe("runMatchPipeline", () => {
  beforeEach(() => {
    findSpaCandidates.mockReset()
    visionRerank.mockReset()
    single.mockReset()
    maybeSingle.mockReset()
    single.mockResolvedValue({ data: luxRow, error: null })
    maybeSingle.mockResolvedValue({ data: null, error: null })
  })

  it("reorders candidates by vision score and returns top 5", async () => {
    findSpaCandidates.mockResolvedValue(cands)
    visionRerank.mockResolvedValue([
      { dupeId: "spa-2", score: 0.9, reason: "닮음" },
      { dupeId: "spa-1", score: 0.4, reason: "약간" },
    ])

    const result = await runMatchPipeline("lux-1")

    expect(result.map((r) => r.id)).toEqual(["spa-2", "spa-1"])
    expect(result[0].score).toBe(0.9)
    expect(result[0].reason).toBe("닮음")
  })

  it("falls back to similarity ordering when vision throws", async () => {
    findSpaCandidates.mockResolvedValue(cands)
    visionRerank.mockRejectedValue(new Error("no key"))

    const result = await runMatchPipeline("lux-1")

    expect(result.map((r) => r.id)).toEqual(["spa-1", "spa-2"]) // by similarity desc
    expect(result[0].score).toBe(0.6)
    expect(result[0].reason).toContain("Vision")
  })

  it("returns [] when there are no candidates (vision not called)", async () => {
    findSpaCandidates.mockResolvedValue([])
    const result = await runMatchPipeline("lux-1")
    expect(result).toEqual([])
    expect(visionRerank).not.toHaveBeenCalled()
  })

  it("throws when the product is not a luxury item", async () => {
    single.mockResolvedValue({ data: { ...luxRow, tier: "spa" }, error: null })
    await expect(runMatchPipeline("lux-1")).rejects.toThrow(/luxury/i)
  })

  it("keeps vision-unranked candidates with their similarity score", async () => {
    findSpaCandidates.mockResolvedValue(cands)
    visionRerank.mockResolvedValue([{ dupeId: "spa-2", score: 0.9, reason: "닮음" }])

    const result = await runMatchPipeline("lux-1")

    const spa1 = result.find((r) => r.id === "spa-1")!
    expect(spa1.score).toBe(0.6) // falls back to its similarity
    expect(spa1.reason).toContain("Vision")
    expect(result[0].id).toBe("spa-2") // vision-scored 0.9 still ranks first
  })

  it("skips vision and falls back when all candidate images are missing", async () => {
    findSpaCandidates.mockResolvedValue(cands.map((c) => ({ ...c, imageUrl: null })))

    const result = await runMatchPipeline("lux-1")

    expect(visionRerank).not.toHaveBeenCalled()
    expect(result.map((r) => r.id)).toEqual(["spa-1", "spa-2"]) // similarity desc
    expect(result[0].reason).toContain("Vision")
  })
})
