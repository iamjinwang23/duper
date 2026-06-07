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
