import { describe, it, expect, vi, beforeEach } from "vitest"

const create = vi.fn()
vi.mock("openai", () => ({
  // NOTE: must be a *constructible* function (not an arrow) so `new OpenAI()`
  // works — arrow fns throw "is not a constructor" under vi.fn().mockImplementation.
  default: vi.fn().mockImplementation(function (this: { chat: unknown }) {
    this.chat = { completions: { create } }
  }),
}))

import { visionRerank } from "@/lib/matching/vision-rerank"

const lux = { name: "Saint Laurent LE 5 A 7", description: null, imageUrl: "https://img/lux.jpg" }
const candidates = [
  { id: "spa-1", name: "COS Bag", imageUrl: "https://img/c1.jpg" },
  { id: "spa-2", name: "Zara Bag", imageUrl: "https://img/c2.jpg" },
]

describe("visionRerank", () => {
  beforeEach(() => create.mockReset())

  it("parses model JSON into RankedDupe[] and drops unknown ids", async () => {
    create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              results: [
                { dupeId: "spa-2", score: 0.91, reason: "실루엣·체인 닮음" },
                { dupeId: "spa-1", score: 0.7, reason: "형태 유사" },
                { dupeId: "ghost", score: 0.99, reason: "없는 후보" },
              ],
            }),
          },
        },
      ],
    })

    const result = await visionRerank({ lux, candidates })

    expect(result).toEqual([
      { dupeId: "spa-2", score: 0.91, reason: "실루엣·체인 닮음" },
      { dupeId: "spa-1", score: 0.7, reason: "형태 유사" },
    ])
    expect(create).toHaveBeenCalledOnce()
    const arg = create.mock.calls[0][0]
    expect(arg.model).toBe("gpt-4o-mini")
    expect(arg.response_format).toEqual({ type: "json_object" })
  })

  it("clamps scores into 0..1", async () => {
    create.mockResolvedValue({
      choices: [
        { message: { content: JSON.stringify({ results: [{ dupeId: "spa-1", score: 5, reason: "x" }] }) } },
      ],
    })
    const result = await visionRerank({ lux, candidates })
    expect(result[0].score).toBe(1)
  })

  it("throws on empty candidate list (caller should guard)", async () => {
    await expect(visionRerank({ lux, candidates: [] })).rejects.toThrow()
  })

  it("throws a labeled error when the model returns empty content", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: "" } }] })
    await expect(visionRerank({ lux, candidates })).rejects.toThrow(/empty model response/)
  })

  it("throws a labeled error when the model returns non-JSON", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: "not json" } }] })
    await expect(visionRerank({ lux, candidates })).rejects.toThrow(/non-JSON/)
  })

  it("returns [] when results is not an array", async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ results: {} }) } }],
    })
    expect(await visionRerank({ lux, candidates })).toEqual([])
  })
})
