-- Run this in your Supabase SQL editor
-- Go to: https://supabase.com/dashboard → your project → SQL Editor

create table if not exists expenses (
  id            uuid primary key default gen_random_uuid(),
  telegram_user_id text not null,
  amount        numeric(12, 2) not null,
  currency      text not null default 'ARS',
  merchant      text,
  category      text not null default 'Other',
  description   text,
  date          date not null,
  created_at    timestamptz not null default now()
);

-- Index for fast per-user queries
create index if not exists expenses_user_date
  on expenses (telegram_user_id, date desc);

-- Optional: Row Level Security (good practice)
alter table expenses enable row level security;

-- Since we use the service role key from the backend, this policy
-- allows full access via the service role (your Node server)
create policy "service role full access"
  on expenses
  using (true)
  with check (true);
