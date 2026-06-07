# Dupe Matching Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 2 dupe matching pipeline — given a registered luxury product, retrieve nearby SPA candidates by vector similarity, rerank them visually with GPT-4o-mini, and let an admin confirm/publish the top picks.

**Architecture:** Three layers. (1) A Postgres RPC does cosine-similarity candidate retrieval over `products.embedding` (pgvector). (2) A non-fatal Vision reranker (GPT-4o-mini chat-completions with image inputs) re-scores the candidates with image-weighted judgement and falls back to pure similarity when the model is unavailable. (3) An admin curation UI runs the pipeline for a chosen luxury product, shows the top 5 suggestions with AI scores + reasons, and persists admin-confirmed picks into the `matches` table. A separate batch-paste flow fills the SPA candidate pool. The final pick is always human-curated — no auto-publish.

**Tech Stack:** Next.js 14 App Router (server actions), Supabase (Postgres + pgvector + service-role client), OpenAI (`text-embedding-3-small` already wired; `gpt-4o-mini` vision added here), TypeScript, Vitest.

---

## Decisions locked (from brainstorming)

- **Matching architecture:** B — Vision included (text candidates → GPT-4o-mini vision rerank → admin confirm).
- **Text embedding provider:** OpenAI (already implemented in `lib/embeddings.ts`).
- **Vision provider:** GPT-4o-mini (OpenAI — same key/account as embeddings).
- **SPA pool fill method:** batch paste (multiple URLs at once).
- **Final pick:** admin curation (no auto-publish).
- **Image embedding (CLIP/SigLIP, option C):** OUT of scope — deferred to v2.

## File Structure

**New files:**
- `supabase/migrations/0012_match_candidates_rpc.sql` — `match_spa_candidates_for(lux_id, match_limit)` RPC.
- `lib/matching/types.ts` — shared types (`SpaCandidate`, `RankedDupe`, `MatchSuggestion`, `MatchPick`, `MatchRow`).
- `lib/matching/candidates.ts` — `findSpaCandidates()` (calls RPC).
- `lib/matching/vision-rerank.ts` — `visionRerank()` (GPT-4o-mini).
- `lib/matching/rows.ts` — `buildMatchRows()` pure helper.
- `lib/matching/pipeline.ts` — `runMatchPipeline()` orchestrator (non-fatal vision).
- `lib/products/create.ts` — `createProductFromScrape()` shared helper (extracted from `registerProduct`).
- `app/admin/match/page.tsx` — luxury-product picker list.
- `app/admin/match/[luxId]/page.tsx` — runs pipeline + renders suggestions.
- `app/admin/match/[luxId]/MatchPicker.tsx` — client component (checkbox + rank + note).
- `app/admin/match/actions.ts` — `confirmMatches()` server action.
- `app/admin/products/batch/page.tsx` — batch SPA paste form.
- `app/admin/products/batch/BatchForm.tsx` — client form component.
- `app/admin/products/batch/actions.ts` — `batchRegisterProducts()` server action.
- Tests: `tests/lib/matching/candidates.test.ts`, `tests/lib/matching/vision-rerank.test.ts`, `tests/lib/matching/rows.test.ts`, `tests/lib/matching/pipeline.test.ts`, `tests/lib/products/create.test.ts`.

**Modified files:**
- `app/admin/products/actions.ts` — refactor `registerProduct` to use `createProductFromScrape`.
- `app/admin/_components/Sidebar.tsx` (or wherever the admin sidebar lives) — add "매칭" and "배치 등록" nav links.

---

## Task 1: Vector similarity RPC

**Files:**
- Create: `supabase/migrations/0012_match_candidates_rpc.sql`

The RPC takes a luxury product id, reads that product's embedding + category inline, and returns same-category SPA products ordered by cosine distance. Returning `similarity = 1 - distance` keeps higher = better. Doing the lookup inside SQL avoids shipping 1536-float vectors over the wire.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0012_match_candidates_rpc.sql`:

```sql
-- Cosine-similarity candidate retrieval for dupe matching.
-- Given a luxury product, return same-category SPA products ranked by
-- vector similarity (higher = closer). Uses the IVFFlat cosine index on
-- products.embedding created in 0001/0002.

create or replace function match_spa_candidates_for(
  lux_id uuid,
  match_limit int default 20
)
returns table (
  id uuid,
  name text,
  slug text,
  image_url text,
  price_amount numeric,
  price_currency text,
  similarity double precision
)
language sql
stable
as $$
  select
    p.id,
    p.name,
    p.slug,
    p.image_url,
    p.price_amount,
    p.price_currency,
    1 - (p.embedding <=> lux.embedding) as similarity
  from products p
  cross join (
    select embedding, category
    from products
    where id = lux_id
  ) lux
  where p.tier = 'spa'
    and p.category = lux.category
    and p.embedding is not null
    and lux.embedding is not null
    and p.id <> lux_id
  order by p.embedding <=> lux.embedding
  limit match_limit;
$$;

-- Allow the service role (admin operations) to execute it.
grant execute on function match_spa_candidates_for(uuid, int) to service_role;
```

- [ ] **Step 2: Apply the migration to the Supabase project**

Use whichever path is configured for this repo:

Run (preferred, if Supabase CLI is linked): `npx supabase db push`
Expected: output lists `0012_match_candidates_rpc.sql` as applied with no errors.

If the CLI is not linked, apply via the Supabase MCP `apply_migration` tool (name: `match_candidates_rpc`, query: the SQL above) against the project.

- [ ] **Step 3: Verify the function exists and runs**

Run this SQL in the Supabase SQL editor (or via `npx supabase db execute`):

```sql
select proname from pg_proc where proname = 'match_spa_candidates_for';
```
Expected: one row, `match_spa_candidates_for`.

Then a smoke call (replace the uuid with any existing luxury product id; if the SPA pool is empty it returns 0 rows, which is fine):
```sql
select id, name, round(similarity::numeric, 3) as sim
from match_spa_candidates_for('00000000-0000-0000-0000-000000000000', 5);
```
Expected: no error (empty result is acceptable at this stage).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0012_match_candidates_rpc.sql
git commit -m "feat(matching): add match_spa_candidates_for vector similarity RPC"
```

---

## Task 2: Matching types + candidates module

**Files:**
- Create: `lib/matching/types.ts`
- Create: `lib/matching/candidates.ts`
- Test: `tests/lib/matching/candidates.test.ts`

- [ ] **Step 1: Define shared types**

Create `lib/matching/types.ts`:

```typescript
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
```

- [ ] **Step 2: Write the failing test**

Create `tests/lib/matching/candidates.test.ts`:

```typescript
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

  it("throws when the RPC returns an error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } })
    await expect(findSpaCandidates("lux-1")).rejects.toThrow("boom")
  })

  it("returns [] when data is null", async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    expect(await findSpaCandidates("lux-1")).toEqual([])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/lib/matching/candidates.test.ts`
Expected: FAIL — cannot resolve `@/lib/matching/candidates`.

- [ ] **Step 4: Implement the candidates module**

Create `lib/matching/candidates.ts`:

```typescript
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

type RpcRow = {
  id: string
  name: string
  slug: string
  image_url: string | null
  price_amount: number | null
  price_currency: string
  similarity: number
}
```

> Note: the generated `database.types.ts` will not yet know this RPC, so `adminClient().rpc("match_spa_candidates_for", ...)` may produce a TS error. If it does, regenerate types (`npx supabase gen types typescript --linked > lib/supabase/database.types.ts`) OR cast: `(adminClient().rpc as any)(...)`. Prefer regenerating types; fall back to the cast only if generation is unavailable in the environment.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/lib/matching/candidates.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/matching/types.ts lib/matching/candidates.ts tests/lib/matching/candidates.test.ts
git commit -m "feat(matching): SpaCandidate retrieval via similarity RPC"
```

---

## Task 3: Vision reranker (GPT-4o-mini)

**Files:**
- Create: `lib/matching/vision-rerank.ts`
- Test: `tests/lib/matching/vision-rerank.test.ts`

The reranker sends the luxury image + each candidate image to GPT-4o-mini and asks for the top 5 by visual similarity (image weighted 0.7, text 0.3), returning JSON. It validates returned ids against the input set and clamps scores to 0..1.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/matching/vision-rerank.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

const create = vi.fn()
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create } },
  })),
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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/matching/vision-rerank.test.ts`
Expected: FAIL — cannot resolve `@/lib/matching/vision-rerank`.

- [ ] **Step 3: Implement the vision reranker**

Create `lib/matching/vision-rerank.ts`:

```typescript
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

  const parsed = JSON.parse(raw) as { results?: unknown }
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/matching/vision-rerank.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/matching/vision-rerank.ts tests/lib/matching/vision-rerank.test.ts
git commit -m "feat(matching): GPT-4o-mini vision reranker"
```

---

## Task 4: buildMatchRows pure helper

**Files:**
- Create: `lib/matching/rows.ts`
- Test: `tests/lib/matching/rows.test.ts`

Extracting the row construction into a pure function makes the confirm action trivially testable.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/matching/rows.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/matching/rows.test.ts`
Expected: FAIL — cannot resolve `@/lib/matching/rows`.

- [ ] **Step 3: Implement the helper**

Create `lib/matching/rows.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/matching/rows.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/matching/rows.ts tests/lib/matching/rows.test.ts
git commit -m "feat(matching): buildMatchRows helper"
```

---

## Task 5: Pipeline orchestrator

**Files:**
- Create: `lib/matching/pipeline.ts`
- Test: `tests/lib/matching/pipeline.test.ts`

`runMatchPipeline` fetches the luxury product, retrieves candidates, vision-reranks them (non-fatal — falls back to similarity ordering on any vision error or missing image), merges scores, and returns the top 5.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/matching/pipeline.test.ts`:

```typescript
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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/matching/pipeline.test.ts`
Expected: FAIL — cannot resolve `@/lib/matching/pipeline`.

- [ ] **Step 3: Implement the pipeline**

Create `lib/matching/pipeline.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/matching/pipeline.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full unit suite (no regressions)**

Run: `npm test`
Expected: PASS — all existing tests plus the new matching tests.

- [ ] **Step 6: Commit**

```bash
git add lib/matching/pipeline.ts tests/lib/matching/pipeline.test.ts
git commit -m "feat(matching): non-fatal matching pipeline orchestrator"
```

---

## Task 6: confirmMatches server action

**Files:**
- Create: `app/admin/match/actions.ts`

Persists admin-confirmed picks: upsert into `matches` (status published), then publish the luxury product and each picked SPA product so they render publicly. Uses `buildMatchRows` (already tested in Task 4).

- [ ] **Step 1: Implement the action**

Create `app/admin/match/actions.ts`:

```typescript
"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth" // existing NextAuth helper used by other admin actions
import { adminClient } from "@/lib/supabase/admin"
import { buildMatchRows } from "@/lib/matching/rows"
import type { MatchPick } from "@/lib/matching/types"

export type ConfirmState = { ok?: boolean; error?: string }

export async function confirmMatches(luxId: string, picks: MatchPick[]): Promise<ConfirmState> {
  const session = await auth()
  if (!session) return { error: "인증이 필요합니다." }
  if (picks.length === 0) return { error: "선택된 듀프가 없습니다." }

  const supa = adminClient()
  const rows = buildMatchRows(luxId, picks)

  const { error: upErr } = await supa.from("matches").upsert(rows, { onConflict: "lux_id,dupe_id" })
  if (upErr) return { error: upErr.message }

  // Publish the luxury product and each picked SPA product.
  const publishedAt = new Date().toISOString()
  const idsToPublish = [luxId, ...picks.map((p) => p.dupeId)]
  const { error: pubErr } = await supa
    .from("products")
    .update({ status: "published", published_at: publishedAt })
    .in("id", idsToPublish)
  if (pubErr) return { error: pubErr.message }

  revalidatePath("/admin/match")
  revalidatePath("/")
  revalidatePath(`/admin/match/${luxId}`)

  return { ok: true }
}
```

> Note: confirm the auth import. Other admin actions in `app/admin/products/actions.ts` already perform an auth check — match its exact import (`@/lib/auth` `auth()` vs `getServerSession`). Use the identical pattern found there. Likewise confirm `published_at` is the correct column name against `database.types.ts` (it is, per the schema map).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `app/admin/match/actions.ts`. (If the RPC cast note from Task 2 applies, ensure types were regenerated.)

- [ ] **Step 3: Commit**

```bash
git add app/admin/match/actions.ts
git commit -m "feat(matching): confirmMatches action publishes curated picks"
```

---

## Task 7: Matching admin UI

**Files:**
- Create: `app/admin/match/page.tsx`
- Create: `app/admin/match/[luxId]/page.tsx`
- Create: `app/admin/match/[luxId]/MatchPicker.tsx`
- Modify: the admin sidebar component (add nav link)

- [ ] **Step 1: Luxury picker list page**

Create `app/admin/match/page.tsx`:

```tsx
import Link from "next/link"
import { adminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export default async function MatchListPage() {
  const { data: luxProducts } = await adminClient()
    .from("products")
    .select("id, name, image_url, status")
    .eq("tier", "luxury")
    .order("created_at", { ascending: false })

  return (
    <div className="p-8">
      <h1 className="text-2xl font-serif mb-6">듀프 매칭</h1>
      <p className="text-neutral-400 mb-6">명품을 선택하면 SPA 풀에서 가까운 후보를 찾아 듀프를 확정합니다.</p>
      <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(luxProducts ?? []).map((p) => (
          <li key={p.id}>
            <Link
              href={`/admin/match/${p.id}`}
              className="block rounded-lg border border-neutral-800 p-4 hover:border-neutral-600"
            >
              {p.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt={p.name} className="aspect-square w-full object-cover rounded mb-3" />
              )}
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-neutral-500">{p.status}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Suggestions page (runs the pipeline)**

Create `app/admin/match/[luxId]/page.tsx`:

```tsx
import { notFound } from "next/navigation"
import { adminClient } from "@/lib/supabase/admin"
import { runMatchPipeline } from "@/lib/matching/pipeline"
import { MatchPicker } from "./MatchPicker"

export const dynamic = "force-dynamic"

export default async function MatchDetailPage({ params }: { params: { luxId: string } }) {
  const { data: lux } = await adminClient()
    .from("products")
    .select("id, name, image_url, tier")
    .eq("id", params.luxId)
    .single()

  if (!lux || lux.tier !== "luxury") notFound()

  const suggestions = await runMatchPipeline(params.luxId)

  return (
    <div className="p-8">
      <h1 className="text-2xl font-serif mb-2">{lux.name}</h1>
      <p className="text-neutral-400 mb-6">DUPE PICKS — AI 후보 {suggestions.length}개. 확정할 듀프를 선택하세요.</p>
      {lux.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={lux.image_url} alt={lux.name} className="w-48 aspect-square object-cover rounded mb-8" />
      )}
      {suggestions.length === 0 ? (
        <p className="text-amber-400">
          후보가 없습니다. SPA 풀에 같은 카테고리 상품을 배치 등록한 뒤 다시 시도하세요.
        </p>
      ) : (
        <MatchPicker luxId={lux.id} suggestions={suggestions} />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Client picker component**

Create `app/admin/match/[luxId]/MatchPicker.tsx`:

```tsx
"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { confirmMatches } from "../actions"
import type { MatchSuggestion, MatchPick } from "@/lib/matching/types"

export function MatchPicker({ luxId, suggestions }: { luxId: string; suggestions: MatchSuggestion[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }))
  }

  function submit() {
    const picks: MatchPick[] = suggestions
      .filter((s) => selected[s.id])
      .map((s, i) => ({ dupeId: s.id, rank: i + 1, score: s.score, editorNote: notes[s.id] ?? "" }))

    if (picks.length === 0) {
      setError("최소 1개를 선택하세요.")
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await confirmMatches(luxId, picks)
      if (res.error) setError(res.error)
      else router.push("/admin/match")
    })
  }

  return (
    <div>
      <ul className="space-y-4">
        {suggestions.map((s) => (
          <li key={s.id} className="flex gap-4 items-start rounded-lg border border-neutral-800 p-4">
            <input type="checkbox" checked={!!selected[s.id]} onChange={() => toggle(s.id)} className="mt-2" />
            {s.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.imageUrl} alt={s.name} className="w-24 aspect-square object-cover rounded" />
            )}
            <div className="flex-1">
              <div className="font-medium">{s.name}</div>
              <div className="text-sm text-neutral-400">
                매치 {Math.round(s.score * 100)}% · 유사도 {Math.round(s.similarity * 100)}%
              </div>
              <div className="text-sm text-neutral-500 mt-1">{s.reason}</div>
              <input
                type="text"
                placeholder="에디터 코멘트 (선택)"
                value={notes[s.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                className="mt-2 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm"
              />
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="text-red-400 mt-4">{error}</p>}
      <button
        onClick={submit}
        disabled={pending}
        className="mt-6 bg-white text-black px-6 py-2 rounded disabled:opacity-50"
      >
        {pending ? "발행 중..." : "선택한 듀프 발행"}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Add the sidebar nav link**

Read the admin sidebar component (from the map it is the `Sidebar` component used in `app/admin/layout.tsx`; find its file). Add a link to `/admin/match` labelled "매칭" next to the existing "상품" link, matching the existing link markup exactly. Example (adapt to the real markup):

```tsx
<Link href="/admin/match" className={linkClass}>매칭</Link>
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev`
Then, signed in as an admin:
1. Visit `/admin/match` — luxury products list renders.
2. Click one — suggestions render (or the "후보 없음" message if the SPA pool is empty for that category).
3. Select 1–2, optionally add notes, click "선택한 듀프 발행".
4. Confirm redirect to `/admin/match`, and that `matches` rows exist:
   ```sql
   select lux_id, dupe_id, rank, score, status from matches order by created_at desc limit 5;
   ```
   Expected: the confirmed picks with `status = 'published'`.

- [ ] **Step 6: Commit**

```bash
git add app/admin/match
git add <admin sidebar file>
git commit -m "feat(matching): admin curation UI for dupe matching"
```

---

## Task 8: Batch SPA registration

**Files:**
- Create: `lib/products/create.ts`
- Test: `tests/lib/products/create.test.ts`
- Modify: `app/admin/products/actions.ts` (use the shared helper)
- Create: `app/admin/products/batch/actions.ts`
- Create: `app/admin/products/batch/page.tsx`
- Create: `app/admin/products/batch/BatchForm.tsx`
- Modify: the admin sidebar component (add "배치 등록" link)

This fills the SPA candidate pool. First extract the single-product create flow (scrape → upload image → embed → insert + translation) into a reusable helper so batch and single registration share one code path (DRY).

- [ ] **Step 1: Write the failing test for the shared helper**

Create `tests/lib/products/create.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

const insert = vi.fn()
const trInsert = vi.fn()
const from = vi.fn((table: string) => {
  if (table === "product_translations") return { insert: trInsert }
  return { insert }
})
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => ({ from }) }))

const scrapeProductUrl = vi.fn()
vi.mock("@/lib/scraper", () => ({ scrapeProductUrl: (...a: unknown[]) => scrapeProductUrl(...a) }))

const uploadImageFromUrl = vi.fn()
vi.mock("@/lib/scraper/image", () => ({ uploadImageFromUrl: (...a: unknown[]) => uploadImageFromUrl(...a) }))

const embedSafe = vi.fn()
vi.mock("@/lib/embeddings", () => ({ embedSafe: (...a: unknown[]) => embedSafe(...a) }))

import { createProductFromScrape } from "@/lib/products/create"

describe("createProductFromScrape", () => {
  beforeEach(() => {
    insert.mockReset().mockResolvedValue({ data: [{ id: "p-1" }], error: null })
    trInsert.mockReset().mockResolvedValue({ error: null })
    scrapeProductUrl.mockReset().mockResolvedValue({
      title: "COS Leather Bag",
      description: "A clean leather bag",
      imageUrl: "https://src/cos.jpg",
      priceAmount: 159000,
      priceCurrency: "KRW",
      sourceUrl: "https://cos.com/bag",
    })
    uploadImageFromUrl.mockReset().mockResolvedValue("https://storage/cos.jpg")
    embedSafe.mockReset().mockResolvedValue({ vector: new Array(1536).fill(0.1), error: null })
  })

  it("scrapes, uploads image, embeds, and inserts a product + KO translation", async () => {
    const result = await createProductFromScrape({
      url: "https://cos.com/bag",
      brandId: "brand-cos",
      tier: "spa",
      category: "bags",
    })

    expect(result.ok).toBe(true)
    expect(uploadImageFromUrl).toHaveBeenCalledWith("https://src/cos.jpg")
    expect(embedSafe).toHaveBeenCalled()
    const inserted = insert.mock.calls[0][0]
    expect(inserted).toMatchObject({
      brand_id: "brand-cos",
      tier: "spa",
      category: "bags",
      name: "COS Leather Bag",
      image_url: "https://storage/cos.jpg",
      source_url: "https://cos.com/bag",
      status: "draft",
    })
    expect(trInsert).toHaveBeenCalled()
  })

  it("returns an error result when scraping fails (does not throw)", async () => {
    scrapeProductUrl.mockRejectedValue(new Error("404"))
    const result = await createProductFromScrape({
      url: "https://cos.com/missing",
      brandId: "brand-cos",
      tier: "spa",
      category: "bags",
    })
    expect(result.ok).toBe(false)
    expect(result.error).toContain("404")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/products/create.test.ts`
Expected: FAIL — cannot resolve `@/lib/products/create`.

- [ ] **Step 3: Implement the shared helper**

> Before writing, open `app/admin/products/actions.ts` and copy its real slugify/uniqueness logic, exact column names, and translation-insert shape so this helper is behavior-identical. The code below is the target shape — reconcile any differences with the existing action.

Create `lib/products/create.ts`:

```typescript
import { adminClient } from "@/lib/supabase/admin"
import { scrapeProductUrl } from "@/lib/scraper"
import { uploadImageFromUrl } from "@/lib/scraper/image"
import { embedSafe } from "@/lib/embeddings"
import { slugify } from "@/lib/slug" // existing helper

export type CreateProductInput = {
  url: string
  brandId: string
  tier: "luxury" | "spa"
  category: "bags" | "shoes" | "outerwear"
}

export type CreateProductResult =
  | { ok: true; id: string; name: string }
  | { ok: false; error: string; url: string }

/**
 * Scrape a product URL, mirror its image, embed its text, and insert it as a
 * draft product (+ KO translation). Never throws — returns an error result so
 * batch callers can continue past individual failures.
 */
export async function createProductFromScrape(input: CreateProductInput): Promise<CreateProductResult> {
  try {
    const meta = await scrapeProductUrl(input.url)
    const name = meta.title?.trim()
    if (!name) return { ok: false, error: "상품명을 추출하지 못했습니다.", url: input.url }

    const supa = adminClient()

    const imageUrl = meta.imageUrl ? await uploadImageFromUrl(meta.imageUrl) : null

    const { vector } = await embedSafe(`${name}\n${meta.description ?? ""}`)

    const slug = await uniqueSlug(supa, slugify(name))

    const { data, error } = await supa
      .from("products")
      .insert({
        brand_id: input.brandId,
        tier: input.tier,
        category: input.category,
        slug,
        name,
        price_amount: meta.priceAmount,
        price_currency: meta.priceCurrency ?? "KRW",
        source_url: meta.sourceUrl,
        image_url: imageUrl,
        image_original_url: meta.imageUrl,
        embedding: vector ? JSON.stringify(vector) : null,
        status: "draft",
      })
      .select("id")
    if (error) return { ok: false, error: error.message, url: input.url }

    const id = (data as { id: string }[])[0].id

    if (meta.description) {
      await supa.from("product_translations").insert({
        product_id: id,
        locale: "ko",
        name,
        description: meta.description,
      })
    }

    return { ok: true, id, name }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), url: input.url }
  }
}

async function uniqueSlug(
  supa: ReturnType<typeof adminClient>,
  base: string,
): Promise<string> {
  let slug = base
  for (let i = 2; i < 100; i++) {
    const { data } = await supa.from("products").select("id").eq("slug", slug).maybeSingle()
    if (!data) return slug
    slug = `${base}-${i}`
  }
  return `${base}-${Date.now()}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/products/create.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Refactor registerProduct to use the helper**

In `app/admin/products/actions.ts`, replace the inline scrape/upload/embed/insert body of `registerProduct` with a call to `createProductFromScrape` for the URL-driven path (keep the manual-entry fallback and the auth check). Preserve the existing `RegisterState` return shape and the redirect on success.

- [ ] **Step 6: Verify no regression**

Run: `npm test`
Expected: PASS — all tests, including any existing coverage of `registerProduct` and the new `create` tests.

- [ ] **Step 7: Implement the batch action**

Create `app/admin/products/batch/actions.ts`:

```typescript
"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth" // match the auth pattern used in products/actions.ts
import { createProductFromScrape } from "@/lib/products/create"

export type BatchState = {
  created?: number
  failures?: { url: string; error: string }[]
  error?: string
}

export async function batchRegisterProducts(formData: FormData): Promise<BatchState> {
  const session = await auth()
  if (!session) return { error: "인증이 필요합니다." }

  const brandId = String(formData.get("brand_id") ?? "")
  const tier = String(formData.get("tier") ?? "spa") as "luxury" | "spa"
  const category = String(formData.get("category") ?? "") as "bags" | "shoes" | "outerwear"
  const urls = String(formData.get("urls") ?? "")
    .split(/\r?\n/)
    .map((u) => u.trim())
    .filter(Boolean)

  if (!brandId || !category) return { error: "브랜드와 카테고리를 선택하세요." }
  if (urls.length === 0) return { error: "URL을 1개 이상 입력하세요." }

  let created = 0
  const failures: { url: string; error: string }[] = []

  // Sequential to stay within scraper/embedding rate limits.
  for (const url of urls) {
    const res = await createProductFromScrape({ url, brandId, tier, category })
    if (res.ok) created++
    else failures.push({ url: res.url, error: res.error })
  }

  revalidatePath("/admin/products")
  return { created, failures }
}
```

- [ ] **Step 8: Implement the batch form (client) + page**

Create `app/admin/products/batch/BatchForm.tsx`:

```tsx
"use client"

import { useState, useTransition } from "react"
import { batchRegisterProducts, type BatchState } from "./actions"

type Brand = { id: string; name: string; tier: string }

export function BatchForm({ brands }: { brands: Brand[] }) {
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<BatchState | null>(null)

  function action(formData: FormData) {
    startTransition(async () => setState(await batchRegisterProducts(formData)))
  }

  return (
    <form action={action} className="space-y-4 max-w-xl">
      <select name="brand_id" className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2" required>
        <option value="">브랜드 선택</option>
        {brands.map((b) => (
          <option key={b.id} value={b.id}>{b.name} ({b.tier})</option>
        ))}
      </select>
      <select name="tier" defaultValue="spa" className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2">
        <option value="spa">SPA (듀프 후보 풀)</option>
        <option value="luxury">명품</option>
      </select>
      <select name="category" className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2" required>
        <option value="">카테고리 선택</option>
        <option value="bags">가방</option>
        <option value="shoes">신발</option>
        <option value="outerwear">아우터</option>
      </select>
      <textarea
        name="urls"
        rows={10}
        placeholder="상품 URL을 한 줄에 하나씩 붙여넣으세요"
        className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 font-mono text-sm"
        required
      />
      <button type="submit" disabled={pending} className="bg-white text-black px-6 py-2 rounded disabled:opacity-50">
        {pending ? "등록 중..." : "배치 등록"}
      </button>

      {state?.error && <p className="text-red-400">{state.error}</p>}
      {state && state.created !== undefined && (
        <div className="text-sm">
          <p className="text-green-400">{state.created}개 등록 완료.</p>
          {state.failures && state.failures.length > 0 && (
            <ul className="text-red-400 mt-2 space-y-1">
              {state.failures.map((f) => (
                <li key={f.url}>{f.url} — {f.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  )
}
```

Create `app/admin/products/batch/page.tsx`:

```tsx
import { adminClient } from "@/lib/supabase/admin"
import { BatchForm } from "./BatchForm"

export const dynamic = "force-dynamic"

export default async function BatchPage() {
  const { data: brands } = await adminClient()
    .from("brands")
    .select("id, name, tier")
    .order("name")

  return (
    <div className="p-8">
      <h1 className="text-2xl font-serif mb-2">배치 등록</h1>
      <p className="text-neutral-400 mb-6">SPA 듀프 후보 풀을 URL 붙여넣기로 한 번에 채웁니다.</p>
      <BatchForm brands={brands ?? []} />
    </div>
  )
}
```

- [ ] **Step 9: Add sidebar link**

Add a "배치 등록" link to the admin sidebar pointing at `/admin/products/batch`, matching existing markup.

- [ ] **Step 10: Manual verification**

Run: `npm run dev`, signed in as admin:
1. Visit `/admin/products/batch`.
2. Pick a SPA brand + category, paste 2–3 real SPA product URLs (one per line), submit.
3. Confirm the success count and that any failures are listed with reasons.
4. Verify rows landed:
   ```sql
   select name, tier, category, status, (embedding is not null) as has_vec
   from products where tier = 'spa' order by created_at desc limit 5;
   ```
   Expected: new SPA draft rows, most with `has_vec = true`.
5. Now revisit `/admin/match/<a luxury id of the same category>` — candidates should appear.

- [ ] **Step 11: Commit**

```bash
git add lib/products/create.ts tests/lib/products/create.test.ts app/admin/products/actions.ts app/admin/products/batch
git add <admin sidebar file>
git commit -m "feat(matching): batch SPA registration to fill the candidate pool"
```

---

## Self-Review

**Spec coverage (design doc §6 matching pipeline):**
- §6.1.1 명품 등록 — already exists (Phase 1); reused via `createProductFromScrape`. ✓
- §6.1.2 임베딩 생성 (text) — already exists (`embedSafe`); reused. ✓ (image embedding intentionally out of scope per decision C-excluded.)
- §6.1.3 SPA 카탈로그 임베딩 풀 — Task 8 (batch paste). ✓
- §6.1.4 후보 추출 (pgvector TOP 20) — Task 1 (RPC) + Task 2 (candidates). ✓
- §6.1.5 GPT-4o-mini Vision 재랭킹 — Task 3. ✓
- §6.1.6 어드민 검수 + publish — Task 5 (pipeline) + Task 6 (confirm) + Task 7 (UI). ✓
- §6.2 URL 붙여넣기 매칭 (user preview flow) — NOT in this plan; it is a separate public-facing subsystem (`/preview/[hash]`, rate limiting, captcha). Recommend a separate plan. Flagged, not silently dropped.

**Placeholder scan:** No TBD/TODO/"handle edge cases" left. Each code step contains runnable code. Two explicit "reconcile with existing file" notes (auth import, registerProduct internals) are deliberate — they point at real files to read, not vague instructions.

**Type consistency:** `SpaCandidate`, `MatchSuggestion`, `MatchPick`, `MatchRow`, `RankedDupe` defined once in `lib/matching/types.ts` and imported everywhere. `findSpaCandidates(luxId, limit)`, `visionRerank({lux, candidates})`, `runMatchPipeline(luxId)`, `buildMatchRows(luxId, picks)`, `confirmMatches(luxId, picks)`, `createProductFromScrape(input)` signatures are consistent across tasks. RPC name `match_spa_candidates_for` matches between Task 1 (SQL) and Task 2 (call).

**Known reconciliation points (must verify against real code during execution):**
1. Auth helper import (`@/lib/auth` `auth()` vs `getServerSession`) — copy from `app/admin/products/actions.ts`.
2. `slugify` import path (`@/lib/slug`) and exact uniqueness loop — copy from existing `registerProduct`.
3. Admin sidebar component file path — found via `app/admin/layout.tsx`.
4. `database.types.ts` regeneration after the new RPC (Task 1) to avoid `.rpc()` type errors.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-07-dupe-matching-pipeline.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
