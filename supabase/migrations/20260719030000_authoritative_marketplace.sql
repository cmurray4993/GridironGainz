-- Make the Auction House a projection of authoritative player_cards. Browser
-- card JSON is ignored except for identifying the requested card.

alter table public.market_cards
  add column if not exists authoritative_card_id uuid unique
    references public.player_cards(id) on delete restrict;

update public.market_cards mirror
set authoritative_card_id = card.id,
    owner_id = card.owner_id,
    card_data = public.card_json(card),
    status = card.status,
    updated_at = now()
from public.player_cards card
where mirror.card_id = card.id::text;

create index if not exists market_cards_authoritative_idx
  on public.market_cards(authoritative_card_id);

create or replace function public.create_market_listing(
  p_card_data jsonb,
  p_currency text,
  p_sale_type text,
  p_starting_price bigint default null,
  p_buy_now_price bigint default null,
  p_sol_lamports bigint default null,
  p_seller_wallet text default null,
  p_duration_hours integer default 24
)
returns public.market_listings
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_current_legal_acceptance();
  cid uuid;
  card public.player_cards%rowtype;
  official_json jsonb;
  mirror public.market_cards%rowtype;
  created public.market_listings%rowtype;
  min_bid bigint;
  min_buy bigint;
  derived_currency text;
  derived_sale_type text;
  release public.app_release_controls%rowtype;
begin
  begin
    cid := nullif(p_card_data->>'id', '')::uuid;
  exception when others then
    raise exception 'Invalid card id';
  end;

  select * into card
  from public.player_cards
  where id = cid and owner_id = uid
  for update;
  if not found then raise exception 'Card is not owned by this account'; end if;
  if card.status <> 'owned' then raise exception 'Card is already listed or unavailable'; end if;
  if exists (
    select 1 from public.starting_lineups
    where user_id = uid and card_id = card.id
  ) then
    raise exception 'Remove the card from the starting lineup before listing';
  end if;

  min_bid := case card.rarity
    when 'bronze' then 250 when 'silver' then 500 when 'gold' then 1500 else 5000 end;
  min_buy := case card.rarity
    when 'bronze' then 1000 when 'silver' then 2500 when 'gold' then 7500 else 20000 end;

  if p_starting_price is null and p_buy_now_price is null and p_sol_lamports is null then
    raise exception 'Enable at least one sale option';
  end if;
  if p_starting_price is not null and p_starting_price < min_bid then
    raise exception 'Starting bid is below the rarity minimum';
  end if;
  if p_buy_now_price is not null and p_buy_now_price < min_buy then
    raise exception 'Coin Buy Now is below the rarity minimum';
  end if;
  if p_starting_price is not null and p_buy_now_price is not null
    and p_buy_now_price <= p_starting_price then
    raise exception 'Coin Buy Now must be greater than the starting bid';
  end if;
  if p_sol_lamports is not null and p_sol_lamports not between 10000000 and 100000000000 then
    raise exception 'SOL Buy Now must be between 0.01 and 100 SOL';
  end if;
  if p_sol_lamports is not null
    and (p_seller_wallet is null or p_seller_wallet !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$') then
    raise exception 'Connect a valid seller wallet';
  end if;

  if p_sol_lamports is not null then
    select * into release from public.app_release_controls where singleton = true;
    if release.release_mode <> 'beta_devnet'
      and not (
        release.real_money_enabled and release.real_sol_market_enabled
        and release.legal_review_complete and release.tax_review_complete
        and release.security_review_complete
      ) then
      raise exception 'Real-value SOL marketplace settlement is disabled';
    end if;
  end if;

  official_json := public.card_json(card);
  select * into mirror
  from public.market_cards
  where card_id = card.id::text
  for update;
  if found and mirror.status = 'listed' then raise exception 'Card is already listed'; end if;
  if found then
    update public.market_cards
    set authoritative_card_id = card.id,
        owner_id = uid,
        card_data = official_json,
        status = 'owned',
        updated_at = now()
    where card_id = card.id::text;
  else
    insert into public.market_cards (
      card_id, authoritative_card_id, owner_id, card_data, status
    ) values (
      card.id::text, card.id, uid, official_json, 'owned'
    );
  end if;

  derived_currency := case
    when p_starting_price is not null or p_buy_now_price is not null then 'coins'
    else 'sol'
  end;
  derived_sale_type := case when p_starting_price is not null then 'auction' else 'buy_now' end;

  insert into public.market_listings (
    seller_id,
    card_id,
    card_data,
    currency,
    sale_type,
    starting_price,
    buy_now_price,
    sol_lamports,
    seller_wallet,
    expires_at
  ) values (
    uid,
    card.id::text,
    official_json,
    derived_currency,
    derived_sale_type,
    p_starting_price,
    p_buy_now_price,
    p_sol_lamports,
    case when p_sol_lamports is null then null else p_seller_wallet end,
    now() + make_interval(hours => greatest(1, least(coalesce(p_duration_hours, 24), 168)))
  ) returning * into created;

  update public.player_cards set status = 'listed', updated_at = now() where id = card.id;
  update public.market_cards set status = 'listed', updated_at = now() where card_id = card.id::text;
  return created;
end;
$$;

create or replace function public.place_market_bid(p_listing_id uuid, p_amount bigint)
returns table(balance bigint, current_bid bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_current_legal_acceptance();
  listing public.market_listings%rowtype;
  prior_bidder uuid;
  prior_amount bigint := 0;
  bidder_balance bigint;
  debit bigint;
begin
  select * into listing from public.market_listings where id = p_listing_id for update;
  if not found or listing.status <> 'active' or listing.expires_at <= now() then
    raise exception 'Listing is not active';
  end if;
  if listing.starting_price is null then raise exception 'Listing does not accept bids'; end if;
  if listing.seller_id = uid then raise exception 'You cannot bid on your own card'; end if;
  if p_amount < greatest(listing.starting_price, coalesce(listing.current_bid, 0) + 1) then
    raise exception 'Bid is too low';
  end if;

  insert into public.economy_accounts(user_id, coins) values (uid, 500) on conflict do nothing;
  select coins into bidder_balance from public.economy_accounts where user_id = uid for update;
  prior_bidder := listing.high_bidder_id;
  prior_amount := coalesce(listing.current_bid, 0);
  debit := case when prior_bidder = uid then p_amount - prior_amount else p_amount end;
  if bidder_balance < debit then raise exception 'Not enough Coins'; end if;

  perform set_config('app.currency_reason', 'market_bid_hold', true);
  perform set_config('app.currency_reference_type', 'market_listing', true);
  perform set_config('app.currency_reference_id', listing.id::text, true);
  update public.economy_accounts set coins = coins - debit, updated_at = now() where user_id = uid;

  if prior_bidder is not null and prior_bidder <> uid then
    perform set_config('app.currency_reason', 'market_bid_refund', true);
    update public.economy_accounts
    set coins = coins + prior_amount, updated_at = now()
    where user_id = prior_bidder;
  end if;

  insert into public.market_bids(listing_id, bidder_id, amount)
  values (listing.id, uid, p_amount);
  update public.market_listings
  set current_bid = p_amount, high_bidder_id = uid
  where id = listing.id;
  return query select bidder_balance - debit, p_amount;
end;
$$;

create or replace function public.buy_market_listing_coins(p_listing_id uuid)
returns table(balance bigint, card_data jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_current_legal_acceptance();
  listing public.market_listings%rowtype;
  card public.player_cards%rowtype;
  buyer_balance bigint;
begin
  select * into listing from public.market_listings where id = p_listing_id for update;
  if not found or listing.status <> 'active' or listing.expires_at <= now() then
    raise exception 'Listing is not active';
  end if;
  if listing.buy_now_price is null then raise exception 'Listing has no Coin Buy Now option'; end if;
  if listing.seller_id = uid then raise exception 'You cannot buy your own card'; end if;
  select * into card from public.player_cards
  where id = listing.card_id::uuid and owner_id = listing.seller_id and status = 'listed'
  for update;
  if not found then raise exception 'Authoritative card is unavailable'; end if;

  insert into public.economy_accounts(user_id, coins) values (uid, 500) on conflict do nothing;
  select coins into buyer_balance from public.economy_accounts where user_id = uid for update;
  if listing.high_bidder_id is not null then
    perform set_config('app.currency_reason', 'market_bid_refund_buy_now', true);
    perform set_config('app.currency_reference_type', 'market_listing', true);
    perform set_config('app.currency_reference_id', listing.id::text, true);
    update public.economy_accounts
    set coins = coins + listing.current_bid, updated_at = now()
    where user_id = listing.high_bidder_id;
    if listing.high_bidder_id = uid then
      buyer_balance := buyer_balance + listing.current_bid;
    end if;
  end if;
  if buyer_balance < listing.buy_now_price then raise exception 'Not enough Coins'; end if;

  perform set_config('app.currency_reason', 'market_coin_purchase', true);
  update public.economy_accounts
  set coins = coins - listing.buy_now_price, updated_at = now()
  where user_id = uid;
  perform set_config('app.currency_reason', 'market_coin_sale', true);
  insert into public.economy_accounts(user_id, coins)
  values (listing.seller_id, listing.buy_now_price)
  on conflict (user_id) do update
  set coins = public.economy_accounts.coins + excluded.coins, updated_at = now();

  update public.player_cards set owner_id = uid, status = 'owned', updated_at = now() where id = card.id;
  update public.market_cards set owner_id = uid, status = 'owned', updated_at = now() where authoritative_card_id = card.id;
  update public.market_listings set status = 'sold', buyer_id = uid, completed_at = now() where id = listing.id;
  return query select buyer_balance - listing.buy_now_price, public.card_json(card);
end;
$$;

create or replace function public.cancel_market_listing(p_listing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_current_legal_acceptance();
  listing public.market_listings%rowtype;
  card public.player_cards%rowtype;
begin
  select * into listing from public.market_listings where id = p_listing_id for update;
  if not found or listing.seller_id <> uid then raise exception 'Listing not found'; end if;
  if listing.status <> 'active' then raise exception 'Listing is not active'; end if;
  if listing.high_bidder_id is not null then raise exception 'An auction with bids cannot be cancelled'; end if;
  select * into card from public.player_cards where id = listing.card_id::uuid and owner_id = uid for update;
  if not found then raise exception 'Authoritative card is unavailable'; end if;
  update public.market_listings set status = 'cancelled', completed_at = now() where id = listing.id;
  update public.player_cards set status = 'owned', updated_at = now() where id = card.id;
  update public.market_cards set status = 'owned', updated_at = now() where authoritative_card_id = card.id;
  return public.card_json(card);
end;
$$;

create or replace function public.quick_sell_market_card(p_card_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_current_legal_acceptance();
  cid uuid;
  card public.player_cards%rowtype;
  price bigint;
  new_balance bigint;
begin
  begin cid := p_card_id::uuid; exception when others then raise exception 'Invalid card id'; end;
  select * into card from public.player_cards where id = cid and owner_id = uid for update;
  if not found then raise exception 'Card is not owned by this account'; end if;
  if card.status <> 'owned' then raise exception 'Card cannot be quick sold while listed'; end if;
  if exists(select 1 from public.starting_lineups where user_id = uid and card_id = card.id) then
    raise exception 'Remove the card from the starting lineup before quick selling';
  end if;
  price := case card.rarity when 'bronze' then 100 when 'silver' then 200 when 'gold' then 500 else 1000 end;
  perform set_config('app.currency_reason', 'card_quick_sell', true);
  perform set_config('app.currency_reference_type', 'player_card', true);
  perform set_config('app.currency_reference_id', card.id::text, true);
  insert into public.economy_accounts(user_id, coins) values (uid, price)
  on conflict (user_id) do update
  set coins = public.economy_accounts.coins + excluded.coins, updated_at = now()
  returning coins into new_balance;
  update public.player_cards set status = 'burned', updated_at = now() where id = card.id;
  insert into public.market_cards(card_id, authoritative_card_id, owner_id, card_data, status)
  values(card.id::text, card.id, uid, public.card_json(card), 'burned')
  on conflict(card_id) do update set status = 'burned', updated_at = now();
  return jsonb_build_object('handled', true, 'price', price, 'balance', new_balance);
end;
$$;

create or replace function public.finalize_market_sol_purchase(
  p_purchase_id uuid,
  p_buyer_id uuid,
  p_signature text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  purchase public.market_sol_purchases%rowtype;
  listing public.market_listings%rowtype;
  card public.player_cards%rowtype;
begin
  select * into purchase from public.market_sol_purchases
  where id = p_purchase_id and buyer_id = p_buyer_id for update;
  if not found then raise exception 'Purchase not found'; end if;
  if purchase.status = 'confirmed' then
    return (select card_data from public.market_listings where id = purchase.listing_id);
  end if;
  if purchase.network <> 'devnet' then raise exception 'Only devnet marketplace settlement is enabled'; end if;
  if purchase.status <> 'pending' or purchase.expires_at <= now() then
    raise exception 'Purchase is not active';
  end if;
  select * into listing from public.market_listings where id = purchase.listing_id for update;
  if listing.status <> 'active' or listing.sol_lamports is null then
    raise exception 'Listing is no longer available for SOL Buy Now';
  end if;
  select * into card from public.player_cards
  where id = listing.card_id::uuid and owner_id = listing.seller_id and status = 'listed'
  for update;
  if not found then raise exception 'Authoritative card is unavailable'; end if;
  if exists(select 1 from public.market_sol_purchases where signature = p_signature and id <> purchase.id) then
    raise exception 'Signature already used';
  end if;
  if listing.high_bidder_id is not null then
    perform set_config('app.currency_reason', 'market_bid_refund_sol_buy_now', true);
    perform set_config('app.currency_reference_type', 'market_listing', true);
    perform set_config('app.currency_reference_id', listing.id::text, true);
    update public.economy_accounts
    set coins = coins + listing.current_bid, updated_at = now()
    where user_id = listing.high_bidder_id;
  end if;
  update public.market_sol_purchases
  set status = 'confirmed', signature = p_signature, finalized_at = now()
  where id = purchase.id;
  update public.player_cards set owner_id = p_buyer_id, status = 'owned', updated_at = now() where id = card.id;
  update public.market_cards set owner_id = p_buyer_id, status = 'owned', updated_at = now() where authoritative_card_id = card.id;
  update public.market_listings set status = 'sold', buyer_id = p_buyer_id, completed_at = now() where id = listing.id;
  return public.card_json(card);
end;
$$;

create or replace function public.settle_expired_market_listings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  listing public.market_listings%rowtype;
  card public.player_cards%rowtype;
  settled_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  update public.market_sol_purchases set status = 'expired'
  where status = 'pending' and expires_at <= now();
  for listing in
    select * from public.market_listings
    where status = 'active' and expires_at <= now()
    order by expires_at for update skip locked
  loop
    select * into card from public.player_cards where id = listing.card_id::uuid for update;
    if not found then raise exception 'Authoritative card is unavailable'; end if;
    if listing.starting_price is not null and listing.high_bidder_id is not null
      and listing.current_bid is not null then
      perform set_config('app.currency_reason', 'market_auction_sale', true);
      perform set_config('app.currency_reference_type', 'market_listing', true);
      perform set_config('app.currency_reference_id', listing.id::text, true);
      insert into public.economy_accounts(user_id, coins)
      values (listing.seller_id, listing.current_bid)
      on conflict (user_id) do update
      set coins = public.economy_accounts.coins + excluded.coins, updated_at = now();
      update public.player_cards set owner_id = listing.high_bidder_id, status = 'owned', updated_at = now() where id = card.id;
      update public.market_cards set owner_id = listing.high_bidder_id, status = 'owned', updated_at = now() where authoritative_card_id = card.id;
      update public.market_listings
      set status = 'sold', buyer_id = listing.high_bidder_id, completed_at = now()
      where id = listing.id;
    else
      update public.player_cards set status = 'owned', updated_at = now() where id = card.id;
      update public.market_cards set status = 'owned', updated_at = now() where authoritative_card_id = card.id;
      update public.market_listings set status = 'expired', completed_at = now() where id = listing.id;
    end if;
    settled_count := settled_count + 1;
  end loop;
  return settled_count;
end;
$$;

revoke all on function public.create_market_listing(jsonb,text,text,bigint,bigint,bigint,text,integer) from public, anon;
revoke all on function public.place_market_bid(uuid,bigint) from public, anon;
revoke all on function public.buy_market_listing_coins(uuid) from public, anon;
revoke all on function public.cancel_market_listing(uuid) from public, anon;
revoke all on function public.quick_sell_market_card(text) from public, anon;
revoke all on function public.settle_expired_market_listings() from public, anon;
revoke all on function public.finalize_market_sol_purchase(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.create_market_listing(jsonb,text,text,bigint,bigint,bigint,text,integer) to authenticated;
grant execute on function public.place_market_bid(uuid,bigint) to authenticated;
grant execute on function public.buy_market_listing_coins(uuid) to authenticated;
grant execute on function public.cancel_market_listing(uuid) to authenticated;
grant execute on function public.quick_sell_market_card(text) to authenticated;
grant execute on function public.settle_expired_market_listings() to authenticated;
grant execute on function public.finalize_market_sol_purchase(uuid,uuid,text) to service_role;
