-- Cryptographically generated, idempotent, server-authoritative pack openings.

create or replace function public.secure_random_unit()
returns double precision
language plpgsql
volatile
set search_path = public
as $$
declare
  bytes bytea := gen_random_bytes(4);
  value numeric;
begin
  value := (
    get_byte(bytes, 0)::numeric * 16777216
    + get_byte(bytes, 1)::numeric * 65536
    + get_byte(bytes, 2)::numeric * 256
    + get_byte(bytes, 3)::numeric
  ) / 4294967296.0;
  return value::double precision;
end;
$$;

create or replace function public.secure_random_integer(p_min integer, p_max integer)
returns integer
language plpgsql
volatile
set search_path = public
as $$
begin
  if p_max < p_min then raise exception 'Invalid secure random range'; end if;
  return p_min + floor(public.secure_random_unit() * (p_max - p_min + 1))::integer;
end;
$$;

create or replace function public.roll_pack_rarity(
  p_floor text,
  p_position_pack boolean default false
)
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  r double precision := public.secure_random_unit();
begin
  if p_position_pack then
    if r < .01 then return 'elite';
    elsif r < .06 then return 'gold';
    elsif r < .40 then return 'silver';
    else return 'bronze'; end if;
  end if;
  if p_floor = 'gold' then
    if r < .15 then return 'elite'; else return 'gold'; end if;
  elsif p_floor = 'silver' then
    if r < .05 then return 'elite';
    elsif r < .30 then return 'gold';
    else return 'silver'; end if;
  end if;
  if r < .02 then return 'elite';
  elsif r < .12 then return 'gold';
  elsif r < .40 then return 'silver';
  else return 'bronze'; end if;
end;
$$;

create or replace function public.create_random_card(
  p_owner_id uuid,
  p_opening_id uuid,
  p_rarity text,
  p_position text default null,
  p_program text default 'base'
)
returns public.player_cards
language plpgsql
security definer
set search_path = public
as $$
declare
  positions text[] := array['QB','RB','WR','TE','OL','DL','LB','DB','K','P'];
  chosen_position text := coalesce(
    p_position,
    positions[public.secure_random_integer(1, array_length(positions, 1))]
  );
  ovr_min integer;
  ovr_max integer;
  ovr integer;
  pop integer;
  rarity_multiplier integer;
  sig jsonb := public.position_signature(chosen_position);
  created public.player_cards%rowtype;
begin
  if p_owner_id is null or p_opening_id is null then raise exception 'Pack ownership reference required'; end if;
  if p_rarity not in ('bronze','silver','gold','elite') then raise exception 'Invalid rarity'; end if;
  if p_program not in ('base','hometown_heroes') then raise exception 'Invalid program'; end if;
  if chosen_position not in ('QB','RB','WR','TE','OL','DL','LB','DB','K','P') then
    raise exception 'Invalid position';
  end if;
  case p_rarity
    when 'bronze' then ovr_min := 60; ovr_max := 69; rarity_multiplier := 1;
    when 'silver' then ovr_min := 70; ovr_max := 79; rarity_multiplier := 2;
    when 'gold' then ovr_min := 80; ovr_max := 84; rarity_multiplier := 3;
    else ovr_min := 85; ovr_max := 86; rarity_multiplier := 6;
  end case;
  ovr := public.secure_random_integer(ovr_min, ovr_max);
  pop := greatest(30, least(99, round(ovr * .72 + public.secure_random_integer(-8, 16))::int));

  insert into public.player_cards(
    owner_id, pack_opening_id, program, name, position, overall,
    strength, speed, iq, popularity, fan_value, rarity,
    signature_key, signature_label, signature_value
  ) values (
    p_owner_id,
    p_opening_id,
    p_program,
    public.base_card_name(p_rarity, chosen_position),
    chosen_position,
    ovr,
    greatest(40, least(99, ovr + public.secure_random_integer(-8, 8))),
    greatest(40, least(99, ovr + public.secure_random_integer(-8, 8))),
    greatest(40, least(99, ovr + public.secure_random_integer(-8, 8))),
    pop,
    round(power(greatest(0, ovr - 50), 2) * (.5 + pop / 200.0) * rarity_multiplier)::int,
    p_rarity,
    sig->>'key',
    sig->>'label',
    greatest(40, least(99, ovr + public.secure_random_integer(-8, 8)))
  ) returning * into created;
  return created;
end;
$$;

create or replace function public.open_authoritative_pack(
  p_pack_code text,
  p_currency text,
  p_request_id uuid,
  p_position text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_current_legal_acceptance();
  def public.pack_definitions%rowtype;
  opening public.pack_openings%rowtype;
  profile public.game_profiles%rowtype;
  account public.economy_accounts%rowtype;
  gc public.gridiron_cash_accounts%rowtype;
  cost bigint;
  i integer;
  floor_rarity text;
  rarity text;
  program text;
  card public.player_cards%rowtype;
begin
  if p_request_id is null then raise exception 'Request id is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':' || p_request_id::text, 0));

  select * into opening
  from public.pack_openings
  where user_id = uid and request_id = p_request_id;
  if found then
    return jsonb_build_object(
      'openingId', opening.id,
      'duplicate', true,
      'cards', (
        select jsonb_agg(public.card_json(c) order by oc.slot_number)
        from public.pack_opening_cards oc
        join public.player_cards c on c.id = oc.card_id
        where oc.opening_id = opening.id
      ),
      'odds', opening.odds_snapshot
    );
  end if;

  insert into public.economy_accounts(user_id, coins) values(uid, 500) on conflict do nothing;
  insert into public.gridiron_cash_accounts(user_id, balance, total_purchased) values(uid, 0, 0) on conflict do nothing;
  insert into public.game_profiles(user_id) values(uid) on conflict do nothing;
  select * into profile from public.game_profiles where user_id = uid for update;

  select * into def from public.pack_definitions where code = p_pack_code and active for share;
  if not found then raise exception 'Pack is not available'; end if;
  if def.version <> 1 then raise exception 'Pack algorithm version is not deployed'; end if;

  if p_pack_code = 'starter' then
    if profile.starter_pack_opened then raise exception 'Starter pack already opened'; end if;
    p_currency := 'free';
    p_position := null;
    cost := 0;
  elsif p_currency = 'coins' then
    cost := def.coin_cost;
  elsif p_currency = 'gc' then
    cost := def.gc_cost;
  else
    raise exception 'Invalid payment currency';
  end if;
  if cost is null then raise exception 'Pack is not sold for that currency'; end if;
  if p_pack_code = 'position' then
    if p_position not in ('QB','RB','WR','TE','OL','DL','LB','DB','K','P') then
      raise exception 'Choose a valid position';
    end if;
  else
    p_position := null;
  end if;

  if p_currency = 'coins' then
    select * into account from public.economy_accounts where user_id = uid for update;
    if account.coins < cost then raise exception 'Not enough Coins'; end if;
    perform set_config('app.currency_reason', 'pack_purchase', true);
    perform set_config('app.currency_reference_type', 'pack_request', true);
    perform set_config('app.currency_reference_id', p_request_id::text, true);
    update public.economy_accounts set coins = coins - cost, updated_at = now() where user_id = uid;
  elsif p_currency = 'gc' then
    select * into gc from public.gridiron_cash_accounts where user_id = uid for update;
    if gc.balance < cost then raise exception 'Not enough Gridiron Cash'; end if;
    perform set_config('app.currency_reason', 'pack_purchase', true);
    perform set_config('app.currency_reference_type', 'pack_request', true);
    perform set_config('app.currency_reference_id', p_request_id::text, true);
    update public.gridiron_cash_accounts set balance = balance - cost, updated_at = now() where user_id = uid;
  end if;

  insert into public.pack_openings(
    user_id, request_id, pack_code, pack_version, currency, cost,
    selected_position, odds_snapshot
  ) values (
    uid, p_request_id, p_pack_code, def.version, p_currency, cost,
    p_position, def.odds
  ) returning * into opening;

  for i in 1..def.card_count loop
    floor_rarity := case
      when p_pack_code in ('pro','backyard') and i = def.card_count then 'gold'
      when p_pack_code in ('pro','backyard') and i >= 4 then 'silver'
      when p_pack_code = 'backyard' and i >= 2 then 'silver'
      else 'bronze'
    end;
    rarity := public.roll_pack_rarity(floor_rarity, p_pack_code = 'position');
    program := case
      when p_pack_code = 'backyard' and public.secure_random_unit() < .25 then 'hometown_heroes'
      else 'base'
    end;
    card := public.create_random_card(
      uid,
      opening.id,
      rarity,
      case when p_pack_code = 'position' then p_position else null end,
      program
    );
    insert into public.pack_opening_cards(opening_id, card_id, slot_number)
    values(opening.id, card.id, i);
  end loop;

  update public.game_profiles
  set packs_opened = packs_opened + 1,
      starter_pack_opened = starter_pack_opened or p_pack_code = 'starter',
      updated_at = now()
  where user_id = uid;

  return jsonb_build_object(
    'openingId', opening.id,
    'duplicate', false,
    'cards', (
      select jsonb_agg(public.card_json(c) order by oc.slot_number)
      from public.pack_opening_cards oc
      join public.player_cards c on c.id = oc.card_id
      where oc.opening_id = opening.id
    ),
    'odds', opening.odds_snapshot
  );
end;
$$;

drop trigger if exists pack_openings_are_immutable on public.pack_openings;
create trigger pack_openings_are_immutable
before update or delete on public.pack_openings
for each row execute function public.reject_immutable_financial_change();

drop trigger if exists pack_opening_cards_are_immutable on public.pack_opening_cards;
create trigger pack_opening_cards_are_immutable
before update or delete on public.pack_opening_cards
for each row execute function public.reject_immutable_financial_change();

revoke all on function public.secure_random_unit() from public, anon, authenticated;
revoke all on function public.secure_random_integer(integer,integer) from public, anon, authenticated;
revoke all on function public.roll_pack_rarity(text,boolean) from public, anon, authenticated;
revoke all on function public.create_random_card(uuid,uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.open_authoritative_pack(text,text,uuid,text) from public, anon;
grant execute on function public.open_authoritative_pack(text,text,uuid,text) to authenticated;
grant execute on function public.secure_random_unit(), public.secure_random_integer(integer,integer),
  public.roll_pack_rarity(text,boolean), public.create_random_card(uuid,uuid,text,text,text) to service_role;
