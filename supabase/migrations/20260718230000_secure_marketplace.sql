create table if not exists public.economy_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coins bigint not null default 500 check (coins >= 0),
  initialized_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.market_cards (
  card_id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  card_data jsonb not null,
  status text not null default 'owned' check (status in ('owned', 'listed')),
  updated_at timestamptz not null default now()
);

create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null references public.market_cards(card_id) on delete restrict,
  card_data jsonb not null,
  currency text not null check (currency in ('coins', 'sol')),
  sale_type text not null check (sale_type in ('auction', 'buy_now')),
  starting_price bigint,
  buy_now_price bigint,
  sol_lamports bigint,
  current_bid bigint,
  high_bidder_id uuid references auth.users(id) on delete set null,
  seller_wallet text,
  status text not null default 'active' check (status in ('active', 'sold', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  completed_at timestamptz,
  check (
    (currency = 'coins' and sale_type = 'auction' and starting_price > 0 and sol_lamports is null)
    or (currency = 'coins' and sale_type = 'buy_now' and buy_now_price > 0 and sol_lamports is null)
    or (currency = 'sol' and sale_type = 'buy_now' and sol_lamports > 0 and seller_wallet is not null)
  )
);

create index if not exists market_listings_active_idx
  on public.market_listings(status, created_at desc);

create table if not exists public.market_bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.market_listings(id) on delete cascade,
  bidder_id uuid not null references auth.users(id) on delete cascade,
  amount bigint not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists market_bids_listing_idx
  on public.market_bids(listing_id, amount desc);

create table if not exists public.market_sol_purchases (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.market_listings(id) on delete restrict,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  buyer_wallet text not null,
  seller_wallet text not null,
  expected_lamports bigint not null check (expected_lamports > 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'expired', 'failed')),
  signature text unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '20 minutes'),
  finalized_at timestamptz
);

alter table public.economy_accounts enable row level security;
alter table public.market_cards enable row level security;
alter table public.market_listings enable row level security;
alter table public.market_bids enable row level security;
alter table public.market_sol_purchases enable row level security;

create policy "Users view their economy account" on public.economy_accounts
  for select to authenticated using (auth.uid() = user_id);
create policy "Users view owned market cards" on public.market_cards
  for select to authenticated using (auth.uid() = owner_id);
create policy "Authenticated users browse market listings" on public.market_listings
  for select to authenticated using (status = 'active' or auth.uid() = seller_id or auth.uid() = high_bidder_id);
create policy "Users view bids on visible listings" on public.market_bids
  for select to authenticated using (
    exists (select 1 from public.market_listings l where l.id = listing_id and (l.status = 'active' or l.seller_id = auth.uid() or bidder_id = auth.uid()))
  );
create policy "Users view their SOL market purchases" on public.market_sol_purchases
  for select to authenticated using (auth.uid() = buyer_id);

grant select on public.economy_accounts, public.market_cards, public.market_listings,
  public.market_bids, public.market_sol_purchases to authenticated;
grant all on public.economy_accounts, public.market_cards, public.market_listings,
  public.market_bids, public.market_sol_purchases to service_role;

create or replace function public.bootstrap_market_account(p_starting_coins bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare result bigint;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  insert into public.economy_accounts(user_id, coins)
  values (auth.uid(), greatest(0, least(coalesce(p_starting_coins, 500), 10000000)))
  on conflict (user_id) do nothing;
  select coins into result from public.economy_accounts where user_id = auth.uid();
  return result;
end $$;

create or replace function public.create_market_listing(
  p_card_data jsonb,
  p_currency text,
  p_sale_type text,
  p_starting_price bigint default null,
  p_buy_now_price bigint default null,
  p_sol_lamports bigint default null,
  p_seller_wallet text default null,
  p_duration_hours integer default 24
) returns public.market_listings
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cid text := p_card_data->>'id';
  existing public.market_cards%rowtype;
  created public.market_listings%rowtype;
  pos text := p_card_data->>'position';
  rarity text := p_card_data->>'rarity';
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
  if p_currency = 'sol' and (p_seller_wallet is null or p_seller_wallet !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$') then
    raise exception 'Connect a valid seller wallet';
  end if;

  select * into existing from public.market_cards where card_id = cid for update;
  if found and existing.owner_id <> uid then raise exception 'Card is owned by another account'; end if;
  if found and existing.status <> 'owned' then raise exception 'Card is already listed'; end if;
  if not found then
    insert into public.market_cards(card_id, owner_id, card_data) values (cid, uid, p_card_data);
  else
    update public.market_cards set card_data = p_card_data, updated_at = now() where card_id = cid;
  end if;

  insert into public.market_listings(
    seller_id, card_id, card_data, currency, sale_type, starting_price,
    buy_now_price, sol_lamports, seller_wallet, expires_at
  ) values (
    uid, cid, p_card_data, p_currency, p_sale_type, p_starting_price,
    p_buy_now_price, p_sol_lamports, p_seller_wallet,
    now() + make_interval(hours => greatest(1, least(coalesce(p_duration_hours, 24), 168)))
  ) returning * into created;
  update public.market_cards set status = 'listed', updated_at = now() where card_id = cid;
  return created;
end $$;

create or replace function public.place_market_bid(p_listing_id uuid, p_amount bigint)
returns table(balance bigint, current_bid bigint)
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  listing public.market_listings%rowtype;
  prior_bidder uuid;
  prior_amount bigint;
  bidder_balance bigint;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  select * into listing from public.market_listings where id = p_listing_id for update;
  if not found or listing.status <> 'active' or listing.expires_at <= now() then raise exception 'Listing is not active'; end if;
  if listing.currency <> 'coins' or listing.sale_type <> 'auction' then raise exception 'Listing does not accept bids'; end if;
  if listing.seller_id = uid then raise exception 'You cannot bid on your own card'; end if;
  if p_amount < greatest(listing.starting_price, coalesce(listing.current_bid, 0) + 1) then raise exception 'Bid is too low'; end if;

  insert into public.economy_accounts(user_id, coins) values (uid, 500) on conflict do nothing;
  select coins into bidder_balance from public.economy_accounts where user_id = uid for update;
  if bidder_balance < p_amount then raise exception 'Not enough market coins'; end if;
  prior_bidder := listing.high_bidder_id;
  prior_amount := listing.current_bid;
  update public.economy_accounts set coins = coins - p_amount, updated_at = now() where user_id = uid;
  if prior_bidder is not null then
    update public.economy_accounts set coins = coins + prior_amount, updated_at = now() where user_id = prior_bidder;
  end if;
  insert into public.market_bids(listing_id, bidder_id, amount) values (listing.id, uid, p_amount);
  update public.market_listings set current_bid = p_amount, high_bidder_id = uid where id = listing.id;
  return query select bidder_balance - p_amount, p_amount;
end $$;

create or replace function public.buy_market_listing_coins(p_listing_id uuid)
returns table(balance bigint, card_data jsonb)
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  listing public.market_listings%rowtype;
  buyer_balance bigint;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  select * into listing from public.market_listings where id = p_listing_id for update;
  if not found or listing.status <> 'active' or listing.expires_at <= now() then raise exception 'Listing is not active'; end if;
  if listing.currency <> 'coins' or listing.sale_type <> 'buy_now' then raise exception 'Listing is not coin buy-now'; end if;
  if listing.seller_id = uid then raise exception 'You cannot buy your own card'; end if;
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

create or replace function public.cancel_market_listing(p_listing_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); listing public.market_listings%rowtype;
begin
  select * into listing from public.market_listings where id = p_listing_id for update;
  if not found or listing.seller_id <> uid then raise exception 'Listing not found'; end if;
  if listing.status <> 'active' then raise exception 'Listing is not active'; end if;
  if listing.high_bidder_id is not null then raise exception 'An auction with bids cannot be cancelled'; end if;
  update public.market_listings set status = 'cancelled', completed_at = now() where id = listing.id;
  update public.market_cards set status = 'owned', updated_at = now() where card_id = listing.card_id;
  return listing.card_data;
end $$;

create or replace function public.finalize_market_sol_purchase(
  p_purchase_id uuid, p_buyer_id uuid, p_signature text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare purchase public.market_sol_purchases%rowtype; listing public.market_listings%rowtype;
begin
  select * into purchase from public.market_sol_purchases where id = p_purchase_id and buyer_id = p_buyer_id for update;
  if not found then raise exception 'Purchase not found'; end if;
  if purchase.status = 'confirmed' then return (select card_data from public.market_listings where id = purchase.listing_id); end if;
  if purchase.status <> 'pending' or purchase.expires_at <= now() then raise exception 'Purchase is not active'; end if;
  select * into listing from public.market_listings where id = purchase.listing_id for update;
  if listing.status <> 'active' then raise exception 'Listing is no longer active'; end if;
  if exists(select 1 from public.market_sol_purchases where signature = p_signature and id <> purchase.id) then raise exception 'Signature already used'; end if;
  update public.market_sol_purchases set status = 'confirmed', signature = p_signature, finalized_at = now() where id = purchase.id;
  update public.market_cards set owner_id = p_buyer_id, status = 'owned', updated_at = now() where card_id = listing.card_id;
  update public.market_listings set status = 'sold', completed_at = now() where id = listing.id;
  return listing.card_data;
end $$;

revoke all on function public.finalize_market_sol_purchase(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.finalize_market_sol_purchase(uuid, uuid, text) to service_role;
grant execute on function public.bootstrap_market_account(bigint) to authenticated;
grant execute on function public.create_market_listing(jsonb,text,text,bigint,bigint,bigint,text,integer) to authenticated;
grant execute on function public.place_market_bid(uuid,bigint) to authenticated;
grant execute on function public.buy_market_listing_coins(uuid) to authenticated;
grant execute on function public.cancel_market_listing(uuid) to authenticated;
