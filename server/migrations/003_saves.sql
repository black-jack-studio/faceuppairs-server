-- Game save (levels, stars, coins, boosters, packs…) so a reinstall or a new phone gets the
-- progress back. The account itself already survives a reinstall (iOS Keychain). Opaque to the
-- server: the app owns its format, the server only stores the latest copy.
create table if not exists player_saves (
  player_id uuid primary key references players (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null
);
