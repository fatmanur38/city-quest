-- ---------------------------------------------------------------------------------------------
-- Ticket prices the municipality can change without a redeploy.
--
-- Only overrides are stored. An activity with no row here keeps the price from the catalogue in
-- src/server/catalog.ts, so an empty table is a valid state and the demo works before anyone has
-- touched the admin console.
--
-- Lira, charged through ordinary payment rails. Deliberately not on-chain: a price in a contract
-- would make this a token project, which is the one thing it is not.
-- ---------------------------------------------------------------------------------------------
create table if not exists activity_prices (
  activity_slug text primary key,
  price_try     integer not null check (price_try >= 0),
  updated_at    timestamptz not null default now()
);

-- Written only by the server with the service-role key, which bypasses RLS. Enabling it anyway
-- means an accidentally leaked anon key still cannot read or rewrite the city's prices.
alter table activity_prices enable row level security;
