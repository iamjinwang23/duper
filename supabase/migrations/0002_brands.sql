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
