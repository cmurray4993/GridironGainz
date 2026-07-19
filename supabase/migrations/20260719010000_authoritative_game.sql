-- Gridiron Gainz authoritative game state, packs, and ten-day seasons.
-- The browser is deliberately limited to SELECT access plus the RPCs granted
-- at the bottom of this migration. All inventory, currency, lineup, pack, and
-- official-result mutations happen inside SECURITY DEFINER transactions.

create extension if not exists pgcrypto;
set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Core account state and an append-only ledger for every balance mutation.
-- ---------------------------------------------------------------------------

alter table public.economy_accounts
  add column if not exists fans bigint not null default 0 check (fans >= 0),
  add column if not exists last_claim_at timestamptz not null default now();

create table if not exists public.game_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  team_name text not null default 'Gridiron Franchise' check (char_length(team_name) between 1 and 24),
  level integer not null default 1 check (level >= 1),
  xp bigint not null default 0 check (xp >= 0),
  packs_opened integer not null default 0 check (packs_opened >= 0),
  starter_pack_opened boolean not null default false,
  lifetime_wins integer not null default 0 check (lifetime_wins >= 0),
  lifetime_losses integer not null default 0 check (lifetime_losses >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.currency_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  currency text not null check (currency in ('coins', 'gc')),
  delta bigint not null check (delta <> 0),
  balance_after bigint not null check (balance_after >= 0),
  reason text not null,
  reference_type text,
  reference_id text,
  idempotency_key uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists currency_ledger_user_created_idx
  on public.currency_ledger(user_id, created_at desc);
create unique index if not exists currency_ledger_idempotency_idx
  on public.currency_ledger(user_id, currency, idempotency_key)
  where idempotency_key is not null;

-- A trigger is the final safety net: even older marketplace functions cannot
-- change Coins or GC without producing a permanent audit record.
create or replace function public.audit_currency_balance()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  old_balance bigint := 0;
  new_balance bigint;
  ledger_currency text;
  mutation_reason text;
  mutation_reference_type text;
  mutation_reference_id text;
begin
  if tg_table_name = 'economy_accounts' then
    ledger_currency := 'coins';
    new_balance := new.coins;
    if tg_op = 'UPDATE' then old_balance := old.coins; end if;
  else
    ledger_currency := 'gc';
    new_balance := new.balance;
    if tg_op = 'UPDATE' then old_balance := old.balance; end if;
  end if;

  if new_balance = old_balance then return new; end if;
  mutation_reason := coalesce(nullif(current_setting('app.currency_reason', true), ''), 'server_balance_mutation');
  mutation_reference_type := nullif(current_setting('app.currency_reference_type', true), '');
  mutation_reference_id := nullif(current_setting('app.currency_reference_id', true), '');

  insert into public.currency_ledger(
    user_id, currency, delta, balance_after, reason, reference_type, reference_id
  ) values (
    new.user_id, ledger_currency, new_balance - old_balance, new_balance,
    mutation_reason, mutation_reference_type, mutation_reference_id
  );
  return new;
end $$;

drop trigger if exists economy_accounts_currency_audit on public.economy_accounts;
create trigger economy_accounts_currency_audit
  after insert or update of coins on public.economy_accounts
  for each row execute function public.audit_currency_balance();

drop trigger if exists gridiron_cash_accounts_currency_audit on public.gridiron_cash_accounts;
create trigger gridiron_cash_accounts_currency_audit
  after insert or update of balance on public.gridiron_cash_accounts
  for each row execute function public.audit_currency_balance();

-- ---------------------------------------------------------------------------
-- Individually owned cards and authoritative lineups.
-- ---------------------------------------------------------------------------

create table if not exists public.player_cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  pack_opening_id uuid,
  program text not null default 'base' check (program in ('base', 'hometown_heroes')),
  name text not null,
  position text not null check (position in ('QB','RB','WR','TE','OL','DL','LB','DB','K','P')),
  overall smallint not null check (overall between 60 and 86),
  strength smallint not null check (strength between 40 and 99),
  speed smallint not null check (speed between 40 and 99),
  iq smallint not null check (iq between 40 and 99),
  popularity smallint not null check (popularity between 30 and 99),
  fan_value integer not null check (fan_value >= 0),
  rarity text not null check (rarity in ('bronze','silver','gold','elite')),
  signature_key text not null,
  signature_label text not null,
  signature_value smallint not null check (signature_value between 40 and 99),
  status text not null default 'owned' check (status in ('owned','listed','burned')),
  acquired_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists player_cards_owner_status_idx
  on public.player_cards(owner_id, status, acquired_at desc);

create table if not exists public.starting_lineups (
  user_id uuid not null references auth.users(id) on delete cascade,
  slot text not null check (slot in (
    'QB','RB','FLEX','WR1','WR2','TE','OL','K','P',
    'DL','LB1','LB2','DB1','DB2','DB3','DFLEX'
  )),
  card_id uuid references public.player_cards(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot),
  unique (user_id, card_id)
);

create or replace function public.card_json(card public.player_cards)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', card.id::text,
    'name', card.name,
    'position', card.position,
    'overall', card.overall,
    'strength', card.strength,
    'speed', card.speed,
    'iq', card.iq,
    'popularity', card.popularity,
    'fanValue', card.fan_value,
    'rarity', card.rarity,
    'program', card.program,
    'signature', jsonb_build_object(
      'key', card.signature_key,
      'label', card.signature_label,
      'value', card.signature_value
    )
  )
$$;

create or replace function public.recalculate_fans(p_user_id uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare result bigint;
begin
  select coalesce(sum(c.fan_value), 0)::bigint into result
  from public.starting_lineups l
  join public.player_cards c on c.id = l.card_id
  where l.user_id = p_user_id and c.owner_id = p_user_id and c.status = 'owned';

  update public.economy_accounts set fans = result, updated_at = now()
  where user_id = p_user_id;
  return result;
end $$;

-- ---------------------------------------------------------------------------
-- Published pack catalog, immutable openings, and opening contents.
-- ---------------------------------------------------------------------------

create table if not exists public.pack_definitions (
  code text primary key check (code in ('starter','standard','position','pro','backyard')),
  display_name text not null,
  version integer not null check (version > 0),
  coin_cost bigint check (coin_cost is null or coin_cost >= 0),
  gc_cost bigint check (gc_cost is null or gc_cost >= 0),
  card_count integer not null check (card_count between 1 and 10),
  odds jsonb not null,
  active boolean not null default true,
  published_at timestamptz not null default now()
);

insert into public.pack_definitions(code, display_name, version, coin_cost, gc_cost, card_count, odds)
values
  ('starter','Starter Pack',1,0,0,5,
    '{"description":"Five free base-program cards. Each slot: Bronze 60%, Silver 28%, Gold 10%, Elite 2%.","slots":[{"count":5,"bronze":0.60,"silver":0.28,"gold":0.10,"elite":0.02}]}'::jsonb),
  ('standard','Standard Pack',1,5000,100,5,
    '{"description":"Five independent base-program rolls.","slots":[{"count":5,"bronze":0.60,"silver":0.28,"gold":0.10,"elite":0.02}]}'::jsonb),
  ('position','Position Pack',1,15000,300,1,
    '{"description":"One card at the selected position.","slots":[{"count":1,"bronze":0.60,"silver":0.34,"gold":0.05,"elite":0.01}]}'::jsonb),
  ('pro','Pro Pack',1,25000,500,5,
    '{"description":"Three standard rolls, one Silver+ roll, and one Gold+ roll.","slots":[{"count":3,"bronze":0.60,"silver":0.28,"gold":0.10,"elite":0.02},{"count":1,"bronze":0,"silver":0.70,"gold":0.25,"elite":0.05},{"count":1,"bronze":0,"silver":0,"gold":0.85,"elite":0.15}]}'::jsonb),
  ('backyard','Hometown Heroes',1,75000,1000,4,
    '{"description":"One standard roll, two Silver+ rolls, and one Gold+ roll. Each slot has a 25% Hometown Heroes signature upgrade when an eligible hero exists.","signatureChance":0.25,"slots":[{"count":1,"bronze":0.60,"silver":0.28,"gold":0.10,"elite":0.02},{"count":2,"bronze":0,"silver":0.70,"gold":0.25,"elite":0.05},{"count":1,"bronze":0,"silver":0,"gold":0.85,"elite":0.15}]}'::jsonb)
on conflict (code) do update set
  display_name = excluded.display_name,
  version = excluded.version,
  coin_cost = excluded.coin_cost,
  gc_cost = excluded.gc_cost,
  card_count = excluded.card_count,
  odds = excluded.odds,
  active = excluded.active,
  published_at = excluded.published_at;

create table if not exists public.pack_openings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  pack_code text not null references public.pack_definitions(code),
  pack_version integer not null,
  currency text not null check (currency in ('free','coins','gc')),
  cost bigint not null check (cost >= 0),
  selected_position text check (selected_position is null or selected_position in ('QB','RB','WR','TE','OL','DL','LB','DB','K','P')),
  odds_snapshot jsonb not null,
  status text not null default 'completed' check (status in ('completed','reversed')),
  created_at timestamptz not null default now(),
  unique(user_id, request_id)
);

alter table public.player_cards
  drop constraint if exists player_cards_pack_opening_id_fkey;
alter table public.player_cards
  add constraint player_cards_pack_opening_id_fkey
  foreign key (pack_opening_id) references public.pack_openings(id) on delete restrict;

create table if not exists public.pack_opening_cards (
  opening_id uuid not null references public.pack_openings(id) on delete restrict,
  card_id uuid not null unique references public.player_cards(id) on delete restrict,
  slot_number integer not null check (slot_number > 0),
  primary key(opening_id, slot_number)
);

create or replace function public.roll_pack_rarity(p_floor text, p_position_pack boolean default false)
returns text language plpgsql volatile set search_path = public as $$
declare r double precision := random();
begin
  if p_position_pack then
    if r < .01 then return 'elite'; elsif r < .06 then return 'gold'; elsif r < .40 then return 'silver'; else return 'bronze'; end if;
  end if;
  if p_floor = 'gold' then
    if r < .15 then return 'elite'; else return 'gold'; end if;
  elsif p_floor = 'silver' then
    if r < .05 then return 'elite'; elsif r < .30 then return 'gold'; else return 'silver'; end if;
  end if;
  if r < .02 then return 'elite'; elsif r < .12 then return 'gold'; elsif r < .40 then return 'silver'; else return 'bronze'; end if;
end $$;

create or replace function public.position_signature(p_position text)
returns jsonb language sql immutable set search_path = public as $$
  select case p_position
    when 'QB' then '{"key":"accuracy","label":"Accuracy"}'::jsonb
    when 'RB' then '{"key":"vision","label":"Vision"}'::jsonb
    when 'WR' then '{"key":"routeRunning","label":"Route Running"}'::jsonb
    when 'TE' then '{"key":"blocking","label":"Blocking"}'::jsonb
    when 'OL' then '{"key":"passPro","label":"Pass Protection"}'::jsonb
    when 'DL' then '{"key":"passRush","label":"Pass Rush"}'::jsonb
    when 'LB' then '{"key":"tackling","label":"Tackling"}'::jsonb
    when 'DB' then '{"key":"coverage","label":"Coverage"}'::jsonb
    when 'K' then '{"key":"legPower","label":"Leg Power"}'::jsonb
    else '{"key":"hangTime","label":"Hang Time"}'::jsonb end
$$;

create or replace function public.base_card_name(p_rarity text, p_position text)
returns text language sql immutable set search_path = public as $$
  select case p_rarity || ':' || p_position
    when 'bronze:QB' then 'Buck McGee' when 'silver:QB' then 'Rex "Gunslinger" Callahan'
    when 'bronze:RB' then 'Tank "Downhill" Briggs' when 'silver:RB' then 'Duke Ramsey'
    when 'bronze:WR' then 'Deacon Reyes' when 'silver:WR' then 'Flash "Slot Machine" Ortega'
    when 'bronze:TE' then 'Moose "Seam Buster" Halstead' when 'silver:TE' then 'Griff Beaumont'
    when 'bronze:OL' then 'Maurice Kowalski' when 'silver:OL' then 'Hoss "Anchor" Van Zandt'
    when 'bronze:DL' then 'Rocco "Trench Beast" Malone' when 'silver:DL' then 'Amari Okafor'
    when 'bronze:LB' then 'Chip Doyle' when 'silver:LB' then 'Ryder "Sideline" Kingsley'
    when 'bronze:DB' then 'Ace "Sticky" Fontaine' when 'silver:DB' then 'Nico Vega'
    when 'bronze:K' then 'Evan Sanderson' when 'silver:K' then 'Splits "Ice Water" Barrett'
    when 'bronze:P' then 'Boomer "Sky Ball" Hayes' when 'silver:P' then 'Connor Murphy'
    when 'gold:QB' then 'Jace "Field General" Mercer' when 'elite:QB' then 'Jace "Field General" Mercer'
    when 'gold:RB' then 'Malik "Northbound" Knox' when 'elite:RB' then 'Malik "Northbound" Knox'
    when 'gold:WR' then 'Devon "Afterburner" Price' when 'elite:WR' then 'Devon "Afterburner" Price'
    when 'gold:TE' then 'Cole "Red Zone" Barrett' when 'elite:TE' then 'Cole "Red Zone" Barrett'
    when 'gold:OL' then 'Andre "Iron Gate" Bishop' when 'elite:OL' then 'Andre "Iron Gate" Bishop'
    when 'gold:DL' then 'Marcus "Groundquake" Voss' when 'elite:DL' then 'Marcus "Groundquake" Voss'
    when 'gold:LB' then 'Darius "Heat Check" Cole' when 'elite:LB' then 'Darius "Heat Check" Cole'
    when 'gold:DB' then 'Zion "No Fly" Brooks' when 'elite:DB' then 'Zion "No Fly" Brooks'
    when 'gold:K' then 'Eli "Golden Leg" Ward' when 'elite:K' then 'Eli "Golden Leg" Ward'
    else 'Nolan "Hangtime" Hale' end
$$;

create or replace function public.create_random_card(
  p_owner_id uuid,
  p_opening_id uuid,
  p_rarity text,
  p_position text default null,
  p_program text default 'base'
) returns public.player_cards
language plpgsql security definer set search_path = public as $$
declare
  positions text[] := array['QB','RB','WR','TE','OL','DL','LB','DB','K','P'];
  chosen_position text := coalesce(p_position, positions[1 + floor(random() * array_length(positions,1))::int]);
  ovr_min int;
  ovr_max int;
  ovr int;
  pop int;
  rarity_multiplier int;
  sig jsonb := public.position_signature(chosen_position);
  created public.player_cards%rowtype;
begin
  case p_rarity
    when 'bronze' then ovr_min := 60; ovr_max := 69; rarity_multiplier := 1;
    when 'silver' then ovr_min := 70; ovr_max := 79; rarity_multiplier := 2;
    when 'gold' then ovr_min := 80; ovr_max := 84; rarity_multiplier := 3;
    else ovr_min := 85; ovr_max := 86; rarity_multiplier := 6;
  end case;
  ovr := ovr_min + floor(random() * (ovr_max - ovr_min + 1))::int;
  pop := greatest(30, least(99, round(ovr * .72 + (random() * 24 - 8))::int));

  insert into public.player_cards(
    owner_id, pack_opening_id, program, name, position, overall,
    strength, speed, iq, popularity, fan_value, rarity,
    signature_key, signature_label, signature_value
  ) values (
    p_owner_id, p_opening_id, p_program, public.base_card_name(p_rarity, chosen_position), chosen_position, ovr,
    greatest(40, least(99, ovr + floor(random()*17)::int - 8)),
    greatest(40, least(99, ovr + floor(random()*17)::int - 8)),
    greatest(40, least(99, ovr + floor(random()*17)::int - 8)),
    pop,
    round(power(greatest(0, ovr - 50), 2) * (.5 + pop / 200.0) * rarity_multiplier)::int,
    p_rarity, sig->>'key', sig->>'label', greatest(40, least(99, ovr + floor(random()*17)::int - 8))
  ) returning * into created;
  return created;
end $$;

-- ---------------------------------------------------------------------------
-- Twelve-team, seven-game regular season plus three playoff rounds.
-- ---------------------------------------------------------------------------

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  season_number integer not null unique,
  starts_on date not null unique,
  ends_on date not null,
  status text not null default 'active' check (status in ('scheduled','active','complete')),
  prize_pool_lamports bigint not null default 0 check (prize_pool_lamports >= 0),
  created_at timestamptz not null default now(),
  check (ends_on = starts_on + 9)
);

create table if not exists public.season_leagues (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  tier text not null default 'backyard',
  league_number integer not null,
  created_at timestamptz not null default now(),
  unique(season_id, tier, league_number)
);

create table if not exists public.league_teams (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.season_leagues(id) on delete cascade,
  seat smallint not null check (seat between 1 and 12),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  bot_overall smallint not null default 72 check (bot_overall between 60 and 86),
  wins integer not null default 0,
  losses integer not null default 0,
  points_for integer not null default 0,
  points_against integer not null default 0,
  playoff_seed smallint,
  eliminated boolean not null default false,
  final_rank smallint,
  unique(league_id, seat),
  unique(league_id, user_id)
);

create table if not exists public.season_games (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  league_id uuid not null references public.season_leagues(id) on delete cascade,
  day_number smallint not null check (day_number between 1 and 10),
  round text not null check (round in ('regular','quarterfinal','semifinal','championship','consolation')),
  game_number smallint not null,
  home_team_id uuid references public.league_teams(id) on delete cascade,
  away_team_id uuid references public.league_teams(id) on delete cascade,
  lock_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','final','bye')),
  home_score smallint,
  away_score smallint,
  winner_team_id uuid references public.league_teams(id) on delete set null,
  home_lineup jsonb,
  away_lineup jsonb,
  simulation jsonb,
  played_at timestamptz,
  unique(league_id, day_number, game_number)
);

create index if not exists season_games_due_idx on public.season_games(status, lock_at);

create table if not exists public.season_rewards (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  league_id uuid not null references public.season_leagues(id) on delete cascade,
  team_id uuid not null references public.league_teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  final_rank smallint not null check (final_rank between 1 and 12),
  coins bigint not null default 0 check (coins >= 0),
  sol_lamports bigint not null default 0 check (sol_lamports >= 0),
  status text not null default 'pending' check (status in ('pending','credited','claimed','failed')),
  created_at timestamptz not null default now(),
  credited_at timestamptz,
  unique(season_id, team_id)
);

create or replace function public.kickoff_at(p_date date)
returns timestamptz language sql stable set search_path = public as $$
  select (p_date::timestamp + time '19:00') at time zone 'America/Chicago'
$$;

create or replace function public.ensure_current_season()
returns public.seasons language plpgsql security definer set search_path = public as $$
declare
  current public.seasons%rowtype;
  next_number int;
  next_start date;
  allocation bigint;
begin
  select * into current from public.seasons
  where current_date between starts_on and ends_on
  order by season_number desc limit 1;
  if found then return current; end if;

  select coalesce(max(season_number),0)+1,
    coalesce(max(ends_on)+1,current_date)
  into next_number, next_start from public.seasons;
  if next_start > current_date then next_start := current_date; end if;

  select coalesce(current_pool_lamports,0) into allocation
  from public.treasury_allocation where singleton = true;

  insert into public.seasons(season_number, starts_on, ends_on, status, prize_pool_lamports)
  values(next_number, next_start, next_start+9, 'active', coalesce(allocation,0))
  returning * into current;
  return current;
end $$;

create or replace function public.seed_league_schedule(p_league_id uuid, p_season_id uuid, p_starts_on date)
returns void language plpgsql security definer set search_path = public as $$
declare
  teams uuid[];
  rotation uuid[];
  day_no int;
  game_no int;
  i int;
  n int := 12;
  temp uuid;
begin
  select array_agg(id order by seat) into teams from public.league_teams where league_id = p_league_id;
  if coalesce(array_length(teams,1),0) <> 12 then raise exception 'League must contain twelve teams'; end if;
  rotation := teams;
  for day_no in 1..7 loop
    for game_no in 1..6 loop
      insert into public.season_games(
        season_id, league_id, day_number, round, game_number,
        home_team_id, away_team_id, lock_at
      ) values (
        p_season_id, p_league_id, day_no, 'regular', game_no,
        rotation[game_no], rotation[n-game_no+1], public.kickoff_at(p_starts_on + day_no - 1)
      ) on conflict do nothing;
    end loop;
    temp := rotation[n];
    for i in reverse n..3 loop rotation[i] := rotation[i-1]; end loop;
    rotation[2] := temp;
  end loop;
end $$;

create or replace function public.ensure_user_league(p_user_id uuid)
returns public.league_teams language plpgsql security definer set search_path = public as $$
declare
  season public.seasons%rowtype := public.ensure_current_season();
  team public.league_teams%rowtype;
  league public.season_leagues%rowtype;
  i int;
  names text[] := array['Austin Outlaws','Bay City Breakers','Chicago Forge','Denver Summit','Kansas City Kings','Miami Voltage','Nashville Hounds','New York Knights','Portland Pioneers','San Diego Surge','Seattle Sentinels','Tulsa Stampede'];
begin
  select t.* into team from public.league_teams t
  join public.season_leagues l on l.id=t.league_id
  where l.season_id=season.id and t.user_id=p_user_id limit 1;
  if found then return team; end if;

  select l.* into league from public.season_leagues l
  where l.season_id=season.id
    and exists(select 1 from public.league_teams t where t.league_id=l.id and t.user_id is null)
  order by l.league_number limit 1 for update;

  if not found then
    insert into public.season_leagues(season_id,tier,league_number)
    values(season.id,'backyard',coalesce((select max(league_number)+1 from public.season_leagues where season_id=season.id),1))
    returning * into league;
    for i in 1..12 loop
      insert into public.league_teams(league_id,seat,name,bot_overall)
      values(league.id,i,names[i],68 + floor(random()*15)::int);
    end loop;
    perform public.seed_league_schedule(league.id,season.id,season.starts_on);
  end if;

  select * into team from public.league_teams
  where league_id=league.id and user_id is null order by seat limit 1 for update;
  update public.league_teams set user_id=p_user_id,
    name=coalesce((select team_name from public.game_profiles where user_id=p_user_id),'Gridiron Franchise')
  where id=team.id returning * into team;
  return team;
end $$;

create or replace function public.lineup_snapshot(p_user_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.card_json(c) || jsonb_build_object('slot',l.slot) order by l.slot),'[]'::jsonb)
  from public.starting_lineups l join public.player_cards c on c.id=l.card_id
  where l.user_id=p_user_id and c.owner_id=p_user_id and c.status='owned'
$$;

create or replace function public.simulate_season_game(p_game_id uuid)
returns public.season_games language plpgsql security definer set search_path = public as $$
declare
  game public.season_games%rowtype;
  home_team public.league_teams%rowtype;
  away_team public.league_teams%rowtype;
  home_ovr numeric;
  away_ovr numeric;
  home_score int;
  away_score int;
  home_snap jsonb;
  away_snap jsonb;
  winner uuid;
begin
  select * into game from public.season_games where id=p_game_id for update;
  if not found then raise exception 'Game not found'; end if;
  if game.status='final' then return game; end if;
  if game.lock_at>now() then raise exception 'Game has not reached kickoff'; end if;
  if game.home_team_id is null or game.away_team_id is null then
    update public.season_games set status='bye',played_at=now() where id=game.id returning * into game;
    return game;
  end if;

  select * into home_team from public.league_teams where id=game.home_team_id;
  select * into away_team from public.league_teams where id=game.away_team_id;
  home_snap := case when home_team.user_id is null then '[]'::jsonb else public.lineup_snapshot(home_team.user_id) end;
  away_snap := case when away_team.user_id is null then '[]'::jsonb else public.lineup_snapshot(away_team.user_id) end;
  select coalesce(avg((x->>'overall')::numeric),home_team.bot_overall) into home_ovr from jsonb_array_elements(home_snap) x;
  select coalesce(avg((x->>'overall')::numeric),away_team.bot_overall) into away_ovr from jsonb_array_elements(away_snap) x;
  -- Incomplete user lineups are auto-filled conceptually, but carry up to a
  -- four-point preparation penalty. The saved snapshot records what was set.
  if home_team.user_id is not null then home_ovr := home_ovr - greatest(0,16-jsonb_array_length(home_snap))*.25; end if;
  if away_team.user_id is not null then away_ovr := away_ovr - greatest(0,16-jsonb_array_length(away_snap))*.25; end if;

  home_score := greatest(3,round(20 + (home_ovr-away_ovr)*.55 + (random()*18-7))::int);
  away_score := greatest(3,round(19 + (away_ovr-home_ovr)*.55 + (random()*18-7))::int);
  home_score := home_score - mod(home_score,3);
  away_score := away_score - mod(away_score,3);
  if home_score=away_score then home_score := home_score+3; end if;
  winner := case when home_score>away_score then home_team.id else away_team.id end;

  update public.season_games set status='final',home_score=home_score,away_score=away_score,
    winner_team_id=winner,home_lineup=home_snap,away_lineup=away_snap,
    simulation=jsonb_build_object(
      'homeOverall',round(home_ovr,1),'awayOverall',round(away_ovr,1),
      'missedLineupRule','Incomplete saved lineups receive a preparation penalty and server auto-fill treatment.',
      'playByPlay',jsonb_build_array(
        'Kickoff — both franchises trade early possessions.',
        format('Halftime — %s %s, %s %s.',home_team.name,floor(home_score/2),away_team.name,floor(away_score/2)),
        format('Final — %s %s, %s %s.',home_team.name,home_score,away_team.name,away_score)
      )
    ),played_at=now() where id=game.id returning * into game;

  if game.round='regular' then
    update public.league_teams set wins=wins+(case when id=winner then 1 else 0 end),
      losses=losses+(case when id<>winner then 1 else 0 end),
      points_for=points_for+(case when id=home_team.id then home_score else away_score end),
      points_against=points_against+(case when id=home_team.id then away_score else home_score end)
    where id in(home_team.id,away_team.id);
  end if;
  return game;
end $$;

create or replace function public.create_playoff_round(p_league_id uuid, p_day int)
returns void language plpgsql security definer set search_path = public as $$
declare
  league public.season_leagues%rowtype;
  season public.seasons%rowtype;
  ranked uuid[];
  prior uuid[];
begin
  select * into league from public.season_leagues where id=p_league_id;
  select * into season from public.seasons where id=league.season_id;
  if p_day=8 then
    select array_agg(id order by wins desc,(points_for-points_against) desc,points_for desc,id)
    into ranked from public.league_teams where league_id=p_league_id;
    update public.league_teams t set playoff_seed=s.seed
    from (select id,row_number() over(order by wins desc,(points_for-points_against) desc,points_for desc,id)::smallint seed from public.league_teams where league_id=p_league_id) s
    where t.id=s.id;
    insert into public.season_games(season_id,league_id,day_number,round,game_number,home_team_id,away_team_id,lock_at)
    values
      (season.id,p_league_id,8,'quarterfinal',1,ranked[1],ranked[8],public.kickoff_at(season.starts_on+7)),
      (season.id,p_league_id,8,'quarterfinal',2,ranked[4],ranked[5],public.kickoff_at(season.starts_on+7)),
      (season.id,p_league_id,8,'quarterfinal',3,ranked[2],ranked[7],public.kickoff_at(season.starts_on+7)),
      (season.id,p_league_id,8,'quarterfinal',4,ranked[3],ranked[6],public.kickoff_at(season.starts_on+7))
    on conflict do nothing;
  elsif p_day=9 then
    select array_agg(winner_team_id order by game_number) into prior from public.season_games where league_id=p_league_id and day_number=8 and status='final';
    if array_length(prior,1)=4 then
      insert into public.season_games(season_id,league_id,day_number,round,game_number,home_team_id,away_team_id,lock_at)
      values(season.id,p_league_id,9,'semifinal',1,prior[1],prior[2],public.kickoff_at(season.starts_on+8)),
            (season.id,p_league_id,9,'semifinal',2,prior[3],prior[4],public.kickoff_at(season.starts_on+8)) on conflict do nothing;
    end if;
  elsif p_day=10 then
    select array_agg(winner_team_id order by game_number) into prior from public.season_games where league_id=p_league_id and day_number=9 and status='final';
    if array_length(prior,1)=2 then
      insert into public.season_games(season_id,league_id,day_number,round,game_number,home_team_id,away_team_id,lock_at)
      values(season.id,p_league_id,10,'championship',1,prior[1],prior[2],public.kickoff_at(season.starts_on+9)) on conflict do nothing;
    end if;
  end if;
end $$;

create or replace function public.finalize_league_rewards(p_league_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  league public.season_leagues%rowtype;
  season public.seasons%rowtype;
  champ public.season_games%rowtype;
  runner uuid;
  team public.league_teams%rowtype;
  rank_no int;
  pct numeric;
  reward_coins bigint;
  reward_lamports bigint;
begin
  select * into league from public.season_leagues where id=p_league_id;
  select * into season from public.seasons where id=league.season_id;
  select * into champ from public.season_games where league_id=p_league_id and round='championship' and status='final';
  if not found then return; end if;
  runner := case when champ.winner_team_id=champ.home_team_id then champ.away_team_id else champ.home_team_id end;

  for team in select * from public.league_teams where league_id=p_league_id loop
    if team.id=champ.winner_team_id then rank_no:=1;
    elsif team.id=runner then rank_no:=2;
    elsif exists(select 1 from public.season_games where league_id=p_league_id and day_number=9 and status='final' and team.id in(home_team_id,away_team_id)) then rank_no:=3;
    elsif exists(select 1 from public.season_games where league_id=p_league_id and day_number=8 and status='final' and team.id in(home_team_id,away_team_id)) then rank_no:=5;
    else rank_no:=9; end if;
    pct := case rank_no when 1 then .40 when 2 then .20 when 3 then .10 when 5 then .04 else .01 end;
    reward_coins := case rank_no when 1 then 25000 when 2 then 15000 when 3 then 10000 when 5 then 5000 else 2000 end;
    reward_lamports := floor(season.prize_pool_lamports*pct)::bigint;
    update public.league_teams set final_rank=rank_no where id=team.id;
    insert into public.season_rewards(season_id,league_id,team_id,user_id,final_rank,coins,sol_lamports,status)
    values(season.id,p_league_id,team.id,team.user_id,rank_no,reward_coins,reward_lamports,case when team.user_id is null then 'credited' else 'pending' end)
    on conflict(season_id,team_id) do nothing;
    if team.user_id is not null and not exists(select 1 from public.currency_ledger where user_id=team.user_id and reason='season_reward' and reference_id=season.id::text) then
      perform set_config('app.currency_reason','season_reward',true);
      perform set_config('app.currency_reference_type','season',true);
      perform set_config('app.currency_reference_id',season.id::text,true);
      update public.economy_accounts set coins=coins+reward_coins,updated_at=now() where user_id=team.user_id;
      update public.season_rewards set status='credited',credited_at=now() where season_id=season.id and team_id=team.id;
      update public.game_profiles set lifetime_wins=lifetime_wins+team.wins,lifetime_losses=lifetime_losses+team.losses,
        xp=xp+team.wins*100+team.losses*25,level=greatest(level,1+floor((xp+team.wins*100+team.losses*25)/1000)::int),updated_at=now()
      where user_id=team.user_id;
    end if;
  end loop;
end $$;

create or replace function public.process_due_league_games(p_league_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  due public.season_games%rowtype;
  processed int:=0;
  day_no int;
begin
  for day_no in 1..10 loop
    if day_no>=8 then perform public.create_playoff_round(p_league_id,day_no); end if;
    for due in select * from public.season_games where league_id=p_league_id and day_number=day_no and status='scheduled' and lock_at<=now() order by game_number loop
      perform public.simulate_season_game(due.id); processed:=processed+1;
    end loop;
  end loop;
  perform public.finalize_league_rewards(p_league_id);
  return processed;
end $$;

-- ---------------------------------------------------------------------------
-- Authenticated public API.
-- ---------------------------------------------------------------------------

create or replace function public.bootstrap_game_account()
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid:=auth.uid(); team public.league_teams%rowtype;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  perform set_config('app.currency_reason','account_bootstrap',true);
  insert into public.economy_accounts(user_id,coins) values(uid,500) on conflict(user_id) do nothing;
  insert into public.gridiron_cash_accounts(user_id,balance,total_purchased) values(uid,0,0) on conflict(user_id) do nothing;
  insert into public.game_profiles(user_id) values(uid) on conflict(user_id) do nothing;
  insert into public.starting_lineups(user_id,slot)
  select uid,slot from unnest(array['QB','RB','FLEX','WR1','WR2','TE','OL','K','P','DL','LB1','LB2','DB1','DB2','DB3','DFLEX']) slot
  on conflict(user_id,slot) do nothing;
  team:=public.ensure_user_league(uid);
  perform public.process_due_league_games(team.league_id);
  return public.get_game_snapshot();
end $$;

create or replace function public.get_game_snapshot()
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid:=auth.uid(); team public.league_teams%rowtype; season public.seasons%rowtype; league_id uuid;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  select t.* into team from public.league_teams t where t.user_id=uid order by t.id desc limit 1;
  if not found then return public.bootstrap_game_account(); end if;
  league_id:=team.league_id;
  perform public.process_due_league_games(league_id);
  select s.* into season from public.seasons s join public.season_leagues l on l.season_id=s.id where l.id=league_id;
  return jsonb_build_object(
    'account',(select to_jsonb(a) from (select e.coins,e.fans,e.last_claim_at,g.balance as gridiron_cash,p.team_name,p.level,p.xp,p.packs_opened,p.starter_pack_opened,p.lifetime_wins,p.lifetime_losses from public.economy_accounts e join public.game_profiles p on p.user_id=e.user_id left join public.gridiron_cash_accounts g on g.user_id=e.user_id where e.user_id=uid) a),
    'roster',(select coalesce(jsonb_agg(public.card_json(c) order by c.acquired_at),'[]'::jsonb) from public.player_cards c where c.owner_id=uid and c.status in('owned','listed')),
    'lineup',(select coalesce(jsonb_object_agg(slot,card_id::text),'{}'::jsonb) from public.starting_lineups where user_id=uid),
    'season',jsonb_build_object('id',season.id,'number',season.season_number,'startsOn',season.starts_on,'endsOn',season.ends_on,'day',least(10,greatest(1,current_date-season.starts_on+1)),'leagueId',league_id),
    'team',to_jsonb(team),
    'standings',(select coalesce(jsonb_agg(to_jsonb(t) order by wins desc,(points_for-points_against) desc,points_for desc,t.id),'[]'::jsonb) from public.league_teams t where t.league_id=league_id),
    'games',(select coalesce(jsonb_agg(to_jsonb(g) order by day_number,game_number),'[]'::jsonb) from public.season_games g where g.league_id=league_id and (g.home_team_id=team.id or g.away_team_id=team.id)),
    'rewards',(select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from public.season_rewards r where r.user_id=uid),
    'pendingClaim',public.get_pending_fan_claim()
  );
end $$;

create or replace function public.get_pending_fan_claim()
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid:=auth.uid(); account public.economy_accounts%rowtype; buckets int; amount bigint;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  select * into account from public.economy_accounts where user_id=uid;
  buckets:=least(32,greatest(0,floor(extract(epoch from(now()-account.last_claim_at))/900)::int));
  amount:=floor(buckets*account.fans*.01*.25)::bigint;
  return jsonb_build_object('buckets',buckets,'coins',amount,'capped',buckets=32,'lastClaimAt',account.last_claim_at);
end $$;

create or replace function public.claim_fan_coins(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid:=auth.uid(); account public.economy_accounts%rowtype; buckets int; amount bigint; prior public.currency_ledger%rowtype;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  select * into prior from public.currency_ledger where user_id=uid and currency='coins' and idempotency_key=p_request_id;
  if found then return jsonb_build_object('coins',prior.delta,'balance',prior.balance_after,'duplicate',true); end if;
  select * into account from public.economy_accounts where user_id=uid for update;
  buckets:=least(32,greatest(0,floor(extract(epoch from(now()-account.last_claim_at))/900)::int));
  amount:=floor(buckets*account.fans*.01*.25)::bigint;
  if buckets=0 or amount=0 then return jsonb_build_object('coins',0,'balance',account.coins,'duplicate',false); end if;
  update public.economy_accounts set coins=coins+amount,last_claim_at=case when buckets=32 then now() else last_claim_at+buckets*interval '15 minutes' end,updated_at=now() where user_id=uid returning * into account;
  update public.currency_ledger set reason='fan_claim',reference_type='fan_claim',reference_id=p_request_id::text,idempotency_key=p_request_id
  where id=(select id from public.currency_ledger where user_id=uid and currency='coins' order by created_at desc limit 1);
  return jsonb_build_object('coins',amount,'balance',account.coins,'duplicate',false);
end $$;

create or replace function public.set_authoritative_lineup(p_slot text,p_card_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid:=auth.uid(); card public.player_cards%rowtype; accepted text[]; fans bigint;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  if p_slot not in('QB','RB','FLEX','WR1','WR2','TE','OL','K','P','DL','LB1','LB2','DB1','DB2','DB3','DFLEX') then raise exception 'Invalid lineup slot'; end if;
  if p_card_id is not null then
    select * into card from public.player_cards where id=p_card_id and owner_id=uid and status='owned' for update;
    if not found then raise exception 'You do not own this available card'; end if;
    accepted:=case when p_slot='FLEX' then array['RB','WR','TE'] when p_slot='DFLEX' then array['LB','DB'] else array[regexp_replace(p_slot,'[0-9]+$','')] end;
    if not card.position=any(accepted) then raise exception 'Card is not eligible for this slot'; end if;
    update public.starting_lineups set card_id=null,updated_at=now() where user_id=uid and card_id=p_card_id;
  end if;
  insert into public.starting_lineups(user_id,slot,card_id) values(uid,p_slot,p_card_id)
  on conflict(user_id,slot) do update set card_id=excluded.card_id,updated_at=now();
  fans:=public.recalculate_fans(uid);
  return jsonb_build_object('slot',p_slot,'cardId',p_card_id,'fans',fans);
end $$;

create or replace function public.set_authoritative_team_name(p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid:=auth.uid(); clean text:=left(trim(coalesce(p_name,'')),24);
begin
  if uid is null then raise exception 'Sign in required'; end if;
  if char_length(clean)<1 then raise exception 'Team name is required'; end if;
  update public.game_profiles set team_name=clean,updated_at=now() where user_id=uid;
  update public.league_teams set name=clean where user_id=uid;
  return clean;
end $$;

create or replace function public.open_authoritative_pack(
  p_pack_code text,p_currency text,p_request_id uuid,p_position text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid:=auth.uid(); def public.pack_definitions%rowtype; opening public.pack_openings%rowtype;
  account public.economy_accounts%rowtype; gc public.gridiron_cash_accounts%rowtype;
  cost bigint; i int; floor_rarity text; rarity text; program text; card public.player_cards%rowtype;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  select * into opening from public.pack_openings where user_id=uid and request_id=p_request_id;
  if found then
    return jsonb_build_object('openingId',opening.id,'duplicate',true,'cards',(select jsonb_agg(public.card_json(c) order by oc.slot_number) from public.pack_opening_cards oc join public.player_cards c on c.id=oc.card_id where oc.opening_id=opening.id),'odds',opening.odds_snapshot);
  end if;
  select * into def from public.pack_definitions where code=p_pack_code and active for share;
  if not found then raise exception 'Pack is not available'; end if;
  if p_pack_code='starter' then
    if exists(select 1 from public.game_profiles where user_id=uid and starter_pack_opened) then raise exception 'Starter pack already opened'; end if;
    p_currency:='free'; cost:=0;
  elsif p_currency='coins' then cost:=def.coin_cost;
  elsif p_currency='gc' then cost:=def.gc_cost;
  else raise exception 'Invalid payment currency'; end if;
  if p_pack_code='position' and p_position not in('QB','RB','WR','TE','OL','DL','LB','DB','K','P') then raise exception 'Choose a valid position'; end if;

  if p_currency='coins' then
    select * into account from public.economy_accounts where user_id=uid for update;
    if account.coins<cost then raise exception 'Not enough Coins'; end if;
    perform set_config('app.currency_reason','pack_purchase',true); perform set_config('app.currency_reference_type','pack',true); perform set_config('app.currency_reference_id',p_request_id::text,true);
    update public.economy_accounts set coins=coins-cost,updated_at=now() where user_id=uid;
  elsif p_currency='gc' then
    select * into gc from public.gridiron_cash_accounts where user_id=uid for update;
    if gc.balance<cost then raise exception 'Not enough Gridiron Cash'; end if;
    perform set_config('app.currency_reason','pack_purchase',true); perform set_config('app.currency_reference_type','pack',true); perform set_config('app.currency_reference_id',p_request_id::text,true);
    update public.gridiron_cash_accounts set balance=balance-cost,updated_at=now() where user_id=uid;
  end if;

  insert into public.pack_openings(user_id,request_id,pack_code,pack_version,currency,cost,selected_position,odds_snapshot)
  values(uid,p_request_id,p_pack_code,def.version,p_currency,cost,p_position,def.odds) returning * into opening;
  for i in 1..def.card_count loop
    floor_rarity:=case when p_pack_code in('pro','backyard') and i=def.card_count then 'gold' when p_pack_code in('pro','backyard') and i>=4 then 'silver' when p_pack_code='backyard' and i>=2 then 'silver' else 'bronze' end;
    rarity:=public.roll_pack_rarity(floor_rarity,p_pack_code='position');
    program:=case when p_pack_code='backyard' and random()<.25 then 'hometown_heroes' else 'base' end;
    card:=public.create_random_card(uid,opening.id,rarity,case when p_pack_code='position' then p_position else null end,program);
    insert into public.pack_opening_cards(opening_id,card_id,slot_number) values(opening.id,card.id,i);
  end loop;
  update public.game_profiles set packs_opened=packs_opened+1,starter_pack_opened=starter_pack_opened or p_pack_code='starter',updated_at=now() where user_id=uid;
  return jsonb_build_object('openingId',opening.id,'duplicate',false,'cards',(select jsonb_agg(public.card_json(c) order by oc.slot_number) from public.pack_opening_cards oc join public.player_cards c on c.id=oc.card_id where oc.opening_id=opening.id),'odds',opening.odds_snapshot);
end $$;

create or replace function public.get_today_official_game()
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid:=auth.uid(); team public.league_teams%rowtype; game public.season_games%rowtype; opponent public.league_teams%rowtype;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  team:=public.ensure_user_league(uid); perform public.process_due_league_games(team.league_id);
  select * into game from public.season_games where league_id=team.league_id and (home_team_id=team.id or away_team_id=team.id) and day_number=least(10,greatest(1,current_date-(select starts_on from public.seasons s join public.season_leagues l on l.season_id=s.id where l.id=team.league_id)+1)) limit 1;
  if not found then return null; end if;
  select * into opponent from public.league_teams where id=case when game.home_team_id=team.id then game.away_team_id else game.home_team_id end;
  return jsonb_build_object('game',to_jsonb(game),'opponent',to_jsonb(opponent),'isHome',game.home_team_id=team.id);
end $$;

-- Old bootstrap accepted a browser-provided starting balance. Retain its
-- signature for existing clients, but permanently ignore the supplied value.
create or replace function public.bootstrap_market_account(p_starting_coins bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare uid uuid:=auth.uid(); result bigint;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  perform set_config('app.currency_reason','account_bootstrap',true);
  insert into public.economy_accounts(user_id,coins) values(uid,500) on conflict(user_id) do nothing;
  select coins into result from public.economy_accounts where user_id=uid;
  return result;
end $$;

-- ---------------------------------------------------------------------------
-- RLS and grants: authenticated clients can read their state, never mutate it.
-- ---------------------------------------------------------------------------

alter table public.game_profiles enable row level security;
alter table public.currency_ledger enable row level security;
alter table public.player_cards enable row level security;
alter table public.starting_lineups enable row level security;
alter table public.pack_definitions enable row level security;
alter table public.pack_openings enable row level security;
alter table public.pack_opening_cards enable row level security;
alter table public.seasons enable row level security;
alter table public.season_leagues enable row level security;
alter table public.league_teams enable row level security;
alter table public.season_games enable row level security;
alter table public.season_rewards enable row level security;

create policy "Users read own game profile" on public.game_profiles for select to authenticated using(user_id=auth.uid());
create policy "Users read own currency ledger" on public.currency_ledger for select to authenticated using(user_id=auth.uid());
create policy "Users read own cards" on public.player_cards for select to authenticated using(owner_id=auth.uid());
create policy "Users read own lineup" on public.starting_lineups for select to authenticated using(user_id=auth.uid());
create policy "Everyone reads active pack definitions" on public.pack_definitions for select to authenticated using(active);
create policy "Users read own pack openings" on public.pack_openings for select to authenticated using(user_id=auth.uid());
create policy "Users read own opening cards" on public.pack_opening_cards for select to authenticated using(exists(select 1 from public.pack_openings o where o.id=opening_id and o.user_id=auth.uid()));
create policy "Authenticated read seasons" on public.seasons for select to authenticated using(true);
create policy "Authenticated read leagues" on public.season_leagues for select to authenticated using(true);
create policy "Authenticated read league teams" on public.league_teams for select to authenticated using(true);
create policy "Authenticated read season games" on public.season_games for select to authenticated using(true);
create policy "Users read own season rewards" on public.season_rewards for select to authenticated using(user_id=auth.uid());

revoke all on public.game_profiles,public.currency_ledger,public.player_cards,public.starting_lineups,
  public.pack_definitions,public.pack_openings,public.pack_opening_cards,public.seasons,
  public.season_leagues,public.league_teams,public.season_games,public.season_rewards from anon,authenticated;
grant select on public.game_profiles,public.currency_ledger,public.player_cards,public.starting_lineups,
  public.pack_definitions,public.pack_openings,public.pack_opening_cards,public.seasons,
  public.season_leagues,public.league_teams,public.season_games,public.season_rewards to authenticated;
grant all on public.game_profiles,public.currency_ledger,public.player_cards,public.starting_lineups,
  public.pack_definitions,public.pack_openings,public.pack_opening_cards,public.seasons,
  public.season_leagues,public.league_teams,public.season_games,public.season_rewards to service_role;

revoke all on function public.bootstrap_game_account() from public,anon;
revoke all on function public.get_game_snapshot() from public,anon;
revoke all on function public.get_pending_fan_claim() from public,anon;
revoke all on function public.claim_fan_coins(uuid) from public,anon;
revoke all on function public.set_authoritative_lineup(text,uuid) from public,anon;
revoke all on function public.set_authoritative_team_name(text) from public,anon;
revoke all on function public.open_authoritative_pack(text,text,uuid,text) from public,anon;
revoke all on function public.get_today_official_game() from public,anon;
grant execute on function public.bootstrap_game_account(),public.get_game_snapshot(),public.get_pending_fan_claim(),
  public.claim_fan_coins(uuid),public.set_authoritative_lineup(text,uuid),
  public.set_authoritative_team_name(text),public.open_authoritative_pack(text,text,uuid,text),
  public.get_today_official_game() to authenticated;

revoke all on function public.create_random_card(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.simulate_season_game(uuid) from public,anon,authenticated;
revoke all on function public.process_due_league_games(uuid) from public,anon,authenticated;
grant execute on function public.create_random_card(uuid,uuid,text,text,text),public.simulate_season_game(uuid),public.process_due_league_games(uuid) to service_role;

set check_function_bodies = on;
