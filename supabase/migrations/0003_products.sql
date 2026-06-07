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
