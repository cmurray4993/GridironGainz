-- Fail closed: database helper functions are private unless explicitly listed
-- as a client API below. This prevents direct RPC calls from bypassing the UI.

create or replace function public.bootstrap_game_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_current_legal_acceptance();
  team public.league_teams%rowtype;
begin
  perform set_config('app.currency_reason', 'account_bootstrap', true);
  insert into public.economy_accounts(user_id,coins) values(uid,500) on conflict(user_id) do nothing;
  insert into public.gridiron_cash_accounts(user_id,balance,total_purchased) values(uid,0,0) on conflict(user_id) do nothing;
  insert into public.game_profiles(user_id) values(uid) on conflict(user_id) do nothing;
  insert into public.starting_lineups(user_id,slot)
  select uid,slot
  from unnest(array['QB','RB','FLEX','WR1','WR2','TE','OL','K','P','DL','LB1','LB2','DB1','DB2','DB3','DFLEX']) slot
  on conflict(user_id,slot) do nothing;
  team := public.ensure_user_league(uid);
  perform public.process_due_league_games(team.league_id);
  return public.get_game_snapshot();
end;
$$;

create or replace function public.set_authoritative_team_name(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_current_legal_acceptance();
  clean text := left(trim(coalesce(p_name,'')),24);
begin
  if char_length(clean) < 1 then raise exception 'Team name is required'; end if;
  update public.game_profiles set team_name = clean, updated_at = now() where user_id = uid;
  update public.league_teams set name = clean where user_id = uid;
  return clean;
end;
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- Authentication and consent.
grant execute on function public.get_release_eligibility() to anon, authenticated;
grant execute on function public.accept_current_legal_documents(boolean,text) to authenticated;

-- Read/bootstrap and narrow gameplay mutations. Every function independently
-- validates auth, ownership, current legal consent, and/or idempotency.
grant execute on function public.bootstrap_game_account() to authenticated;
grant execute on function public.get_game_snapshot() to authenticated;
grant execute on function public.get_pending_fan_claim() to authenticated;
grant execute on function public.claim_fan_coins(uuid) to authenticated;
grant execute on function public.set_authoritative_lineup(text,uuid) to authenticated;
grant execute on function public.set_authoritative_team_name(text) to authenticated;
grant execute on function public.open_authoritative_pack(text,text,uuid,text) to authenticated;
grant execute on function public.get_today_official_game() to authenticated;

-- Auction House client API.
grant execute on function public.bootstrap_market_account(bigint) to authenticated;
grant execute on function public.get_my_market_activity() to authenticated;
grant execute on function public.create_market_listing(jsonb,text,text,bigint,bigint,bigint,text,integer) to authenticated;
grant execute on function public.place_market_bid(uuid,bigint) to authenticated;
grant execute on function public.buy_market_listing_coins(uuid) to authenticated;
grant execute on function public.cancel_market_listing(uuid) to authenticated;
grant execute on function public.quick_sell_market_card(text) to authenticated;
grant execute on function public.settle_expired_market_listings() to authenticated;

-- Edge functions and scheduled jobs use the service role. Internal helpers are
-- never callable with an end-user token.
grant execute on all functions in schema public to service_role;
