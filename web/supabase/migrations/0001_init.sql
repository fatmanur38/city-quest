-- CityQuest schema.
--
-- What lives here: experience points, streak inputs, quiz results, ticket orders, coupons.
-- What deliberately does NOT live here: any proof that an institution vouched for a citizen.
-- That proof belongs on-chain, because it has to stay verifiable when this database is gone or
-- when an institution outside this deployment wants to check it.
--
-- What also deliberately does not live here: full names, ages, schools, phone numbers, email
-- addresses, home addresses, or location history. Some of our users are children.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------------------------
-- Citizens
-- ---------------------------------------------------------------------------------------------

create table if not exists profiles (
  wallet        text primary key check (wallet = lower(wallet) and wallet ~ '^0x[0-9a-f]{40}$'),
  display_name  text not null check (char_length(display_name) between 1 and 40),
  avatar_emoji  text not null default '🦊',
  xp            integer not null default 0 check (xp >= 0),
  created_at    timestamptz not null default now()
);

create index if not exists profiles_xp_idx on profiles (xp desc);

-- Atomic so two simultaneous check-ins cannot lose points to a lost update.
create or replace function increment_xp(p_wallet text, p_amount integer)
returns setof profiles
language sql
as $$
  update profiles
     set xp = xp + p_amount
   where wallet = p_wallet
  returning *;
$$;

-- ---------------------------------------------------------------------------------------------
-- Verified activity, mirrored off-chain
-- ---------------------------------------------------------------------------------------------

-- The blockchain is the authority on whether an activity was verified. This table exists so the
-- app can render history, streaks and leaderboards without replaying the chain on every request.
--
-- The unique constraint mirrors the contract's record key: one completion per citizen, per
-- activity, per period. It is a convenience, not the security boundary -- the contract enforces
-- the same rule where it actually matters.
create table if not exists activity_completions (
  id                uuid primary key default gen_random_uuid(),
  wallet            text not null references profiles (wallet) on delete cascade,
  activity_slug     text not null,
  institution_slug  text not null,
  period_key        text not null,
  xp_awarded        integer not null default 0,
  tx_hash           text,
  created_at        timestamptz not null default now(),
  unique (wallet, activity_slug, period_key)
);

create index if not exists completions_wallet_idx on activity_completions (wallet, created_at desc);
create index if not exists completions_institution_idx
  on activity_completions (institution_slug, created_at desc);

-- ---------------------------------------------------------------------------------------------
-- Tickets
-- ---------------------------------------------------------------------------------------------

-- Payment happens through ordinary payment infrastructure, in ordinary currency. This row is the
-- order record; the pass itself, and whether it has been spent, lives on-chain.
create table if not exists ticket_orders (
  id              uuid primary key default gen_random_uuid(),
  wallet          text not null references profiles (wallet) on delete cascade,
  activity_slug   text not null,
  pass_id         text not null unique,
  price_try       integer not null check (price_try >= 0),
  status          text not null default 'valid' check (status in ('valid', 'used', 'cancelled')),
  issue_tx_hash   text,
  consume_tx_hash text,
  created_at      timestamptz not null default now()
);

create index if not exists ticket_orders_wallet_idx on ticket_orders (wallet, created_at desc);

-- ---------------------------------------------------------------------------------------------
-- Sponsor rewards
-- ---------------------------------------------------------------------------------------------

-- A sponsor rewards verified behaviour with an ordinary coupon. No token, no transfer, no
-- exchange rate between learning and money.
create table if not exists reward_claims (
  id          uuid primary key default gen_random_uuid(),
  wallet      text not null references profiles (wallet) on delete cascade,
  reward_slug text not null,
  coupon_code text not null,
  created_at  timestamptz not null default now(),
  unique (wallet, reward_slug)
);

-- ---------------------------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------------------------

-- Every write in this app arrives through a server route that has already checked either a
-- session signature or an institution's authority, using the service role key. No browser talks
-- to Postgres directly, so the anon role is given nothing.
alter table profiles             enable row level security;
alter table activity_completions enable row level security;
alter table ticket_orders        enable row level security;
alter table reward_claims        enable row level security;

-- Public, non-identifying leaderboard data only.
drop policy if exists profiles_public_read on profiles;
create policy profiles_public_read on profiles for select using (true);
