create or replace function public.get_my_market_activity()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then raise exception 'Sign in required'; end if;

  with my_bids as (
    select listing_id, max(amount) as my_highest_bid
    from public.market_bids
    where bidder_id = uid
    group by listing_id
  ), relevant as (
    select l.*, mb.my_highest_bid
    from public.market_listings l
    left join my_bids mb on mb.listing_id = l.id
    where l.seller_id = uid or l.buyer_id = uid or l.high_bidder_id = uid or mb.listing_id is not null
    order by l.created_at desc
    limit 200
  )
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(
      jsonb_build_object(
        'listing', to_jsonb(relevant) - 'my_highest_bid',
        'myHighestBid', relevant.my_highest_bid
      ) order by relevant.created_at desc
    ), '[]'::jsonb),
    'heldCoins', coalesce(sum(
      case when relevant.status = 'active' and relevant.high_bidder_id = uid
        then relevant.current_bid else 0 end
    ), 0)
  ) into result
  from relevant;

  return result;
end
$$;

revoke all on function public.get_my_market_activity() from public, anon;
grant execute on function public.get_my_market_activity() to authenticated;
revoke all on function public.finalize_market_sol_purchase(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.finalize_market_sol_purchase(uuid,uuid,text) to service_role;
alter table public.market_listings
  add column if not exists buyer_id uuid references auth.users(id) on delete set null;

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
  update public.market_listings set status = 'sold', buyer_id = uid, completed_at = now() where id = listing.id;
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
  update public.market_listings set status = 'sold', buyer_id = p_buyer_id, completed_at = now() where id = listing.id;
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
      update public.market_listings set status = 'sold', buyer_id = listing.high_bidder_id, completed_at = now() where id = listing.id;
    else
      update public.market_cards set status = 'owned', updated_at = now() where card_id = listing.card_id;
      update public.market_listings set status = 'expired', completed_at = now() where id = listing.id;
    end if;
    settled_count := settled_count + 1;
  end loop;
  return settled_count;
end $$;
