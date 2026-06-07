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
