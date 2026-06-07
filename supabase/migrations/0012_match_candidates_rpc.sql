-- Cosine-similarity candidate retrieval for dupe matching.
-- Given a luxury product, return same-category SPA products ranked by
-- vector similarity (higher = closer). Uses the IVFFlat cosine index on
-- products.embedding (products_embedding_idx, created in 0003_products.sql).

create or replace function match_spa_candidates_for(
  lux_id uuid,
  match_limit int default 20
)
returns table (
  id uuid,
  name text,
  slug text,
  image_url text,
  price_amount numeric,
  price_currency text,
  similarity double precision
)
language sql
stable
as $$
  select
    p.id,
    p.name,
    p.slug,
    p.image_url,
    p.price_amount,
    p.price_currency,
    1 - (p.embedding <=> lux.embedding) as similarity
  from products p
  cross join (
    select embedding, category
    from products
    where id = lux_id
  ) lux
  -- No status filter on candidates: SPA products stay 'draft' until an admin
  -- confirms a match (confirmMatches publishes them), so matching must see drafts.
  where p.tier = 'spa'
    and p.category = lux.category
    and p.embedding is not null
    and lux.embedding is not null
    and p.id <> lux_id
  order by p.embedding <=> lux.embedding
  limit match_limit;
$$;

-- Allow the service role (admin operations) to execute it.
grant execute on function match_spa_candidates_for(uuid, int) to service_role;
