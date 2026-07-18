create unique index if not exists market_sol_purchases_one_pending_per_listing_idx
  on public.market_sol_purchases(listing_id)
  where status = 'pending';

create or replace function public.settle_expired_market_listings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  listing public.market_listings%rowtype;
  settled_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;

  update public.market_sol_purchases
  set status = 'expired'
  where status = 'pending' and expires_at <= now();

  for listing in
    select *
    from public.market_listings
    where status = 'active' and expires_at <= now()
    order by expires_at
    for update skip locked
  loop
    if listing.currency = 'coins'
      and listing.sale_type = 'auction'
      and listing.high_bidder_id is not null
      and listing.current_bid is not null
    then
      insert into public.economy_accounts(user_id, coins)
      values (listing.seller_id, listing.current_bid)
      on conflict (user_id) do update
        set coins = public.economy_accounts.coins + excluded.coins,
            updated_at = now();

      update public.market_cards
      set owner_id = listing.high_bidder_id, status = 'owned', updated_at = now()
      where card_id = listing.card_id;

      update public.market_listings
      set status = 'sold', completed_at = now()
      where id = listing.id;
    else
      update public.market_cards
      set status = 'owned', updated_at = now()
      where card_id = listing.card_id;

      update public.market_listings
      set status = 'expired', completed_at = now()
      where id = listing.id;
    end if;

    settled_count := settled_count + 1;
  end loop;

  return settled_count;
end
$$;

revoke all on function public.settle_expired_market_listings() from public, anon;
grant execute on function public.settle_expired_market_listings() to authenticated;
