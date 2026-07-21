-- Avoid PL/pgSQL variable/column ambiguity in the authoritative snapshot.

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
  v_league_id uuid;
begin
  team := public.ensure_user_league(uid);
  v_league_id := team.league_id;
  perform public.process_due_league_games(v_league_id);

  select s.* into season
  from public.seasons s
  join public.season_leagues l on l.season_id = s.id
  where l.id = v_league_id;

  select lt.* into team
  from public.league_teams lt
  where lt.id = team.id;

  return jsonb_build_object(
    'account', (
      select to_jsonb(a) from (
        select e.coins,e.fans,e.last_claim_at,g.balance as gridiron_cash,p.team_name,p.level,p.xp,
          p.packs_opened,p.starter_pack_opened,p.lifetime_wins,p.lifetime_losses
        from public.economy_accounts e
        join public.game_profiles p on p.user_id = e.user_id
        left join public.gridiron_cash_accounts g on g.user_id = e.user_id
        where e.user_id = uid
      ) a
    ),
    'roster', (
      select coalesce(jsonb_agg(public.card_json(c) order by c.acquired_at), '[]'::jsonb)
      from public.player_cards c
      where c.owner_id = uid and c.status in ('owned', 'listed')
    ),
    'lineup', (
      select coalesce(jsonb_object_agg(l.slot, l.card_id::text), '{}'::jsonb)
      from public.starting_lineups l
      where l.user_id = uid
    ),
    'season', jsonb_build_object(
      'id', season.id,
      'number', season.season_number,
      'startsOn', season.starts_on,
      'endsOn', season.ends_on,
      'day', least(10, greatest(1, current_date - season.starts_on + 1)),
      'leagueId', v_league_id,
      'prizePoolLamports', season.prize_pool_lamports
    ),
    'team', to_jsonb(team),
    'standings', (
      select coalesce(
        jsonb_agg(to_jsonb(t) order by t.wins desc, (t.points_for-t.points_against) desc, t.points_for desc, t.id),
        '[]'::jsonb
      )
      from public.league_teams t
      where t.league_id = v_league_id
    ),
    'games', (
      select coalesce(jsonb_agg(to_jsonb(g) order by g.day_number, g.game_number), '[]'::jsonb)
      from public.season_games g
      where g.league_id = v_league_id
    ),
    'rewards', (
      select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
      from public.season_rewards r
      where r.user_id = uid
    ),
    'pendingClaim', public.get_pending_fan_claim()
  );
end;
$$;
