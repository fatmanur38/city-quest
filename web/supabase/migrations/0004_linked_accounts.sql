-- Linking an external identity to a city account.
--
-- Why a table at all, when Google accounts are otherwise derived: someone who started with a
-- device account already has achievements bound to that address, and those achievements are
-- soulbound -- they cannot be moved to the address their Google identity would derive to. So
-- linking has to work the other way round: the identity is pointed at the account that already
-- exists, rather than the account being recreated from the identity.
--
-- Note what is stored: the provider's opaque user id, and nothing else. Not the email address,
-- not the name, not the profile picture. The id is meaningless outside Google, and it is all
-- that is needed to recognise a returning person. Some of our users are children.
create table if not exists linked_accounts (
  provider          text not null check (provider in ('google')),
  provider_user_id  text not null,
  wallet            text not null references profiles (wallet) on delete cascade,
  created_at        timestamptz not null default now(),
  primary key (provider, provider_user_id)
);

-- One account per identity, in both directions. The primary key stops one Google account from
-- claiming two city accounts; this stops two Google accounts from claiming the same one.
create unique index if not exists linked_accounts_wallet_idx
  on linked_accounts (provider, wallet);

alter table linked_accounts enable row level security;
