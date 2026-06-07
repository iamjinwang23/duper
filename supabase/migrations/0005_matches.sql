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
