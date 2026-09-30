-- Players are anonymous: an id and a hashed secret token issued by the server, nothing else.
create table if not exists players (
  id uuid primary key,
  token_hash text not null,
  -- Shown to other players to identify a row (reports); the id itself is never exposed.
  public_ref text not null unique,
  nickname text,
  nickname_changed_at timestamptz,
  -- Set by moderation: the nickname is replaced by "Joueur####" everywhere.
  moderated boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create unique index if not exists players_nickname_lower on players (lower(nickname));

-- One row per started ranked run. The seed is chosen here, never by the client.
create table if not exists runs (
  id uuid primary key,
  player_id uuid not null references players (id) on delete cascade,
  mode text not null check (mode in ('endless', 'daily')),
  seed bigint not null,
  day date,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'started' check (status in ('started', 'accepted', 'rejected')),
  score integer,
  reject_reason text
);
create index if not exists runs_player on runs (player_id, started_at desc);
create unique index if not exists runs_daily_once on runs (player_id, day) where mode = 'daily' and status = 'accepted';

-- Best score per player per board: "endless", "week:2026-W40", "daily:2026-09-30".
create table if not exists best_scores (
  board text not null,
  player_id uuid not null references players (id) on delete cascade,
  score integer not null,
  achieved_at timestamptz not null,
  primary key (board, player_id)
);
-- Rank = rows ahead of you on this index; ties go to whoever got there first.
create index if not exists best_scores_rank on best_scores (board, score desc, achieved_at asc);

create table if not exists reports (
  reporter_id uuid not null references players (id) on delete cascade,
  target_id uuid not null references players (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reporter_id, target_id)
);

create table if not exists schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);
