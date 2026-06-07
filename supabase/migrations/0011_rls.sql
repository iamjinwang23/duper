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
