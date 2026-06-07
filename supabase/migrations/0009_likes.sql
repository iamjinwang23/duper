create table likes (
  session_id text not null,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, product_id)
);

create index likes_product_id_idx on likes(product_id);
