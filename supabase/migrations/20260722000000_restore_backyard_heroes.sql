-- Restore the fixed Backyard/Hometown Heroes identities to authoritative packs.
-- The secure pack migration preserved the promo flag but accidentally generated
-- a Base Program identity for every promotional pull.

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
  hero_specs jsonb := '[
    {"name":"Busta \"Fly\" Jones","rarity":"gold","position":"WR","overall":82,"strength":78,"speed":94,"iq":68,"popularity":88},
    {"name":"Josiah \"The Messiah\" Ball","rarity":"gold","position":"WR","overall":84,"strength":80,"speed":90,"iq":86,"popularity":92},
    {"name":"Creighton Murray","rarity":"gold","position":"QB","overall":83,"strength":82,"speed":74,"iq":90,"popularity":84},
    {"name":"Gringo Guth","rarity":"gold","position":"RB","overall":82,"strength":89,"speed":85,"iq":74,"popularity":82},
    {"name":"Sleepy Cringle","rarity":"gold","position":"DL","overall":82,"strength":92,"speed":74,"iq":82,"popularity":80},
    {"name":"Talon \"7 Iron\" Reynolds","rarity":"gold","position":"DB","overall":83,"strength":76,"speed":92,"iq":88,"popularity":81},
    {"name":"Ty \"Teethman\" Smith","rarity":"gold","position":"LB","overall":82,"strength":90,"speed":82,"iq":85,"popularity":80},
    {"name":"Josiah \"8 Man\" Mettling","rarity":"gold","position":"LB","overall":84,"strength":92,"speed":84,"iq":86,"popularity":83},
    {"name":"Breck \"Coach Razor\" Guthrie","rarity":"gold","position":"RB","overall":83,"strength":86,"speed":88,"iq":82,"popularity":85},
    {"name":"Gary Gainz","rarity":"elite","position":"OL","overall":86,"strength":94,"speed":74,"iq":88,"popularity":90}
  ]'::jsonb;
  hero jsonb;
  card_name text;
  ovr_min integer;
  ovr_max integer;
  ovr integer;
  str_value integer;
  speed_value integer;
  iq_value integer;
  pop integer;
  rarity_multiplier integer;
  sig jsonb;
  created public.player_cards%rowtype;
begin
  if p_owner_id is null or p_opening_id is null then
    raise exception 'Pack ownership reference required';
  end if;
  if p_rarity not in ('bronze','silver','gold','elite') then
    raise exception 'Invalid rarity';
  end if;
  if p_program not in ('base','hometown_heroes') then
    raise exception 'Invalid program';
  end if;

  if p_program = 'hometown_heroes' then
    hero := hero_specs -> public.secure_random_integer(
      0,
      jsonb_array_length(hero_specs) - 1
    );
    card_name := hero->>'name';
    p_rarity := hero->>'rarity';
    chosen_position := hero->>'position';
    ovr := (hero->>'overall')::integer;
    str_value := (hero->>'strength')::integer;
    speed_value := (hero->>'speed')::integer;
    iq_value := (hero->>'iq')::integer;
    pop := (hero->>'popularity')::integer;
  else
    if chosen_position not in ('QB','RB','WR','TE','OL','DL','LB','DB','K','P') then
      raise exception 'Invalid position';
    end if;
    case p_rarity
      when 'bronze' then ovr_min := 60; ovr_max := 69;
      when 'silver' then ovr_min := 70; ovr_max := 79;
      when 'gold' then ovr_min := 80; ovr_max := 84;
      else ovr_min := 85; ovr_max := 86;
    end case;
    card_name := public.base_card_name(p_rarity, chosen_position);
    ovr := public.secure_random_integer(ovr_min, ovr_max);
    str_value := greatest(40, least(99, ovr + public.secure_random_integer(-8, 8)));
    speed_value := greatest(40, least(99, ovr + public.secure_random_integer(-8, 8)));
    iq_value := greatest(40, least(99, ovr + public.secure_random_integer(-8, 8)));
    pop := greatest(
      30,
      least(99, round(ovr * .72 + public.secure_random_integer(-8, 16))::integer)
    );
  end if;

  rarity_multiplier := case p_rarity
    when 'bronze' then 1
    when 'silver' then 2
    when 'gold' then 3
    else 6
  end;
  sig := public.position_signature(chosen_position);

  insert into public.player_cards(
    owner_id, pack_opening_id, program, name, position, overall,
    strength, speed, iq, popularity, fan_value, rarity,
    signature_key, signature_label, signature_value
  ) values (
    p_owner_id,
    p_opening_id,
    p_program,
    card_name,
    chosen_position,
    ovr,
    str_value,
    speed_value,
    iq_value,
    pop,
    round(
      power(greatest(0, ovr - 50), 2)
      * (.5 + pop / 200.0)
      * rarity_multiplier
    )::integer,
    p_rarity,
    sig->>'key',
    sig->>'label',
    case
      when p_program = 'hometown_heroes' then ovr
      else greatest(40, least(99, ovr + public.secure_random_integer(-8, 8)))
    end
  ) returning * into created;

  return created;
end;
$$;

revoke all on function public.create_random_card(uuid,uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.create_random_card(uuid,uuid,text,text,text)
  to service_role;
