create table public.transactions (
  id uuid not null default gen_random_uuid (),
  user_id uuid null default gen_random_uuid (),
  title text null,
  amount numeric null,
  type text null,
  created_at timestamp without time zone null default now(),
  constraint transactions_pkey primary key (id)
) TABLESPACE pg_default;