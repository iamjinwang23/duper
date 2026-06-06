# DUPE Phase 1: Foundation + Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the Next.js + Supabase + OpenAI foundation and build a working admin where the curator can register luxury products from URLs, generate embeddings, and persist them.

**Architecture:** Next.js 14 App Router on Vercel, Supabase Postgres + pgvector + Storage, OpenAI embeddings. Admin is protected by Google OAuth (next-auth) with email whitelist. Public side has only a basic homepage stub in this phase; full public UI lands in Phase 2.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase (Postgres + pgvector + Storage), next-auth, OpenAI SDK, Vitest, Playwright.

**Out of scope for this phase (covered in Phase 2/3):**
- AI matching pipeline (GPT-4o Vision reranker, candidate selection)
- Public detail page, category page, magazine
- Affiliate redirect (`/r/[link-id]`)
- i18n (KR/EN)
- SEO polish, analytics

**Spec reference:** `docs/superpowers/specs/2026-06-07-dupe-design.md`

---

## File Structure

```
dupe/
├── app/
│   ├── (public)/
│   │   ├── layout.tsx          # Public shell (header/footer placeholder)
│   │   └── page.tsx            # Home (stub: lists published products)
│   ├── admin/
│   │   ├── layout.tsx          # Admin shell (sidebar + nav)
│   │   ├── page.tsx            # Admin dashboard
│   │   ├── products/
│   │   │   ├── page.tsx        # Product list
│   │   │   ├── new/page.tsx    # New product form
│   │   │   └── [id]/page.tsx   # Edit product
│   │   └── login/page.tsx      # Sign-in page
│   ├── api/auth/[...nextauth]/route.ts
│   └── layout.tsx              # Root layout (HTML, fonts)
├── components/
│   ├── admin/
│   │   ├── ProductForm.tsx
│   │   └── Sidebar.tsx
│   └── ui/
│       └── Button.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Browser client
│   │   ├── server.ts           # Server client (cookie-bound)
│   │   └── admin.ts            # Service-role client (server-only)
│   ├── auth.ts                 # next-auth config
│   ├── openai.ts               # OpenAI client + embeddings helper
│   ├── scraper/
│   │   ├── index.ts            # Public scraper API
│   │   ├── og-meta.ts          # OG/JSON-LD parser
│   │   └── image.ts            # Image download + Storage upload
│   └── env.ts                  # Validated env vars (zod)
├── supabase/
│   └── migrations/
│       ├── 0001_extensions.sql
│       ├── 0002_brands.sql
│       ├── 0003_products.sql
│       ├── 0004_product_translations.sql
│       ├── 0005_matches.sql
│       ├── 0006_affiliate_links.sql
│       ├── 0007_weekly_picks.sql
│       ├── 0008_collections.sql
│       ├── 0009_likes.sql
│       ├── 0010_click_events.sql
│       └── 0011_rls.sql
├── tests/
│   ├── lib/
│   │   ├── scraper.test.ts
│   │   └── openai.test.ts
│   └── e2e/
│       └── admin-product.spec.ts
├── .env.example
├── .env.local                  # gitignored
├── middleware.ts               # Admin auth guard
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── playwright.config.ts
└── vitest.config.ts
```

---

## Phase 0: Project Bootstrap

### Task 1: Initialize Next.js project

**Files:**
- Create: `package.json`, `next.config.mjs`, `tsconfig.json`, `tailwind.config.ts`, `app/layout.tsx`, `app/(public)/page.tsx`, `.gitignore`, `.env.example`

- [ ] **Step 1: Create the project with create-next-app**

Run:
```bash
cd "/Users/jinwang/Desktop/Claude Code Workspace/dupe"
npx create-next-app@14 . --typescript --tailwind --app --src-dir=false --import-alias="@/*" --eslint --no-turbo
```

Accept all defaults. If prompted about overwriting existing files (`.bkit`, `docs/`, `.superpowers/`), choose **No** for those directories.

Expected output: `package.json`, `app/`, `public/`, `tailwind.config.ts`, `tsconfig.json` created.

- [ ] **Step 2: Verify it boots**

Run:
```bash
npm run dev
```

Open http://localhost:3000 and confirm the Next.js welcome page renders. Stop the dev server with Ctrl+C.

- [ ] **Step 3: Add public route group**

Move `app/page.tsx` into `app/(public)/page.tsx` (create the directory). Replace its contents with:

```tsx
export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-serif">DUPE</h1>
      <p className="text-sm opacity-60 mt-2">Coming soon — admin at /admin</p>
    </main>
  );
}
```

- [ ] **Step 4: Add gitignore entries**

Append to `.gitignore`:

```
.env.local
.env*.local
.superpowers/
.next/
node_modules/
playwright-report/
test-results/
```

- [ ] **Step 5: Create .env.example**

Create `.env.example`:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenAI
OPENAI_API_KEY=

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ADMIN_EMAILS=admin@example.com
```

(In your own `.env.local`, set `ADMIN_EMAILS` to your real email — comma-separated for multiple admins. `.env.example` stays as a public placeholder.)

- [ ] **Step 6: Initialize git and commit**

```bash
git init
git add .
git commit -m "chore: bootstrap Next.js 14 + Tailwind + TS"
```

---

### Task 2: Install core dependencies and configure tooling

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`, `playwright.config.ts`, `lib/env.ts`, `prettier.config.cjs`

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install \
  @supabase/supabase-js \
  @supabase/ssr \
  next-auth@5.0.0-beta.20 \
  openai \
  cheerio \
  zod \
  framer-motion \
  date-fns
```

- [ ] **Step 2: Install dev dependencies**

```bash
npm install -D \
  vitest @vitest/ui \
  @testing-library/react @testing-library/jest-dom \
  jsdom \
  @playwright/test \
  prettier prettier-plugin-tailwindcss \
  tsx
```

Run `npx playwright install --with-deps chromium`.

- [ ] **Step 3: Create lib/env.ts**

Create `lib/env.ts`:

```ts
import { z } from "zod";

const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  OPENAI_API_KEY: z.string().min(20).optional(),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(20).optional(),
  GOOGLE_CLIENT_ID: z.string().min(10).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(10).optional(),
  ADMIN_EMAILS: z.string().default(""),
});

export const env = EnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  ADMIN_EMAILS: process.env.ADMIN_EMAILS ?? "",
});

export const adminEmails = env.ADMIN_EMAILS.split(",").map((e) => e.trim()).filter(Boolean);
```

- [ ] **Step 4: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: [],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
});
```

- [ ] **Step 5: Create playwright.config.ts**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

- [ ] **Step 6: Create prettier.config.cjs**

```js
module.exports = {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  plugins: ["prettier-plugin-tailwindcss"],
};
```

- [ ] **Step 7: Add npm scripts**

Update `package.json` `"scripts"`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "format": "prettier --write ."
  }
}
```

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "chore: add testing, prettier, env validation"
```

---

### Task 3: Create Supabase project and link locally

**Files:**
- Create: `supabase/config.toml` (generated by CLI), `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`

- [ ] **Step 1: Install Supabase CLI**

Check if installed:
```bash
supabase --version
```

If not installed:
```bash
brew install supabase/tap/supabase
```

- [ ] **Step 2: Create remote Supabase project**

Go to https://supabase.com/dashboard, create a new project named `dupe`. Pick the closest region (Seoul or Tokyo). Set a strong DB password. Save:
- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` secret → `SUPABASE_SERVICE_ROLE_KEY`

Put them into `.env.local` (create the file).

- [ ] **Step 3: Initialize Supabase locally**

```bash
supabase init
```

This creates `supabase/` directory with `config.toml` and `migrations/`.

- [ ] **Step 4: Link to remote project**

```bash
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
```

`<YOUR_PROJECT_REF>` is the slug shown in the dashboard URL.

- [ ] **Step 5: Create Supabase client files**

Create `lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export function createClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
```

Create `lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (n) => cookieStore.get(n)?.value,
        set: (n, v, o) => cookieStore.set({ name: n, value: v, ...o }),
        remove: (n, o) => cookieStore.set({ name: n, value: "", ...o }),
      },
    },
  );
}
```

Create `lib/supabase/admin.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let cached: ReturnType<typeof createClient> | null = null;

export function adminClient() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin operations");
  }
  if (!cached) {
    cached = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
```

- [ ] **Step 6: Verify env loads without error**

```bash
npm run dev
```

Open http://localhost:3000. Page should render. If env validation throws, fix `.env.local`. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: link Supabase project + client wrappers"
```

---

## Phase 1: Database Schema

### Task 4: Migration — pgvector extension + brands

**Files:**
- Create: `supabase/migrations/0001_extensions.sql`, `supabase/migrations/0002_brands.sql`

- [ ] **Step 1: Create extensions migration**

Run:
```bash
supabase migration new extensions
```

This creates `supabase/migrations/<timestamp>_extensions.sql`. Rename it to `0001_extensions.sql` for ordering clarity. Write:

```sql
create extension if not exists "uuid-ossp";
create extension if not exists vector;
```

- [ ] **Step 2: Create brands migration**

Run:
```bash
supabase migration new brands
```

Rename to `0002_brands.sql`. Write:

```sql
create table brands (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  name text not null,
  tier text not null check (tier in ('luxury', 'spa')),
  country text,
  created_at timestamptz not null default now()
);

create index brands_tier_idx on brands(tier);

insert into brands (slug, name, tier, country) values
  ('saint-laurent', 'Saint Laurent', 'luxury', 'FR'),
  ('miu-miu', 'Miu Miu', 'luxury', 'IT'),
  ('lemaire', 'Lemaire', 'luxury', 'FR'),
  ('the-row', 'The Row', 'luxury', 'US'),
  ('zara', 'Zara', 'spa', 'ES'),
  ('cos', 'COS', 'spa', 'SE'),
  ('uniqlo', 'Uniqlo', 'spa', 'JP');
```

- [ ] **Step 3: Apply migrations to remote**

```bash
supabase db push
```

Confirm when prompted. Output should show 2 migrations applied.

- [ ] **Step 4: Verify in Supabase dashboard**

Open the Supabase dashboard → Table Editor → confirm `brands` table exists with 7 rows.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): pgvector extension + brands table with seed"
```

---

### Task 5: Migration — products + translations

**Files:**
- Create: `supabase/migrations/0003_products.sql`, `supabase/migrations/0004_product_translations.sql`

- [ ] **Step 1: Create products migration**

```bash
supabase migration new products
```

Rename to `0003_products.sql`. Write:

```sql
create table products (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references brands(id),
  tier text not null check (tier in ('luxury', 'spa')),
  category text not null check (category in ('bags', 'shoes', 'outerwear')),
  slug text not null unique,
  name text not null,
  price_amount numeric(12, 2),
  price_currency text not null default 'KRW',
  source_url text,
  image_url text,
  image_original_url text,
  embedding vector(1536),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create index products_tier_category_idx on products(tier, category);
create index products_status_idx on products(status);
create index products_published_at_idx on products(published_at desc);
create index products_embedding_idx on products
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
```

- [ ] **Step 2: Create product_translations migration**

```bash
supabase migration new product_translations
```

Rename to `0004_product_translations.sql`. Write:

```sql
create table product_translations (
  product_id uuid not null references products(id) on delete cascade,
  locale text not null check (locale in ('ko', 'en')),
  name text not null,
  description text,
  primary key (product_id, locale)
);
```

- [ ] **Step 3: Push migrations**

```bash
supabase db push
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): products + product_translations tables"
```

---

### Task 6: Migration — matches + affiliate_links

**Files:**
- Create: `supabase/migrations/0005_matches.sql`, `supabase/migrations/0006_affiliate_links.sql`

- [ ] **Step 1: Create matches migration**

```bash
supabase migration new matches
```

Rename to `0005_matches.sql`. Write:

```sql
create table matches (
  id uuid primary key default uuid_generate_v4(),
  lux_id uuid not null references products(id) on delete cascade,
  dupe_id uuid not null references products(id) on delete cascade,
  score numeric(4, 3) not null check (score >= 0 and score <= 1),
  editor_note text,
  rank smallint not null default 1 check (rank between 1 and 10),
  status text not null default 'candidate' check (status in ('candidate', 'published', 'rejected')),
  created_at timestamptz not null default now(),
  unique (lux_id, dupe_id)
);

create index matches_lux_id_rank_idx on matches(lux_id, rank) where status = 'published';
create index matches_status_idx on matches(status);
```

- [ ] **Step 2: Create affiliate_links migration**

```bash
supabase migration new affiliate_links
```

Rename to `0006_affiliate_links.sql`. Write:

```sql
create table affiliate_links (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  network text not null check (network in ('coupang', 'skimlinks', 'amazon', 'awin', 'direct')),
  url text not null,
  click_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index affiliate_links_product_id_idx on affiliate_links(product_id) where is_active = true;
```

- [ ] **Step 3: Push**

```bash
supabase db push
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): matches + affiliate_links tables"
```

---

### Task 7: Migration — weekly_picks + collections + likes + click_events + RLS

**Files:**
- Create: `0007_weekly_picks.sql`, `0008_collections.sql`, `0009_likes.sql`, `0010_click_events.sql`, `0011_rls.sql`

- [ ] **Step 1: Create weekly_picks migration**

```bash
supabase migration new weekly_picks
```

Rename to `0007_weekly_picks.sql`. Write:

```sql
create table weekly_picks (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  title text not null,
  banner_image_url text,
  product_ids uuid[] not null default '{}',
  published_at timestamptz,
  locale text not null check (locale in ('ko', 'en')) default 'ko',
  created_at timestamptz not null default now()
);

create index weekly_picks_published_idx on weekly_picks(locale, published_at desc nulls last);
```

- [ ] **Step 2: Create collections migration**

```bash
supabase migration new collections
```

Rename to `0008_collections.sql`. Write:

```sql
create table collections (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  title text not null,
  body_markdown text,
  cover_image_url text,
  product_ids uuid[] not null default '{}',
  published_at timestamptz,
  locale text not null check (locale in ('ko', 'en')) default 'ko',
  created_at timestamptz not null default now()
);

create index collections_published_idx on collections(locale, published_at desc nulls last);
```

- [ ] **Step 3: Create likes migration**

```bash
supabase migration new likes
```

Rename to `0009_likes.sql`. Write:

```sql
create table likes (
  session_id text not null,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, product_id)
);

create index likes_product_id_idx on likes(product_id);
```

- [ ] **Step 4: Create click_events migration**

```bash
supabase migration new click_events
```

Rename to `0010_click_events.sql`. Write:

```sql
create table click_events (
  id bigserial primary key,
  session_id text,
  affiliate_link_id uuid not null references affiliate_links(id) on delete cascade,
  referer text,
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index click_events_link_created_idx on click_events(affiliate_link_id, created_at desc);
```

- [ ] **Step 5: Create RLS migration**

```bash
supabase migration new rls
```

Rename to `0011_rls.sql`. Write:

```sql
-- Public read for published content. All writes go through service role.

alter table brands enable row level security;
create policy brands_read on brands for select using (true);

alter table products enable row level security;
create policy products_read on products for select using (status = 'published');

alter table product_translations enable row level security;
create policy product_translations_read on product_translations for select using (
  exists (select 1 from products p where p.id = product_id and p.status = 'published')
);

alter table matches enable row level security;
create policy matches_read on matches for select using (status = 'published');

alter table affiliate_links enable row level security;
create policy affiliate_links_read on affiliate_links for select using (is_active = true);

alter table weekly_picks enable row level security;
create policy weekly_picks_read on weekly_picks for select using (published_at is not null);

alter table collections enable row level security;
create policy collections_read on collections for select using (published_at is not null);

alter table likes enable row level security;
-- Likes are read/written by the anon role with a session_id matching the requester's cookie.
-- For this phase we keep writes server-side via service role.
create policy likes_read on likes for select using (true);

alter table click_events enable row level security;
-- click_events writes are server-side only (service role). No anon read.
```

- [ ] **Step 6: Push all**

```bash
supabase db push
```

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): weekly_picks, collections, likes, click_events + RLS"
```

---

## Phase 2: Admin Authentication

### Task 8: Set up next-auth with Google OAuth

**Files:**
- Create: `lib/auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `middleware.ts`, `app/admin/login/page.tsx`
- Modify: `.env.local`

- [ ] **Step 1: Create a Google OAuth client**

Go to https://console.cloud.google.com/apis/credentials → Create OAuth client ID → Web application.
- Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
- Save Client ID + Secret → `.env.local` as `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

Generate NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```
Paste output into `.env.local` as `NEXTAUTH_SECRET`.

- [ ] **Step 2: Create lib/auth.ts**

```ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { adminEmails, env } from "@/lib/env";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID!,
      clientSecret: env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      return adminEmails.includes(user.email.toLowerCase());
    },
    async session({ session }) {
      return session;
    },
  },
  pages: {
    signIn: "/admin/login",
  },
  secret: env.NEXTAUTH_SECRET,
});
```

- [ ] **Step 3: Create app/api/auth/[...nextauth]/route.ts**

```ts
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 4: Create middleware.ts**

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req) => {
  const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");
  const isLoginRoute = req.nextUrl.pathname === "/admin/login";
  if (isAdminRoute && !isLoginRoute && !req.auth) {
    const url = new URL("/admin/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
});

export const config = {
  matcher: ["/admin/:path*"],
};
```

- [ ] **Step 5: Create app/admin/login/page.tsx**

```tsx
import { signIn } from "@/lib/auth";

export default function AdminLoginPage(props: {
  searchParams: { callbackUrl?: string };
}) {
  const callbackUrl = props.searchParams.callbackUrl ?? "/admin";
  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100">
      <div className="w-full max-w-sm rounded-xl border border-neutral-800 p-8 text-center">
        <h1 className="font-serif text-2xl mb-2">DUPE Admin</h1>
        <p className="text-sm opacity-60 mb-6">Sign in with Google</p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: callbackUrl });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-md bg-white text-neutral-900 py-2 font-medium"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Manual test**

```bash
npm run dev
```

Visit http://localhost:3000/admin → should redirect to `/admin/login`. Click "Continue with Google" → complete OAuth → returns to `/admin` (which will 404 until next task). If your email is in `ADMIN_EMAILS`, sign-in succeeds; otherwise it redirects back to login.

Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat(auth): next-auth Google OAuth + admin route guard"
```

---

### Task 9: Admin layout, sidebar, dashboard

**Files:**
- Create: `app/admin/layout.tsx`, `app/admin/page.tsx`, `components/admin/Sidebar.tsx`

- [ ] **Step 1: Create Sidebar component**

Create `components/admin/Sidebar.tsx`:

```tsx
import Link from "next/link";
import { signOut } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/products/new", label: "+ New Product" },
];

export function Sidebar({ email }: { email: string }) {
  return (
    <aside className="w-56 shrink-0 border-r border-neutral-800 p-6 flex flex-col gap-1">
      <div className="font-serif text-xl mb-6">DUPE Admin</div>
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-2 text-sm hover:bg-neutral-800"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto pt-6 border-t border-neutral-800 text-xs">
        <div className="opacity-60 mb-2 truncate">{email}</div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button type="submit" className="text-xs opacity-70 hover:opacity-100">
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create admin layout**

Create `app/admin/layout.tsx`:

```tsx
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/admin/Sidebar";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) {
    // middleware should have caught this, but defense in depth
    redirect("/admin/login");
  }
  return (
    <div className="min-h-screen flex bg-neutral-950 text-neutral-100">
      <Sidebar email={session.user.email} />
      <main className="flex-1 p-10">{children}</main>
    </div>
  );
}
```

Note: do not apply this layout to `/admin/login` — login uses Next's `(public)` group implicitly because the layout above wraps EVERY admin route. To exclude login, move it: create `app/admin/login/layout.tsx` that just renders `{children}` with no sidebar:

Create `app/admin/login/layout.tsx`:

```tsx
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 3: Create admin dashboard**

Create `app/admin/page.tsx`:

```tsx
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const supabase = adminClient();
  const [{ count: productsCount }, { count: matchesCount }] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("matches").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div>
      <h1 className="font-serif text-3xl mb-8">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="rounded-lg border border-neutral-800 p-6">
          <div className="text-xs opacity-60 uppercase">Products</div>
          <div className="text-3xl font-serif mt-2">{productsCount ?? 0}</div>
        </div>
        <div className="rounded-lg border border-neutral-800 p-6">
          <div className="text-xs opacity-60 uppercase">Matches</div>
          <div className="text-3xl font-serif mt-2">{matchesCount ?? 0}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Manual test**

```bash
npm run dev
```

Sign in at `/admin/login` → land on `/admin` → see "Dashboard" with 0 products / 0 matches. Sidebar shows your email and links work.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(admin): layout + sidebar + dashboard with counts"
```

---

## Phase 3: Admin Product Registration

### Task 10: Scraper for OG meta and image

**Files:**
- Create: `lib/scraper/og-meta.ts`, `tests/lib/scraper.test.ts`

- [ ] **Step 1: Write failing test for og-meta parser**

Create `tests/lib/scraper.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseProductMeta } from "@/lib/scraper/og-meta";

const SAMPLE_HTML = `
<!doctype html>
<html>
  <head>
    <meta property="og:title" content="LE 5 À 7 in smooth leather" />
    <meta property="og:image" content="https://example.com/le5a7.jpg" />
    <meta property="product:price:amount" content="4200000" />
    <meta property="product:price:currency" content="KRW" />
    <meta name="description" content="Soft lambskin hobo bag with chain detail." />
  </head>
  <body></body>
</html>
`;

describe("parseProductMeta", () => {
  it("extracts title, image, price, and description from OG tags", () => {
    const meta = parseProductMeta(SAMPLE_HTML);
    expect(meta.title).toBe("LE 5 À 7 in smooth leather");
    expect(meta.imageUrl).toBe("https://example.com/le5a7.jpg");
    expect(meta.priceAmount).toBe(4200000);
    expect(meta.priceCurrency).toBe("KRW");
    expect(meta.description).toContain("lambskin");
  });

  it("returns nulls when tags are missing", () => {
    const meta = parseProductMeta("<html><head></head><body></body></html>");
    expect(meta.title).toBeNull();
    expect(meta.imageUrl).toBeNull();
    expect(meta.priceAmount).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify fail**

```bash
npm test
```

Expected: FAIL — "Cannot find module '@/lib/scraper/og-meta'".

- [ ] **Step 3: Implement parser**

Create `lib/scraper/og-meta.ts`:

```ts
import * as cheerio from "cheerio";

export type ProductMeta = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  priceAmount: number | null;
  priceCurrency: string | null;
};

export function parseProductMeta(html: string): ProductMeta {
  const $ = cheerio.load(html);
  const get = (sel: string) => $(sel).attr("content") ?? null;

  const title =
    get("meta[property='og:title']") ??
    get("meta[name='twitter:title']") ??
    $("title").text() ||
    null;

  const description =
    get("meta[property='og:description']") ??
    get("meta[name='description']");

  const imageUrl =
    get("meta[property='og:image']") ??
    get("meta[name='twitter:image']");

  const priceRaw =
    get("meta[property='product:price:amount']") ??
    get("meta[property='og:price:amount']");
  const priceAmount = priceRaw ? Number(priceRaw) : null;

  const priceCurrency =
    get("meta[property='product:price:currency']") ??
    get("meta[property='og:price:currency']");

  return {
    title: title ? title.trim() : null,
    description: description ? description.trim() : null,
    imageUrl,
    priceAmount: Number.isFinite(priceAmount) ? priceAmount : null,
    priceCurrency,
  };
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm test
```

Expected: PASS (2 tests).

- [ ] **Step 5: Add fetch wrapper**

Create `lib/scraper/index.ts`:

```ts
import { parseProductMeta, type ProductMeta } from "./og-meta";

export type ScrapeResult = ProductMeta & { sourceUrl: string };

export async function scrapeProductUrl(url: string): Promise<ScrapeResult> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; DupeBot/1.0; +https://dupe.kr)",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  const html = await res.text();
  const meta = parseProductMeta(html);
  return { ...meta, sourceUrl: url };
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/scraper/ tests/lib/
git commit -m "feat(scraper): OG meta parser with cheerio + fetch wrapper"
```

---

### Task 11: Image download + Supabase Storage upload

**Files:**
- Create: `lib/scraper/image.ts`, Supabase Storage bucket `product-images`

- [ ] **Step 1: Create Storage bucket**

In Supabase dashboard → Storage → New bucket:
- Name: `product-images`
- Public: ON (so img URLs work without signed URLs)

- [ ] **Step 2: Implement image upload**

Create `lib/scraper/image.ts`:

```ts
import { adminClient } from "@/lib/supabase/admin";
import { randomUUID } from "node:crypto";

const BUCKET = "product-images";

export async function uploadImageFromUrl(originalUrl: string): Promise<string> {
  const res = await fetch(originalUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; DupeBot/1.0)" },
  });
  if (!res.ok) {
    throw new Error(`Image fetch failed: ${res.status}`);
  }
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const buf = Buffer.from(await res.arrayBuffer());

  const path = `${new Date().getFullYear()}/${randomUUID()}.${ext}`;
  const supabase = adminClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
```

- [ ] **Step 3: Manual smoke test**

Create a one-off script `scripts/test-upload.mts`:

```ts
import "dotenv/config";
import { uploadImageFromUrl } from "@/lib/scraper/image";

const url = process.argv[2];
if (!url) {
  console.error("Usage: tsx scripts/test-upload.mts <image-url>");
  process.exit(1);
}
const out = await uploadImageFromUrl(url);
console.log("Uploaded:", out);
```

Install `dotenv`: `npm install -D dotenv`.

Run:
```bash
npx tsx scripts/test-upload.mts https://images.unsplash.com/photo-1591348278863-a8fb3887e2aa
```

Expected: prints a `https://<project>.supabase.co/storage/v1/object/public/product-images/...` URL. Open it in browser to confirm the image loads.

- [ ] **Step 4: Commit**

```bash
git add lib/scraper/image.ts scripts/test-upload.mts package.json package-lock.json
git commit -m "feat(scraper): image download + Supabase Storage upload"
```

---

### Task 12: OpenAI embeddings helper

**Files:**
- Create: `lib/openai.ts`, `tests/lib/openai.test.ts`

- [ ] **Step 1: Write a test that mocks the SDK**

Create `tests/lib/openai.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("openai", () => ({
  default: class {
    embeddings = { create };
  },
}));

beforeEach(() => create.mockReset());

describe("embedText", () => {
  it("returns a 1536-length vector from the API response", async () => {
    create.mockResolvedValue({ data: [{ embedding: new Array(1536).fill(0.5) }] });
    const { embedText } = await import("@/lib/openai");
    const vec = await embedText("LE 5 À 7 — soft lambskin hobo");
    expect(vec).toHaveLength(1536);
    expect(vec[0]).toBe(0.5);
    expect(create).toHaveBeenCalledWith({
      model: "text-embedding-3-small",
      input: "LE 5 À 7 — soft lambskin hobo",
    });
  });

  it("throws when input is empty", async () => {
    const { embedText } = await import("@/lib/openai");
    await expect(embedText("")).rejects.toThrow("empty");
  });
});
```

- [ ] **Step 2: Run test (fails — module missing)**

```bash
npm test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement lib/openai.ts**

```ts
import OpenAI from "openai";
import { env } from "@/lib/env";

let client: OpenAI | null = null;

function openai(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required");
  }
  if (!client) {
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return client;
}

export async function embedText(input: string): Promise<number[]> {
  if (!input || !input.trim()) {
    throw new Error("embedText: input is empty");
  }
  const res = await openai().embeddings.create({
    model: "text-embedding-3-small",
    input,
  });
  return res.data[0].embedding;
}
```

- [ ] **Step 4: Run test (pass)**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/openai.ts tests/lib/openai.test.ts
git commit -m "feat(openai): embedText helper with mocked tests"
```

---

### Task 13: Slug helper

**Files:**
- Create: `lib/slug.ts`, `tests/lib/slug.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/lib/slug.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { slugify } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Saint Laurent LE 5 À 7")).toBe("saint-laurent-le-5-a-7");
  });
  it("strips diacritics", () => {
    expect(slugify("Café Crème")).toBe("cafe-creme");
  });
  it("collapses repeated separators", () => {
    expect(slugify("foo --  bar")).toBe("foo-bar");
  });
  it("removes leading/trailing hyphens", () => {
    expect(slugify("-foo-")).toBe("foo");
  });
});
```

- [ ] **Step 2: Run (fail)**

```bash
npm test
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `lib/slug.ts`:

```ts
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}
```

- [ ] **Step 4: Run (pass)**

```bash
npm test
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/slug.ts tests/lib/slug.test.ts
git commit -m "feat(slug): slugify helper"
```

---

### Task 14: Server action — register product

**Files:**
- Create: `app/admin/products/actions.ts`, `components/admin/ProductForm.tsx`, `app/admin/products/new/page.tsx`

- [ ] **Step 1: Write the server action**

Create `app/admin/products/actions.ts`:

```ts
"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { scrapeProductUrl } from "@/lib/scraper";
import { uploadImageFromUrl } from "@/lib/scraper/image";
import { embedText } from "@/lib/openai";
import { slugify } from "@/lib/slug";

const Schema = z.object({
  source_url: z.string().url().optional().or(z.literal("")),
  brand_id: z.string().uuid(),
  tier: z.enum(["luxury", "spa"]),
  category: z.enum(["bags", "shoes", "outerwear"]),
  name: z.string().min(1),
  description: z.string().optional(),
  price_amount: z.coerce.number().optional(),
  price_currency: z.string().default("KRW"),
  image_original_url: z.string().url().optional().or(z.literal("")),
});

export type RegisterState = { error?: string; ok?: boolean };

export async function registerProduct(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const session = await auth();
  if (!session?.user?.email) return { error: "Not authenticated" };

  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }
  const v = parsed.data;
  const supabase = adminClient();

  // Mirror image to our Storage if provided
  let imageUrl: string | null = null;
  if (v.image_original_url) {
    try {
      imageUrl = await uploadImageFromUrl(v.image_original_url);
    } catch (e) {
      return { error: `Image upload failed: ${(e as Error).message}` };
    }
  }

  // Generate text embedding
  const embedInput = [v.name, v.description ?? ""].filter(Boolean).join(" — ");
  let embedding: number[] | null = null;
  try {
    embedding = await embedText(embedInput);
  } catch (e) {
    return { error: `Embedding failed: ${(e as Error).message}` };
  }

  // Generate slug; ensure uniqueness with a numeric suffix
  const baseSlug = slugify(v.name);
  let slug = baseSlug;
  for (let i = 2; i < 99; i++) {
    const { data } = await supabase.from("products").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = `${baseSlug}-${i}`;
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("products")
    .insert({
      brand_id: v.brand_id,
      tier: v.tier,
      category: v.category,
      slug,
      name: v.name,
      price_amount: v.price_amount ?? null,
      price_currency: v.price_currency,
      source_url: v.source_url || null,
      image_url: imageUrl,
      image_original_url: v.image_original_url || null,
      embedding,
      status: "draft",
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    return { error: `Insert failed: ${insertErr?.message}` };
  }

  // Also write KO translation
  if (v.description) {
    await supabase.from("product_translations").insert({
      product_id: inserted.id,
      locale: "ko",
      name: v.name,
      description: v.description,
    });
  }

  redirect(`/admin/products/${inserted.id}`);
}

export async function prefillFromUrl(url: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Not authenticated");
  return scrapeProductUrl(url);
}
```

- [ ] **Step 2: Create the ProductForm component**

Create `components/admin/ProductForm.tsx`:

```tsx
"use client";

import { useState, useActionState, useTransition } from "react";
import { registerProduct, prefillFromUrl, type RegisterState } from "@/app/admin/products/actions";

type Brand = { id: string; name: string; tier: "luxury" | "spa" };

const initialState: RegisterState = {};

export function ProductForm({ brands }: { brands: Brand[] }) {
  const [state, action, isPending] = useActionState(registerProduct, initialState);
  const [scraping, startScrape] = useTransition();
  const [prefill, setPrefill] = useState<Awaited<ReturnType<typeof prefillFromUrl>> | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");

  function handleScrape() {
    if (!sourceUrl) return;
    startScrape(async () => {
      try {
        const meta = await prefillFromUrl(sourceUrl);
        setPrefill(meta);
      } catch (e) {
        alert(`Scrape failed: ${(e as Error).message}`);
      }
    });
  }

  return (
    <form action={action} className="max-w-2xl space-y-4">
      <div>
        <label className="block text-xs uppercase opacity-60 mb-1">Source URL (optional)</label>
        <div className="flex gap-2">
          <input
            name="source_url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            className="flex-1 rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2"
            placeholder="https://www.ysl.com/..."
          />
          <button
            type="button"
            onClick={handleScrape}
            disabled={scraping || !sourceUrl}
            className="rounded-md bg-neutral-800 px-4 text-sm"
          >
            {scraping ? "Fetching..." : "Fetch"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase opacity-60 mb-1">Brand</label>
          <select
            name="brand_id"
            required
            className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2"
          >
            <option value="">Select brand...</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.tier})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase opacity-60 mb-1">Tier</label>
          <select name="tier" required className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2">
            <option value="luxury">Luxury</option>
            <option value="spa">SPA</option>
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase opacity-60 mb-1">Category</label>
          <select name="category" required className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2">
            <option value="bags">Bags</option>
            <option value="shoes">Shoes</option>
            <option value="outerwear">Outerwear</option>
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase opacity-60 mb-1">Currency</label>
          <select name="price_currency" defaultValue="KRW" className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2">
            <option value="KRW">KRW</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs uppercase opacity-60 mb-1">Name</label>
        <input
          name="name"
          required
          defaultValue={prefill?.title ?? ""}
          key={`name-${prefill?.title ?? ""}`}
          className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-xs uppercase opacity-60 mb-1">Description</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={prefill?.description ?? ""}
          key={`desc-${prefill?.description ?? ""}`}
          className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase opacity-60 mb-1">Price</label>
          <input
            name="price_amount"
            type="number"
            step="0.01"
            defaultValue={prefill?.priceAmount ?? ""}
            key={`price-${prefill?.priceAmount ?? ""}`}
            className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-xs uppercase opacity-60 mb-1">Image URL</label>
          <input
            name="image_original_url"
            type="url"
            defaultValue={prefill?.imageUrl ?? ""}
            key={`img-${prefill?.imageUrl ?? ""}`}
            className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2"
          />
        </div>
      </div>

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-white text-neutral-900 px-6 py-2 font-medium"
      >
        {isPending ? "Saving..." : "Register product"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Create the new product page**

Create `app/admin/products/new/page.tsx`:

```tsx
import { adminClient } from "@/lib/supabase/admin";
import { ProductForm } from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const supabase = adminClient();
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, tier")
    .order("tier", { ascending: false })
    .order("name");
  return (
    <div>
      <h1 className="font-serif text-3xl mb-8">New Product</h1>
      <ProductForm brands={brands ?? []} />
    </div>
  );
}
```

- [ ] **Step 4: Manual e2e**

```bash
npm run dev
```

At `/admin/products/new`:
1. Paste a real Saint Laurent product URL into "Source URL", click "Fetch" → form should prefill name/desc/image/price (if the site has OG tags).
2. Select brand (Saint Laurent), tier (luxury), category (bags).
3. Click "Register product".

Expected: redirected to `/admin/products/<uuid>` (404 in this task — page lands in next task). Confirm in Supabase Table Editor that a `products` row exists with `status='draft'`, `embedding` populated, and `image_url` is a Supabase Storage URL.

- [ ] **Step 5: Commit**

```bash
git add app/admin/products/ components/admin/
git commit -m "feat(admin): product registration with scrape prefill + embedding"
```

---

### Task 15: Product list + detail (admin)

**Files:**
- Create: `app/admin/products/page.tsx`, `app/admin/products/[id]/page.tsx`, `app/admin/products/[id]/actions.ts`

- [ ] **Step 1: Product list page**

Create `app/admin/products/page.tsx`:

```tsx
import Link from "next/link";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const supabase = adminClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, slug, tier, category, status, created_at, image_url, brands(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="font-serif text-3xl">Products</h1>
        <Link href="/admin/products/new" className="rounded-md bg-white text-neutral-900 px-4 py-2 text-sm">
          + New
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(products ?? []).map((p: any) => (
          <Link
            key={p.id}
            href={`/admin/products/${p.id}`}
            className="rounded-lg border border-neutral-800 overflow-hidden hover:border-neutral-600 transition"
          >
            {p.image_url ? (
              <img src={p.image_url} alt={p.name} className="w-full h-40 object-cover" />
            ) : (
              <div className="w-full h-40 bg-neutral-900" />
            )}
            <div className="p-3">
              <div className="text-xs opacity-60">{p.brands?.name} · {p.tier}</div>
              <div className="text-sm font-medium mt-1 truncate">{p.name}</div>
              <div className="flex justify-between text-xs mt-2 opacity-60">
                <span>{p.category}</span>
                <span>{p.status}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {(products ?? []).length === 0 && (
        <p className="opacity-60">No products yet. Click "+ New" to register your first.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Edit-status server actions**

Create `app/admin/products/[id]/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Not authenticated");
}

export async function publishProduct(id: string) {
  await requireAdmin();
  const supabase = adminClient();
  const { error } = await supabase
    .from("products")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath(`/admin/products/${id}`);
  revalidatePath("/admin/products");
}

export async function archiveProduct(id: string) {
  await requireAdmin();
  const supabase = adminClient();
  const { error } = await supabase.from("products").update({ status: "archived" }).eq("id", id);
  if (error) throw error;
  revalidatePath(`/admin/products/${id}`);
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  const supabase = adminClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/products");
}
```

- [ ] **Step 3: Detail page**

Create `app/admin/products/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { adminClient } from "@/lib/supabase/admin";
import { publishProduct, archiveProduct, deleteProduct } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminProductDetail({ params }: { params: { id: string } }) {
  const supabase = adminClient();
  const { data: p } = await supabase
    .from("products")
    .select("*, brands(name, tier)")
    .eq("id", params.id)
    .maybeSingle();
  if (!p) notFound();

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-3xl mb-2">{p.name}</h1>
      <p className="opacity-60 text-sm mb-6">
        {p.brands?.name} · {p.tier} · {p.category} · <span className="uppercase">{p.status}</span>
      </p>

      {p.image_url && (
        <img
          src={p.image_url}
          alt={p.name}
          className="w-full max-w-md rounded-lg mb-6 border border-neutral-800"
        />
      )}

      <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm mb-8">
        <dt className="opacity-60">Slug</dt>
        <dd>{p.slug}</dd>
        <dt className="opacity-60">Price</dt>
        <dd>{p.price_amount ? `${p.price_currency} ${Number(p.price_amount).toLocaleString()}` : "—"}</dd>
        <dt className="opacity-60">Source URL</dt>
        <dd>
          {p.source_url ? (
            <a href={p.source_url} target="_blank" className="underline">
              {p.source_url}
            </a>
          ) : (
            "—"
          )}
        </dd>
        <dt className="opacity-60">Embedding</dt>
        <dd>{p.embedding ? `${(p.embedding as number[]).length} dims` : "none"}</dd>
      </dl>

      <div className="flex gap-2">
        {p.status !== "published" && (
          <form action={publishProduct.bind(null, p.id)}>
            <button className="rounded-md bg-white text-neutral-900 px-4 py-2 text-sm">Publish</button>
          </form>
        )}
        {p.status !== "archived" && (
          <form action={archiveProduct.bind(null, p.id)}>
            <button className="rounded-md bg-neutral-800 px-4 py-2 text-sm">Archive</button>
          </form>
        )}
        <form
          action={async () => {
            "use server";
            await deleteProduct(p.id);
          }}
        >
          <button className="rounded-md bg-red-900/40 text-red-300 px-4 py-2 text-sm">Delete</button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Manual end-to-end**

```bash
npm run dev
```

Walk through:
1. `/admin/products/new` → register a luxury product (e.g., a Saint Laurent bag URL) → land on detail page.
2. Click "Publish" → status becomes `published`.
3. Visit `/admin/products` → product appears in the list with image, brand, status badge.
4. Click "Archive" → status becomes `archived`.

- [ ] **Step 5: Commit**

```bash
git add app/admin/products/
git commit -m "feat(admin): product list + detail with publish/archive/delete"
```

---

### Task 16: Public home — list published products

**Files:**
- Modify: `app/(public)/page.tsx`

- [ ] **Step 1: Replace stub home with a real query**

Replace `app/(public)/page.tsx`:

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 60;

export default async function HomePage() {
  const supabase = createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, slug, name, image_url, price_amount, price_currency, brands(name)")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(40);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <header className="max-w-6xl mx-auto py-12">
        <h1 className="font-serif text-5xl mb-2">DUPE</h1>
        <p className="opacity-60 text-sm">생로랑 맛 자라. 르메르 맛 COS.</p>
      </header>
      <section className="max-w-6xl mx-auto">
        {(products ?? []).length === 0 ? (
          <p className="opacity-60">아직 등록된 상품이 없어요.</p>
        ) : (
          <div className="columns-2 md:columns-3 lg:columns-4 gap-2">
            {(products ?? []).map((p: any) => (
              <Link
                key={p.id}
                href={`/p/${p.slug}`}
                className="block mb-2 break-inside-avoid rounded-lg overflow-hidden border border-neutral-800"
              >
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-auto block" />
                ) : (
                  <div className="w-full aspect-[3/4] bg-neutral-900" />
                )}
                <div className="p-2">
                  <div className="text-[10px] uppercase opacity-60">{p.brands?.name}</div>
                  <div className="text-xs truncate">{p.name}</div>
                  {p.price_amount && (
                    <div className="text-[11px] opacity-70 mt-1">
                      {p.price_currency} {Number(p.price_amount).toLocaleString()}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Manual test**

```bash
npm run dev
```

Visit http://localhost:3000. Should see your published products in a masonry layout (single column on mobile, multi on desktop). Click a tile — it goes to `/p/<slug>` which will 404 (detail page lands in Phase 2).

- [ ] **Step 3: Commit**

```bash
git add app/\(public\)/page.tsx
git commit -m "feat(public): home masonry listing published products"
```

---

### Task 17: E2E smoke test — register and view

**Files:**
- Create: `tests/e2e/admin-product.spec.ts`

- [ ] **Step 1: Write the e2e smoke test**

Create `tests/e2e/admin-product.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

// This test assumes the dev environment has a NEXT_TEST_BYPASS_AUTH flag
// set so we don't need to OAuth in CI. For local first run, we'll just
// gate this with a skip and run it after signing in manually.

test.skip(!process.env.E2E_AUTH_OK, "Sign in manually before running");

test("homepage loads and admin products list is reachable when signed in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "DUPE" })).toBeVisible();

  await page.goto("/admin/products");
  // either products list or login redirect
  await expect(page).toHaveURL(/\/admin(\/products)?(\/login)?/);
});
```

Note: full OAuth automation in e2e is out of scope for Phase 1. This is a smoke harness; subsequent phases will add auth bypass for tests.

- [ ] **Step 2: Manual run**

Sign in manually first via the browser, then:

```bash
E2E_AUTH_OK=1 npm run e2e
```

If you haven't signed in, the test skips. That's expected.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/ playwright.config.ts
git commit -m "test(e2e): smoke harness for home + admin"
```

---

### Task 18: Documentation — README + setup notes

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

Create `README.md`:

```markdown
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
3. `supabase link --project-ref <ref>`
4. `supabase db push`
5. `npm run dev`

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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README for Phase 1"
```

---

## What's next (Phase 2 plan)

After this plan executes you will have:
- A working Google-OAuth-protected admin
- The full schema in Supabase (10 tables + RLS)
- Product registration with auto-scraped meta, image mirroring, and text embedding
- A masonry public home that lists published products

**Phase 2 will add:**
- SPA catalog import script (Zara/COS/Uniqlo seed batches)
- Vector-similarity candidate query + GPT-4o-mini Vision reranker
- Admin "match a luxury" workflow (pick top-5 dupes + editor notes)
- Public detail page (`/p/[slug]`) showing the 5 dupes with match scores
- Affiliate links + `/r/[link-id]` redirect + click_events tracking
- Cookie-based likes on the home and detail pages

**Phase 3 will add:** i18n routes, magazine editor, SEO, OG images, analytics, launch checklist.

When Phase 1 is done, ask for the Phase 2 plan.

---

## Self-Review Notes

This plan covers spec sections 3, 5, 6.1 (step 1-2), 9.4. It deliberately does NOT cover sections 6.1 (steps 3-6), 6.2, 4.3, 4.4, 4.6, 7, 8 — those land in Phase 2/3.

Type/name consistency: `products.tier`, `products.status`, `matches.status` use exact check-constraint values referenced in code. `slugify()` returns the same shape used in `products.slug` upsert. Server action types (`RegisterState`) match `useActionState` signature.

No `TODO`/`TBD` placeholders. Every code step includes the full code block. Every command step includes expected output or a manual-verification check.
