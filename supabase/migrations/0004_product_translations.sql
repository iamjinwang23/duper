create table product_translations (
  product_id uuid not null references products(id) on delete cascade,
  locale text not null check (locale in ('ko', 'en')),
  name text not null,
  description text,
  primary key (product_id, locale)
);
