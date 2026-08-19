-- Emoji out, named icons in.
--
-- Emoji were rendered by whatever operating system happened to be reading them, so the same
-- campaign looked different on the librarian's desktop and the student's phone, and they could
-- never take a colour from the palette. These columns now hold a name from the app's own icon
-- vocabulary (web/src/lib/icons.ts), which is a closed set the interface can always draw.

alter table sponsors rename column emoji to icon;
alter table sponsor_offers rename column emoji to icon;

alter table sponsors alter column icon set default 'store';
alter table sponsor_offers alter column icon set default 'gift';

-- Existing rows carry emoji. Map the ones this deployment actually shipped, and fall back to
-- the default rather than leaving a value the interface cannot draw.
update sponsors
   set icon = case icon
                when '🏪' then 'store'
                when '☕' then 'coffee'
                when '🏢' then 'building'
                else 'store'
              end
 where icon !~ '^[a-zA-Z]+$';

update sponsor_offers
   set icon = case icon
                when '🎁' then 'gift'
                when '☕' then 'coffee'
                when '🍪' then 'croissant'
                when '🍕' then 'pizza'
                when '🎫' then 'ticket'
                else 'gift'
              end
 where icon !~ '^[a-zA-Z]+$';

-- Avatars are now drawn from the wallet address in the interface, so nothing writes this any
-- more. The column stays, and stays nullable-by-default, so existing rows are untouched and an
-- older deployment reading this database still finds what it expects.
alter table profiles alter column avatar_emoji set default '';
