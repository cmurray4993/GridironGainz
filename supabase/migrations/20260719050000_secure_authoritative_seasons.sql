-- Close lineup-lock, playoff-timing, season-selection, and fan-claim audit gaps.

create or replace function public.audit_currency_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_balance bigint := 0;
  new_balance bigint;
  ledger_currency text;
  mutation_reason text;
  mutation_reference_type text;
  mutation_reference_id text;
  mutation_idempotency_key uuid;
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
  begin
    mutation_idempotency_key := nullif(current_setting('app.currency_idempotency_key', true), '')::uuid;
  exception when others then
    mutation_idempotency_key := null;
  end;
  insert into public.currency_ledger(
    user_id, currency, delta, balance_after, reason, reference_type,
    reference_id, idempotency_key
  ) values (
    new.user_id, ledger_currency, new_balance - old_balance, new_balance,
    mutation_reason, mutation_reference_type, mutation_reference_id,
    mutation_idempotency_key
  );
  return new;
end;
$$;

create or replace function public.claim_fan_coins(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_current_legal_acceptance();
  account public.economy_accounts%rowtype;
  buckets integer;
  amount bigint;
  prior public.currency_ledger%rowtype;
begin
  if p_request_id is null then raise exception 'Request id is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':fan:' || p_request_id::text, 0));
  select * into prior
  from public.currency_ledger
  where user_id = uid and currency = 'coins' and idempotency_key = p_request_id;
  if found then
    return jsonb_build_object('coins', prior.delta, 'balance', prior.balance_after, 'duplicate', true);
  end if;
  insert into public.economy_accounts(user_id, coins) values(uid, 500) on conflict do nothing;
  select * into account from public.economy_accounts where user_id = uid for update;
  buckets := least(32, greatest(0, floor(extract(epoch from(now() - account.last_claim_at)) / 900)::int));
  amount := floor(buckets * account.fans * .01 * .25)::bigint;
  if buckets = 0 or amount = 0 then
    return jsonb_build_object('coins', 0, 'balance', account.coins, 'duplicate', false);
  end if;
  perform set_config('app.currency_reason', 'fan_claim', true);
  perform set_config('app.currency_reference_type', 'fan_claim', true);
  perform set_config('app.currency_reference_id', p_request_id::text, true);
  perform set_config('app.currency_idempotency_key', p_request_id::text, true);
  update public.economy_accounts
  set coins = coins + amount,
      last_claim_at = case
        when buckets = 32 then now()
        else last_claim_at + buckets * interval '15 minutes'
      end,
      updated_at = now()
  where user_id = uid
  returning * into account;
  return jsonb_build_object('coins', amount, 'balance', account.coins, 'duplicate', false);
end;
$$;

create or replace function public.ensure_current_season()
returns public.seasons
language plpgsql
security definer
set search_path = public
as $$
declare
  current public.seasons%rowtype;
  next_number integer;
  next_start date;
  sponsor_pool bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('gridiron-current-season', 0));
  update public.seasons set status = 'complete'
  where ends_on < current_date and status <> 'complete';
  select * into current
  from public.seasons
  where current_date between starts_on and ends_on
  order by season_number desc
  limit 1;
  if found then return current; end if;
  select coalesce(max(season_number), 0) + 1,
    coalesce(max(ends_on) + 1, current_date)
  into next_number, next_start
  from public.seasons;
  if next_start > current_date then next_start := current_date; end if;
  select case
    when real_money_enabled and legal_review_complete and tax_review_complete and security_review_complete
      then sponsor_prize_pool_lamports
    else 0
  end into sponsor_pool
  from public.app_release_controls where singleton = true;
  insert into public.seasons(season_number, starts_on, ends_on, status, prize_pool_lamports)
  values(next_number, next_start, next_start + 9, 'active', coalesce(sponsor_pool, 0))
  returning * into current;
  return current;
end;
$$;

create or replace function public.ensure_user_league(p_user_id uuid)
returns public.league_teams
language plpgsql
security definer
set search_path = public
as $$
declare
  season public.seasons%rowtype := public.ensure_current_season();
  team public.league_teams%rowtype;
  league public.season_leagues%rowtype;
  i integer;
  names text[] := array[
    'Austin Outlaws','Bay City Breakers','Chicago Forge','Denver Summit',
    'Kansas City Kings','Miami Voltage','Nashville Hounds','New York Knights',
    'Portland Pioneers','San Diego Surge','Seattle Sentinels','Tulsa Stampede'
  ];
begin
  if p_user_id is null then raise exception 'User is required'; end if;
  select t.* into team
  from public.league_teams t
  join public.season_leagues l on l.id = t.league_id
  where l.season_id = season.id and t.user_id = p_user_id
  limit 1;
  if found then return team; end if;
  if season.prize_pool_lamports > 0 and now() >= public.kickoff_at(season.starts_on) then
    raise exception 'Prize-season enrollment is closed; entry opens with the next season';
  end if;

  select l.* into league
  from public.season_leagues l
  where l.season_id = season.id
    and exists(select 1 from public.league_teams t where t.league_id = l.id and t.user_id is null)
  order by l.league_number
  limit 1
  for update;

  if not found then
    insert into public.season_leagues(season_id, tier, league_number)
    values(
      season.id,
      'backyard',
      coalesce((select max(league_number) + 1 from public.season_leagues where season_id = season.id), 1)
    ) returning * into league;
    for i in 1..12 loop
      insert into public.league_teams(league_id, seat, name, bot_overall)
      values(league.id, i, names[i], public.secure_random_integer(68, 82));
    end loop;
    perform public.seed_league_schedule(league.id, season.id, season.starts_on);
  end if;

  select * into team from public.league_teams
  where league_id = league.id and user_id is null
  order by seat limit 1 for update;
  if not found then return public.ensure_user_league(p_user_id); end if;
  update public.league_teams
  set user_id = p_user_id,
      name = coalesce((select team_name from public.game_profiles where user_id = p_user_id), 'Gridiron Franchise')
  where id = team.id
  returning * into team;
  return team;
end;
$$;

create or replace function public.simulate_season_game(p_game_id uuid)
returns public.season_games
language plpgsql
security definer
set search_path = public
as $$
declare
  game public.season_games%rowtype;
  home_team public.league_teams%rowtype;
  away_team public.league_teams%rowtype;
  home_ovr numeric;
  away_ovr numeric;
  v_home_score integer;
  v_away_score integer;
  home_snap jsonb;
  away_snap jsonb;
  winner uuid;
  loser uuid;
begin
  select * into game from public.season_games where id = p_game_id for update;
  if not found then raise exception 'Game not found'; end if;
  if game.status = 'final' then return game; end if;
  if game.lock_at > now() then raise exception 'Game has not reached kickoff'; end if;
  if game.home_team_id is null or game.away_team_id is null then
    update public.season_games set status = 'bye', played_at = now()
    where id = game.id returning * into game;
    return game;
  end if;
  select * into home_team from public.league_teams where id = game.home_team_id;
  select * into away_team from public.league_teams where id = game.away_team_id;
  home_snap := case when home_team.user_id is null then '[]'::jsonb else public.lineup_snapshot(home_team.user_id) end;
  away_snap := case when away_team.user_id is null then '[]'::jsonb else public.lineup_snapshot(away_team.user_id) end;
  select coalesce(avg((x->>'overall')::numeric), home_team.bot_overall)
  into home_ovr from jsonb_array_elements(home_snap) x;
  select coalesce(avg((x->>'overall')::numeric), away_team.bot_overall)
  into away_ovr from jsonb_array_elements(away_snap) x;
  if home_team.user_id is not null then
    home_ovr := home_ovr - greatest(0, 16 - jsonb_array_length(home_snap)) * .25;
  end if;
  if away_team.user_id is not null then
    away_ovr := away_ovr - greatest(0, 16 - jsonb_array_length(away_snap)) * .25;
  end if;
  v_home_score := greatest(3, round(20 + (home_ovr - away_ovr) * .55 + public.secure_random_integer(-7, 10))::int);
  v_away_score := greatest(3, round(19 + (away_ovr - home_ovr) * .55 + public.secure_random_integer(-7, 10))::int);
  v_home_score := v_home_score - mod(v_home_score, 3);
  v_away_score := v_away_score - mod(v_away_score, 3);
  if v_home_score = v_away_score then v_home_score := v_home_score + 3; end if;
  winner := case when v_home_score > v_away_score then home_team.id else away_team.id end;
  loser := case when winner = home_team.id then away_team.id else home_team.id end;
  update public.season_games
  set status = 'final',
      home_score = v_home_score,
      away_score = v_away_score,
      winner_team_id = winner,
      home_lineup = home_snap,
      away_lineup = away_snap,
      simulation = jsonb_build_object(
        'algorithmVersion', 2,
        'homeOverall', round(home_ovr, 1),
        'awayOverall', round(away_ovr, 1),
        'missedLineupRule', 'Incomplete saved lineups receive a preparation penalty.',
        'playByPlay', jsonb_build_array(
          'Kickoff — both franchises trade early possessions.',
          format('Halftime — %s %s, %s %s.', home_team.name, floor(v_home_score / 2), away_team.name, floor(v_away_score / 2)),
          format('Final — %s %s, %s %s.', home_team.name, v_home_score, away_team.name, v_away_score)
        )
      ),
      played_at = now()
  where id = game.id
  returning * into game;
  if game.round = 'regular' then
    update public.league_teams
    set wins = wins + case when id = winner then 1 else 0 end,
        losses = losses + case when id <> winner then 1 else 0 end,
        points_for = points_for + case when id = home_team.id then v_home_score else v_away_score end,
        points_against = points_against + case when id = home_team.id then v_away_score else v_home_score end
    where id in (home_team.id, away_team.id);
  else
    update public.league_teams set eliminated = true where id = loser;
  end if;
  return game;
end;
$$;

create or replace function public.create_playoff_round(p_league_id uuid, p_day integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  league public.season_leagues%rowtype;
  season public.seasons%rowtype;
  ranked uuid[];
  prior uuid[];
begin
  select * into league from public.season_leagues where id = p_league_id;
  if not found then raise exception 'League not found'; end if;
  select * into season from public.seasons where id = league.season_id;
  if p_day = 8 then
    if (select count(*) from public.season_games where league_id = p_league_id and round = 'regular' and status = 'final') <> 42 then return; end if;
    select array_agg(id order by wins desc, (points_for-points_against) desc, points_for desc, id)
    into ranked from public.league_teams where league_id = p_league_id;
    update public.league_teams t set playoff_seed = s.seed
    from (
      select id, row_number() over(order by wins desc, (points_for-points_against) desc, points_for desc, id)::smallint seed
      from public.league_teams where league_id = p_league_id
    ) s where t.id = s.id;
    insert into public.season_games(season_id,league_id,day_number,round,game_number,home_team_id,away_team_id,lock_at)
    values
      (season.id,p_league_id,8,'quarterfinal',1,ranked[1],ranked[8],public.kickoff_at(season.starts_on+7)),
      (season.id,p_league_id,8,'quarterfinal',2,ranked[4],ranked[5],public.kickoff_at(season.starts_on+7)),
      (season.id,p_league_id,8,'quarterfinal',3,ranked[2],ranked[7],public.kickoff_at(season.starts_on+7)),
      (season.id,p_league_id,8,'quarterfinal',4,ranked[3],ranked[6],public.kickoff_at(season.starts_on+7))
    on conflict do nothing;
  elsif p_day = 9 then
    if (select count(*) from public.season_games where league_id = p_league_id and day_number = 8 and status = 'final') <> 4 then return; end if;
    select array_agg(winner_team_id order by game_number) into prior
    from public.season_games where league_id = p_league_id and day_number = 8 and status = 'final';
    insert into public.season_games(season_id,league_id,day_number,round,game_number,home_team_id,away_team_id,lock_at)
    values
      (season.id,p_league_id,9,'semifinal',1,prior[1],prior[2],public.kickoff_at(season.starts_on+8)),
      (season.id,p_league_id,9,'semifinal',2,prior[3],prior[4],public.kickoff_at(season.starts_on+8))
    on conflict do nothing;
  elsif p_day = 10 then
    if (select count(*) from public.season_games where league_id = p_league_id and day_number = 9 and status = 'final') <> 2 then return; end if;
    select array_agg(winner_team_id order by game_number) into prior
    from public.season_games where league_id = p_league_id and day_number = 9 and status = 'final';
    insert into public.season_games(season_id,league_id,day_number,round,game_number,home_team_id,away_team_id,lock_at)
    values(season.id,p_league_id,10,'championship',1,prior[1],prior[2],public.kickoff_at(season.starts_on+9))
    on conflict do nothing;
  end if;
end;
$$;

create or replace function public.set_authoritative_lineup(p_slot text, p_card_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_current_legal_acceptance();
  card public.player_cards%rowtype;
  accepted text[];
  fans bigint;
  team public.league_teams%rowtype;
begin
  team := public.ensure_user_league(uid);
  -- Finalize every game whose lock has passed before accepting a lineup edit.
  -- This prevents a late edit from changing a lineup retroactively.
  perform public.process_due_league_games(team.league_id);
  if p_slot not in ('QB','RB','FLEX','WR1','WR2','TE','OL','K','P','DL','LB1','LB2','DB1','DB2','DB3','DFLEX') then
    raise exception 'Invalid lineup slot';
  end if;
  if p_card_id is not null then
    select * into card from public.player_cards
    where id = p_card_id and owner_id = uid and status = 'owned' for update;
    if not found then raise exception 'You do not own this available card'; end if;
    accepted := case
      when p_slot = 'FLEX' then array['RB','WR','TE']
      when p_slot = 'DFLEX' then array['LB','DB']
      else array[regexp_replace(p_slot, '[0-9]+$', '')]
    end;
    if not card.position = any(accepted) then raise exception 'Card is not eligible for this slot'; end if;
    update public.starting_lineups set card_id = null, updated_at = now()
    where user_id = uid and card_id = p_card_id;
  end if;
  insert into public.starting_lineups(user_id, slot, card_id)
  values(uid, p_slot, p_card_id)
  on conflict(user_id, slot) do update set card_id = excluded.card_id, updated_at = now();
  fans := public.recalculate_fans(uid);
  return jsonb_build_object('slot', p_slot, 'cardId', p_card_id, 'fans', fans);
end;
$$;

create or replace function public.get_game_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_current_legal_acceptance();
  team public.league_teams%rowtype;
  season public.seasons%rowtype;
  league_id uuid;
begin
  team := public.ensure_user_league(uid);
  league_id := team.league_id;
  perform public.process_due_league_games(league_id);
  select s.* into season from public.seasons s
  join public.season_leagues l on l.season_id = s.id
  where l.id = league_id;
  select lt.* into team
  from public.league_teams lt
  where lt.id = team.id;
  return jsonb_build_object(
    'account', (
      select to_jsonb(a) from (
        select e.coins,e.fans,e.last_claim_at,g.balance as gridiron_cash,p.team_name,p.level,p.xp,
          p.packs_opened,p.starter_pack_opened,p.lifetime_wins,p.lifetime_losses
        from public.economy_accounts e
        join public.game_profiles p on p.user_id=e.user_id
        left join public.gridiron_cash_accounts g on g.user_id=e.user_id
        where e.user_id=uid
      ) a
    ),
    'roster', (select coalesce(jsonb_agg(public.card_json(c) order by c.acquired_at),'[]'::jsonb) from public.player_cards c where c.owner_id=uid and c.status in('owned','listed')),
    'lineup', (select coalesce(jsonb_object_agg(slot,card_id::text),'{}'::jsonb) from public.starting_lineups where user_id=uid),
    'season', jsonb_build_object('id',season.id,'number',season.season_number,'startsOn',season.starts_on,'endsOn',season.ends_on,'day',least(10,greatest(1,current_date-season.starts_on+1)),'leagueId',league_id,'prizePoolLamports',season.prize_pool_lamports),
    'team', to_jsonb(team),
    'standings', (select coalesce(jsonb_agg(to_jsonb(t) order by wins desc,(points_for-points_against) desc,points_for desc,t.id),'[]'::jsonb) from public.league_teams t where t.league_id=league_id),
    'games', (select coalesce(jsonb_agg(to_jsonb(g) order by day_number,game_number),'[]'::jsonb) from public.season_games g where g.league_id=league_id),
    'rewards', (select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from public.season_rewards r where r.user_id=uid),
    'pendingClaim', public.get_pending_fan_claim()
  );
end;
$$;

create or replace function public.process_all_due_season_games()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  league record;
  processed integer := 0;
begin
  perform public.ensure_current_season();
  for league in
    select l.id from public.season_leagues l
    join public.seasons s on s.id = l.season_id
    where s.status in ('active','complete') and s.ends_on >= current_date - 1
  loop
    processed := processed + public.process_due_league_games(league.id);
  end loop;
  return processed;
end;
$$;

-- Scouting data is generated or selected by the server. Bot cards are a
-- deterministic presentation of the same bot rating, so refreshes cannot
-- reroll an easier or more impressive opponent.
create or replace function public.bot_scouting_cards(p_team public.league_teams)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rarity text := case when p_team.bot_overall >= 85 then 'elite' when p_team.bot_overall >= 80 then 'gold' when p_team.bot_overall >= 70 then 'silver' else 'bronze' end;
begin
  return jsonb_build_array(
    jsonb_build_object('id',p_team.id::text||'-qb','name',p_team.name||' Field General','position','QB','overall',p_team.bot_overall,'strength',greatest(60,p_team.bot_overall-5),'speed',greatest(60,p_team.bot_overall-2),'iq',least(99,p_team.bot_overall+4),'popularity',p_team.bot_overall,'fanValue',0,'rarity',rarity,'signature',jsonb_build_object('key','accuracy','label','Accuracy','value',least(99,p_team.bot_overall+3))),
    jsonb_build_object('id',p_team.id::text||'-wr','name',p_team.name||' Playmaker','position','WR','overall',greatest(60,p_team.bot_overall-1),'strength',greatest(60,p_team.bot_overall-7),'speed',least(99,p_team.bot_overall+4),'iq',p_team.bot_overall,'popularity',greatest(60,p_team.bot_overall-1),'fanValue',0,'rarity',rarity,'signature',jsonb_build_object('key','routeRunning','label','Route Running','value',least(99,p_team.bot_overall+2))),
    jsonb_build_object('id',p_team.id::text||'-lb','name',p_team.name||' Defensive Captain','position','LB','overall',greatest(60,p_team.bot_overall-2),'strength',least(99,p_team.bot_overall+3),'speed',greatest(60,p_team.bot_overall-2),'iq',least(99,p_team.bot_overall+1),'popularity',greatest(60,p_team.bot_overall-2),'fanValue',0,'rarity',rarity,'signature',jsonb_build_object('key','tackling','label','Tackling','value',least(99,p_team.bot_overall+3)))
  );
end;
$$;

create or replace function public.get_today_official_game()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_current_legal_acceptance();
  v_team public.league_teams%rowtype;
  v_game public.season_games%rowtype;
  v_opponent public.league_teams%rowtype;
  v_season public.seasons%rowtype;
  v_day integer;
  v_top_players jsonb;
begin
  v_team := public.ensure_user_league(uid);
  perform public.process_due_league_games(v_team.league_id);
  select s.* into v_season from public.seasons s
  join public.season_leagues l on l.season_id = s.id
  where l.id = v_team.league_id;
  v_day := least(10, greatest(1, current_date - v_season.starts_on + 1));
  select * into v_game from public.season_games
  where league_id = v_team.league_id
    and (home_team_id = v_team.id or away_team_id = v_team.id)
    and day_number = v_day
  order by game_number limit 1;
  if not found then return null; end if;
  select * into v_opponent from public.league_teams
  where id = case when v_game.home_team_id = v_team.id then v_game.away_team_id else v_game.home_team_id end;
  if v_opponent.user_id is null then
    v_top_players := public.bot_scouting_cards(v_opponent);
  else
    select coalesce(jsonb_agg(card), '[]'::jsonb) into v_top_players
    from (
      select public.card_json(c) card
      from public.starting_lineups l
      join public.player_cards c on c.id = l.card_id
      where l.user_id = v_opponent.user_id and c.owner_id = v_opponent.user_id and c.status = 'owned'
      order by c.overall desc, c.id
      limit 3
    ) ranked;
  end if;
  return jsonb_build_object(
    'game', to_jsonb(v_game),
    'opponent', jsonb_build_object(
      'id',v_opponent.id,'name',v_opponent.name,'seat',v_opponent.seat,'user_id',null,
      'bot_overall',v_opponent.bot_overall,'wins',v_opponent.wins,'losses',v_opponent.losses,
      'points_for',v_opponent.points_for,'points_against',v_opponent.points_against,
      'playoff_seed',v_opponent.playoff_seed,'final_rank',v_opponent.final_rank
    ),
    'opponentTopPlayers', v_top_players,
    'isHome', v_game.home_team_id = v_team.id
  );
end;
$$;

revoke all on function public.claim_fan_coins(uuid) from public, anon;
revoke all on function public.set_authoritative_lineup(text,uuid) from public, anon;
revoke all on function public.get_game_snapshot() from public, anon;
revoke all on function public.simulate_season_game(uuid) from public, anon, authenticated;
revoke all on function public.create_playoff_round(uuid,integer) from public, anon, authenticated;
revoke all on function public.process_all_due_season_games() from public, anon, authenticated;
revoke all on function public.bot_scouting_cards(public.league_teams) from public, anon, authenticated;
revoke all on function public.get_today_official_game() from public, anon;
grant execute on function public.claim_fan_coins(uuid), public.set_authoritative_lineup(text,uuid),
  public.get_game_snapshot() to authenticated;
grant execute on function public.get_today_official_game() to authenticated;
grant execute on function public.simulate_season_game(uuid), public.create_playoff_round(uuid,integer),
  public.process_all_due_season_games() to service_role;
