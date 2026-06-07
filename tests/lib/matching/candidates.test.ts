import { describe, it, expect, vi, beforeEach } from "vitest"

const rpc = vi.fn()
vi.mock("@/lib/supabase/admin", () => ({
  adminClient: () => ({ rpc }),
}))

import { findSpaCandidates } from "@/lib/matching/candidates"

describe("findSpaCandidates", () => {
  beforeEach(() => rpc.mockReset())

  it("calls the RPC with lux id + limit and maps rows to SpaCandidate", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          id: "spa-1",
          name: "COS Bag",
          slug: "cos-bag",
          image_url: "https://img/cos.jpg",
          price_amount: 159000,
          price_currency: "KRW",
          similarity: 0.82,
        },
      ],
      error: null,
    })

    const result = await findSpaCandidates("lux-1", 20)

    expect(rpc).toHaveBeenCalledWith("match_spa_candidates_for", {
      lux_id: "lux-1",
      match_limit: 20,
    })
    expect(result).toEqual([
      {
        id: "spa-1",
        name: "COS Bag",
        slug: "cos-bag",
        imageUrl: "https://img/cos.jpg",
        priceAmount: 159000,
        priceCurrency: "KRW",
        similarity: 0.82,
      },
    ])
  })

  it("maps null image_url / price_amount through to null", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          id: "spa-2",
          name: "No Image Bag",
          slug: "no-image-bag",
          image_url: null,
          price_amount: null,
          price_currency: "KRW",
          similarity: 0.5,
        },
      ],
      error: null,
    })

    const result = await findSpaCandidates("lux-1")

    expect(result[0].imageUrl).toBeNull()
    expect(result[0].priceAmount).toBeNull()
  })

  it("throws when the RPC returns an error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } })
    await expect(findSpaCandidates("lux-1")).rejects.toThrow("boom")
  })

  it("returns [] when data is null", async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    expect(await findSpaCandidates("lux-1")).toEqual([])
  })
})
