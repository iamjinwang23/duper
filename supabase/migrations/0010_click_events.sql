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
