alter table public.market_listings drop constraint if exists market_listings_check;
alter table public.market_listings add constraint market_listings_sale_options_check check (
  (coalesce(starting_price, 0) > 0 or coalesce(buy_now_price, 0) > 0 or coalesce(sol_lamports, 0) > 0)
  and (sol_lamports is null or seller_wallet is not null)
);

alter table public.market_cards drop constraint if exists market_cards_status_check;
alter table public.market_cards add constraint market_cards_status_check
  check (status in ('owned','listed','burned'));

create or replace function public.create_market_listing(
  p_card_data jsonb, p_currency text, p_sale_type text,
  p_starting_price bigint default null, p_buy_now_price bigint default null,
  p_sol_lamports bigint default null, p_seller_wallet text default null,
  p_duration_hours integer default 24
) returns public.market_listings
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); cid text := p_card_data->>'id'; existing public.market_cards%rowtype;
  created public.market_listings%rowtype; pos text := p_card_data->>'position'; rarity text := p_card_data->>'rarity';
  min_bid bigint; min_buy bigint; derived_currency text; derived_sale_type text;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  if cid is null or length(cid) < 8 then raise exception 'Invalid card id'; end if;
  if pos not in ('QB','RB','WR','TE','OL','DL','LB','DB','K','P') then raise exception 'Invalid position'; end if;
  if rarity not in ('bronze','silver','gold','elite') then raise exception 'Invalid rarity'; end if;
  if coalesce((p_card_data->>'overall')::int, 0) not between 60 and 86 then raise exception 'Invalid overall'; end if;
  if coalesce((p_card_data->>'strength')::int, 0) not between 40 and 99
    or coalesce((p_card_data->>'speed')::int, 0) not between 40 and 99
    or coalesce((p_card_data->>'iq')::int, 0) not between 40 and 99
    or coalesce((p_card_data->>'popularity')::int, 0) not between 30 and 99
    then raise exception 'Invalid card attributes'; end if;

  min_bid := case rarity when 'bronze' then 250 when 'silver' then 500 when 'gold' then 1500 else 5000 end;
  min_buy := case rarity when 'bronze' then 1000 when 'silver' then 2500 when 'gold' then 7500 else 20000 end;
  if p_starting_price is null and p_buy_now_price is null and p_sol_lamports is null then raise exception 'Enable at least one sale option'; end if;
  if p_starting_price is not null and p_starting_price < min_bid then raise exception 'Starting bid is below the rarity minimum'; end if;
  if p_buy_now_price is not null and p_buy_now_price < min_buy then raise exception 'Coin Buy Now is below the rarity minimum'; end if;
  if p_starting_price is not null and p_buy_now_price is not null and p_buy_now_price <= p_starting_price then
    raise exception 'Coin Buy Now must be greater than the starting bid';
  end if;
  if p_sol_lamports is not null and p_sol_lamports not between 10000000 and 100000000000 then
    raise exception 'SOL Buy Now must be between 0.01 and 100 SOL';
  end if;
  if p_sol_lamports is not null and (p_seller_wallet is null or p_seller_wallet !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$') then
    raise exception 'Connect a valid seller wallet';
  end if;

  select * into existing from public.market_cards where card_id = cid for update;
  if found and existing.owner_id <> uid then raise exception 'Card is owned by another account'; end if;
  if found and existing.status <> 'owned' then raise exception 'Card is already listed or unavailable'; end if;
  if not found then insert into public.market_cards(card_id, owner_id, card_data) values (cid, uid, p_card_data);
  else update public.market_cards set card_data = p_card_data, updated_at = now() where card_id = cid; end if;

  derived_currency := case when p_starting_price is not null or p_buy_now_price is not null then 'coins' else 'sol' end;
  derived_sale_type := case when p_starting_price is not null then 'auction' else 'buy_now' end;
  insert into public.market_listings(seller_id, card_id, card_data, currency, sale_type, starting_price, buy_now_price, sol_lamports, seller_wallet, expires_at)
  values(uid, cid, p_card_data, derived_currency, derived_sale_type, p_starting_price, p_buy_now_price, p_sol_lamports,
    case when p_sol_lamports is null then null else p_seller_wallet end,
    now() + make_interval(hours => greatest(1, least(coalesce(p_duration_hours, 24), 168)))) returning * into created;
  update public.market_cards set status = 'listed', updated_at = now() where card_id = cid;
  return created;
end $$;

create or replace function public.place_market_bid(p_listing_id uuid, p_amount bigint)
returns table(balance bigint, current_bid bigint)
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); listing public.market_listings%rowtype; prior_bidder uuid; prior_amount bigint; bidder_balance bigint;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  select * into listing from public.market_listings where id = p_listing_id for update;
  if not found or listing.status <> 'active' or listing.expires_at <= now() then raise exception 'Listing is not active'; end if;
  if listing.starting_price is null then raise exception 'Listing does not accept bids'; end if;
  if listing.seller_id = uid then raise exception 'You cannot bid on your own card'; end if;
  if p_amount < greatest(listing.starting_price, coalesce(listing.current_bid, 0) + 1) then raise exception 'Bid is too low'; end if;
  insert into public.economy_accounts(user_id, coins) values (uid, 500) on conflict do nothing;
  select coins into bidder_balance from public.economy_accounts where user_id = uid for update;
  if bidder_balance < p_amount then raise exception 'Not enough market coins'; end if;
  prior_bidder := listing.high_bidder_id; prior_amount := listing.current_bid;
  update public.economy_accounts set coins = coins - p_amount, updated_at = now() where user_id = uid;
  if prior_bidder is not null then update public.economy_accounts set coins = coins + prior_amount, updated_at = now() where user_id = prior_bidder; end if;
  insert into public.market_bids(listing_id, bidder_id, amount) values (listing.id, uid, p_amount);
  update public.market_listings set current_bid = p_amount, high_bidder_id = uid where id = listing.id;
  return query select bidder_balance - p_amount, p_amount;
end $$;

create or replace function public.buy_market_listing_coins(p_listing_id uuid)
returns table(balance bigint, card_data jsonb)
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); listing public.market_listings%rowtype; buyer_balance bigint;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  select * into listing from public.market_listings where id = p_listing_id for update;
  if not found or listing.status <> 'active' or listing.expires_at <= now() then raise exception 'Listing is not active'; end if;
  if listing.buy_now_price is null then raise exception 'Listing has no coin Buy Now option'; end if;
  if listing.seller_id = uid then raise exception 'You cannot buy your own card'; end if;
  if listing.high_bidder_id is not null then
    insert into public.economy_accounts(user_id, coins) values (listing.high_bidder_id, listing.current_bid)
    on conflict (user_id) do update set coins = public.economy_accounts.coins + excluded.coins, updated_at = now();
  end if;
  insert into public.economy_accounts(user_id, coins) values (uid, 500) on conflict do nothing;
  select coins into buyer_balance from public.economy_accounts where user_id = uid for update;
  if buyer_balance < listing.buy_now_price then raise exception 'Not enough market coins'; end if;
  update public.economy_accounts set coins = coins - listing.buy_now_price, updated_at = now() where user_id = uid;
  insert into public.economy_accounts(user_id, coins) values (listing.seller_id, listing.buy_now_price)
    on conflict (user_id) do update set coins = public.economy_accounts.coins + excluded.coins, updated_at = now();
  update public.market_cards set owner_id = uid, status = 'owned', updated_at = now() where card_id = listing.card_id;
  update public.market_listings set status = 'sold', completed_at = now() where id = listing.id;
  return query select buyer_balance - listing.buy_now_price, listing.card_data;
end $$;

create or replace function public.finalize_market_sol_purchase(p_purchase_id uuid, p_buyer_id uuid, p_signature text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare purchase public.market_sol_purchases%rowtype; listing public.market_listings%rowtype;
begin
  select * into purchase from public.market_sol_purchases where id = p_purchase_id and buyer_id = p_buyer_id for update;
  if not found then raise exception 'Purchase not found'; end if;
  if purchase.status = 'confirmed' then return (select card_data from public.market_listings where id = purchase.listing_id); end if;
  if purchase.status <> 'pending' or purchase.expires_at <= now() then raise exception 'Purchase is not active'; end if;
  select * into listing from public.market_listings where id = purchase.listing_id for update;
  if listing.status <> 'active' then raise exception 'Listing is no longer active'; end if;
  if listing.sol_lamports is null then raise exception 'Listing has no SOL Buy Now option'; end if;
  if exists(select 1 from public.market_sol_purchases where signature = p_signature and id <> purchase.id) then raise exception 'Signature already used'; end if;
  if listing.high_bidder_id is not null then
    insert into public.economy_accounts(user_id, coins) values (listing.high_bidder_id, listing.current_bid)
    on conflict (user_id) do update set coins = public.economy_accounts.coins + excluded.coins, updated_at = now();
  end if;
  update public.market_sol_purchases set status = 'confirmed', signature = p_signature, finalized_at = now() where id = purchase.id;
  update public.market_cards set owner_id = p_buyer_id, status = 'owned', updated_at = now() where card_id = listing.card_id;
  update public.market_listings set status = 'sold', completed_at = now() where id = listing.id;
  return listing.card_data;
end $$;

create or replace function public.settle_expired_market_listings() returns integer
language plpgsql security definer set search_path = public as $$
declare listing public.market_listings%rowtype; settled_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  update public.market_sol_purchases set status = 'expired' where status = 'pending' and expires_at <= now();
  for listing in select * from public.market_listings where status = 'active' and expires_at <= now() order by expires_at for update skip locked loop
    if listing.starting_price is not null and listing.high_bidder_id is not null and listing.current_bid is not null then
      insert into public.economy_accounts(user_id, coins) values (listing.seller_id, listing.current_bid)
      on conflict (user_id) do update set coins = public.economy_accounts.coins + excluded.coins, updated_at = now();
      update public.market_cards set owner_id = listing.high_bidder_id, status = 'owned', updated_at = now() where card_id = listing.card_id;
      update public.market_listings set status = 'sold', completed_at = now() where id = listing.id;
    else
      update public.market_cards set status = 'owned', updated_at = now() where card_id = listing.card_id;
      update public.market_listings set status = 'expired', completed_at = now() where id = listing.id;
    end if;
    settled_count := settled_count + 1;
  end loop;
  return settled_count;
end $$;

create or replace function public.quick_sell_market_card(p_card_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); card public.market_cards%rowtype; price bigint; new_balance bigint;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  select * into card from public.market_cards where card_id = p_card_id and owner_id = uid for update;
  if not found then return jsonb_build_object('handled', false); end if;
  if card.status <> 'owned' then raise exception 'Card cannot be quick sold while listed'; end if;
  price := case card.card_data->>'rarity' when 'bronze' then 100 when 'silver' then 200 when 'gold' then 500 else 1000 end;
  insert into public.economy_accounts(user_id, coins) values (uid, price)
  on conflict (user_id) do update set coins = public.economy_accounts.coins + excluded.coins, updated_at = now()
  returning coins into new_balance;
  update public.market_cards set status = 'burned', updated_at = now() where card_id = p_card_id;
  return jsonb_build_object('handled', true, 'price', price, 'balance', new_balance);
end $$;

revoke all on function public.finalize_market_sol_purchase(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.finalize_market_sol_purchase(uuid,uuid,text) to service_role;
grant execute on function public.create_market_listing(jsonb,text,text,bigint,bigint,bigint,text,integer) to authenticated;
grant execute on function public.place_market_bid(uuid,bigint) to authenticated;
grant execute on function public.buy_market_listing_coins(uuid) to authenticated;
grant execute on function public.settle_expired_market_listings() to authenticated;
grant execute on function public.quick_sell_market_card(text) to authenticated;
