-- ---------------------------------------------------------------------------------------------
-- Businesses that reward verified learning.
--
-- A sponsor is deliberately not an institution. It issues nothing, holds no signing key and
-- appears nowhere in the registry contract. It only reads achievements that institutions have
-- already vouched for, and decides on its own terms that they are worth a coffee.
--
-- That asymmetry is the argument for the whole project: a cafe should be able to trust a
-- library's word without the cafe, the library and the city app having to be one organisation.
-- ---------------------------------------------------------------------------------------------
create table if not exists sponsors (
  slug        text primary key,
  name        text not null,
  emoji       text not null default '🏪',
  -- DEMO MOCK. Real staff accounts replace this; see src/server/session.ts.
  access_code text not null,
  -- Joining the ecosystem is not the same as being trusted by it: the municipality approves a
  -- business before its offers become visible to citizens.
  approved    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- What a business asks for in return.
--
-- requirement is one of:
--   {"kind":"credential","credential":"YOUNG_SCIENTIST"}
--   {"kind":"visits","activitySlug":"library-daily-visit","count":5}
--
-- The first is the strong form: the achievement is on-chain, so the business can verify it
-- itself without taking the city app's word for anything. The second is counted by the app from
-- its own records, which is weaker -- and the interface says so rather than pretending otherwise.
-- ---------------------------------------------------------------------------------------------
create table if not exists sponsor_offers (
  slug         text primary key,
  sponsor_slug text not null references sponsors(slug) on delete cascade,
  title        text not null,
  description  text not null default '',
  emoji        text not null default '🎁',
  requirement  jsonb not null,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists sponsor_offers_sponsor_idx on sponsor_offers (sponsor_slug);

-- Written only by the server with the service-role key, which bypasses RLS. Enabling it anyway
-- means a leaked anon key cannot read access codes or publish offers in a business's name.
alter table sponsors enable row level security;
alter table sponsor_offers enable row level security;
