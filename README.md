# DUPE

명품 × 가성비 듀프 매칭 서비스.

## Phase 1 status

This is the foundation + admin slice. You can:
- Register luxury products by URL (scrapes OG meta).
- Embed product text with OpenAI.
- Mirror images to Supabase Storage.
- Publish/archive products and see them on the public home in a masonry grid.

Not yet implemented:
- AI matching pipeline (Phase 2)
- Public detail page with dupes (Phase 2)
- Affiliate redirect + tracking (Phase 2)
- i18n, magazine, SEO polish (Phase 3)

## Setup

1. `npm install`
2. Copy `.env.example` → `.env.local` and fill in:
   - Supabase URL + anon + service role
   - OpenAI API key
   - Google OAuth client (redirect: `http://localhost:3000/api/auth/callback/google`)
   - `ADMIN_EMAILS=your@email.com`
3. Apply the schema: either `supabase link --project-ref <ref> && supabase db push`,
   or apply `supabase/migrations/*.sql` to your project (the Phase 1 schema is already
   live on the linked remote).
4. `npm run dev`

## Layout

- `app/(public)/*` — public pages
- `app/admin/*` — admin (Google OAuth, email whitelist)
- `lib/supabase/*` — Postgres clients
- `lib/scraper/*` — URL meta + image upload
- `lib/openai.ts` — embeddings
- `supabase/migrations/*` — schema

## Scripts

- `npm run dev` — local dev
- `npm test` — unit (vitest)
- `npm run e2e` — Playwright (requires `E2E_AUTH_OK=1` for now)
- `supabase db push` — apply migrations
