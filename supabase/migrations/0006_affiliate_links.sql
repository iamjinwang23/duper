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
