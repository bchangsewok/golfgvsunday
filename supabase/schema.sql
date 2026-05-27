-- GolfGVSunday schema. Run in Supabase SQL editor.
-- Idempotent — safe to re-run as you add features.

create extension if not exists "pgcrypto";

-- ============== COURSES ==============
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  location text,
  hole_count int not null default 18 check (hole_count in (9, 18)),
  pars int[] not null,                       -- e.g. {4,4,3,5,4,4,5,3,4,4,3,5,4,4,3,4,5,4}
  total_par int generated always as ((select sum(p) from unnest(pars) p)) stored,
  is_seeded boolean not null default false,
  created_at timestamptz not null default now()
);

-- Seed common Thai/regional courses. ON CONFLICT skips if already there.
insert into courses (name, location, hole_count, pars, is_seeded) values
  ('Green Valley Country Club', 'Bangna, Thailand', 18, '{4,4,3,5,4,4,5,3,4,4,3,5,4,4,3,4,5,4}', true),
  ('Alpine Golf Club',          'Pathum Thani, Thailand', 18, '{4,5,3,4,4,3,5,4,4,4,4,3,5,4,3,4,5,4}', true),
  ('Thai Country Club',         'Chachoengsao, Thailand', 18, '{4,3,4,5,4,4,3,5,4,4,5,3,4,4,4,3,5,4}', true),
  ('Muang Kaew Golf Course',    'Bangna, Thailand', 18, '{4,4,3,5,4,3,5,4,4,4,3,4,5,4,4,3,5,4}', true),
  ('Summit Windmill',           'Bangna, Thailand', 18, '{4,5,4,3,4,4,3,5,4,4,4,5,3,4,4,5,3,4}', true),
  ('Bangpoo Country Club',      'Samut Prakan, Thailand', 18, '{4,3,5,4,4,4,3,5,4,4,5,3,4,4,4,3,5,4}', true),
  ('Lotus Valley',              'Lam Luk Ka, Thailand', 18, '{4,4,5,3,4,4,5,3,4,4,3,5,4,4,3,4,5,4}', true),
  ('Subhapruek Golf Club',      'Bang Bo, Thailand', 18, '{4,4,3,5,4,3,4,5,4,4,5,3,4,4,4,3,5,4}', true)
on conflict (name) do nothing;

-- ============== ROUNDS / PLAYERS / HOLES / SCORES ==============
create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null default 'Sunday Round',
  course_name text,
  course_id uuid references courses(id),
  hole_count int not null default 18 check (hole_count in (9, 18)),
  player_count int not null default 4 check (player_count between 1 and 6),
  stake_per_point numeric not null default 10,
  currency text not null default 'THB',
  admin_token text not null,
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','finished')),
  created_at timestamptz not null default now()
);
-- add the column if upgrading an older schema
alter table rounds add column if not exists course_id uuid references courses(id);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  name text not null,
  seat int not null check (seat between 1 and 6),
  color text not null default '#16a34a',
  handicap numeric not null default 0,
  player_token text not null,
  unique (round_id, seat)
);

create table if not exists holes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  number int not null check (number between 1 and 18),
  par int not null default 4 check (par between 3 and 6),
  multiplier int not null default 1 check (multiplier >= 1),
  unique (round_id, number)
);

create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  hole_id uuid not null references holes(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  strokes int,
  on_green_distance_m numeric,
  updated_by text,
  updated_at timestamptz not null default now(),
  unique (hole_id, player_id)
);

create index if not exists scores_round_idx on scores(round_id);
create index if not exists holes_round_idx  on holes(round_id);
create index if not exists players_round_idx on players(round_id);

-- ============== RLS (open policies — app handles auth at app layer) ==============
alter table courses enable row level security;
alter table rounds  enable row level security;
alter table players enable row level security;
alter table holes   enable row level security;
alter table scores  enable row level security;

drop policy if exists "anon all courses" on courses;
drop policy if exists "anon all rounds"  on rounds;
drop policy if exists "anon all players" on players;
drop policy if exists "anon all holes"   on holes;
drop policy if exists "anon all scores"  on scores;

create policy "anon all courses" on courses for all using (true) with check (true);
create policy "anon all rounds"  on rounds  for all using (true) with check (true);
create policy "anon all players" on players for all using (true) with check (true);
create policy "anon all holes"   on holes   for all using (true) with check (true);
create policy "anon all scores"  on scores  for all using (true) with check (true);

-- ============== REALTIME ==============
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='rounds')
    then alter publication supabase_realtime add table rounds; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='players')
    then alter publication supabase_realtime add table players; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='holes')
    then alter publication supabase_realtime add table holes; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='scores')
    then alter publication supabase_realtime add table scores; end if;
end $$;
