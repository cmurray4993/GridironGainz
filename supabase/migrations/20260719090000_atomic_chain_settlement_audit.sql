-- A verified transfer and its immutable internal receipt must commit together.

alter table public.gridiron_cash_purchases
  add column if not exists treasury_wallet text;

update public.gridiron_cash_purchases
set treasury_wallet = '8CfcSMpWF7qAm1acso4HjVSeZbFWtTRpj8aGvJ1YvZMu'
where treasury_wallet is null;

alter table public.gridiron_cash_purchases
  alter column treasury_wallet set not null;

create or replace function public.finalize_gridiron_cash_purchase(
  p_purchase_id uuid,
  p_user_id uuid,
  p_signature text
)
returns table (
  balance bigint,
  gc_amount bigint,
  expected_lamports bigint,
  current_pool_lamports bigint,
  next_pool_lamports bigint,
  development_lamports bigint,
  finalized_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  purchase public.gridiron_cash_purchases%rowtype;
  new_balance bigint;
begin
  select * into purchase from public.gridiron_cash_purchases
  where id = p_purchase_id and user_id = p_user_id for update;
  if not found then raise exception 'Purchase not found'; end if;
  if purchase.network <> 'devnet' then raise exception 'Only devnet test purchases are enabled'; end if;
  if purchase.status = 'confirmed' then
    if purchase.signature is distinct from p_signature then raise exception 'Purchase already finalized with another signature'; end if;
    insert into public.solana_transaction_records(
      signature,purchase_id,user_id,network,sender_wallet,treasury_wallet,
      amount_lamports,purpose,reconciliation_status
    ) values (
      p_signature,purchase.id,p_user_id,purchase.network,purchase.wallet_address,
      purchase.treasury_wallet,purchase.expected_lamports,'gridiron_cash_purchase','not_applicable_testnet'
    ) on conflict(signature) do nothing;
    return query select account.balance,purchase.gc_amount,purchase.expected_lamports,
      0::bigint,0::bigint,0::bigint,purchase.finalized_at
    from public.gridiron_cash_accounts account where account.user_id = p_user_id;
    return;
  end if;
  if purchase.status <> 'pending' then raise exception 'Purchase is not pending'; end if;
  if purchase.expires_at < now() then
    update public.gridiron_cash_purchases set status='expired',failure_reason='Payment intent expired' where id=purchase.id;
    raise exception 'Purchase expired';
  end if;
  if exists(select 1 from public.gridiron_cash_purchases where signature=p_signature and id<>purchase.id)
    or exists(select 1 from public.solana_transaction_records where signature=p_signature) then
    raise exception 'Transaction signature has already been redeemed';
  end if;
  perform set_config('app.currency_reason','devnet_gc_purchase',true);
  perform set_config('app.currency_reference_type','gridiron_cash_purchase',true);
  perform set_config('app.currency_reference_id',purchase.id::text,true);
  insert into public.gridiron_cash_accounts(user_id,balance,total_purchased)
  values(p_user_id,purchase.gc_amount,purchase.gc_amount)
  on conflict(user_id) do update set
    balance=public.gridiron_cash_accounts.balance+excluded.balance,
    total_purchased=public.gridiron_cash_accounts.total_purchased+excluded.total_purchased,
    updated_at=now()
  returning public.gridiron_cash_accounts.balance into new_balance;
  update public.gridiron_cash_purchases set
    status='confirmed',signature=p_signature,current_pool_lamports=0,
    next_pool_lamports=0,development_lamports=0,finalized_at=now(),
    failure_reason=null,accounting_status='not_applicable_testnet'
  where id=purchase.id returning public.gridiron_cash_purchases.finalized_at into purchase.finalized_at;
  insert into public.gridiron_cash_ledger(user_id,delta,reason,purchase_id,balance_after)
  values(p_user_id,purchase.gc_amount,'devnet_test_purchase',purchase.id,new_balance);
  insert into public.solana_transaction_records(
    signature,purchase_id,user_id,network,sender_wallet,treasury_wallet,
    amount_lamports,purpose,reconciliation_status
  ) values (
    p_signature,purchase.id,p_user_id,purchase.network,purchase.wallet_address,
    purchase.treasury_wallet,purchase.expected_lamports,'gridiron_cash_purchase','not_applicable_testnet'
  );
  return query select new_balance,purchase.gc_amount,purchase.expected_lamports,
    0::bigint,0::bigint,0::bigint,purchase.finalized_at;
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
  where id=p_purchase_id and buyer_id=p_buyer_id for update;
  if not found then raise exception 'Purchase not found'; end if;
  if purchase.network <> 'devnet' then raise exception 'Only devnet marketplace settlement is enabled'; end if;
  if purchase.status = 'confirmed' then
    if purchase.signature is distinct from p_signature then raise exception 'Purchase already finalized with another signature'; end if;
    insert into public.solana_transaction_records(
      signature,market_purchase_id,user_id,network,sender_wallet,treasury_wallet,
      amount_lamports,purpose,reconciliation_status
    ) values (
      p_signature,purchase.id,p_buyer_id,purchase.network,purchase.buyer_wallet,
      purchase.seller_wallet,purchase.expected_lamports,'market_card_purchase','not_applicable_testnet'
    ) on conflict(signature) do nothing;
    return (select card_data from public.market_listings where id=purchase.listing_id);
  end if;
  if purchase.status <> 'pending' or purchase.expires_at <= now() then raise exception 'Purchase is not active'; end if;
  select * into listing from public.market_listings where id=purchase.listing_id for update;
  if listing.status <> 'active' or listing.sol_lamports is null then raise exception 'Listing is no longer available for SOL Buy Now'; end if;
  select * into card from public.player_cards
  where id=listing.card_id::uuid and owner_id=listing.seller_id and status='listed' for update;
  if not found then raise exception 'Authoritative card is unavailable'; end if;
  if exists(select 1 from public.solana_transaction_records where signature=p_signature)
    or exists(select 1 from public.market_sol_purchases where signature=p_signature and id<>purchase.id) then
    raise exception 'Signature already used';
  end if;
  if listing.high_bidder_id is not null then
    perform set_config('app.currency_reason','market_bid_refund_sol_buy_now',true);
    perform set_config('app.currency_reference_type','market_listing',true);
    perform set_config('app.currency_reference_id',listing.id::text,true);
    update public.economy_accounts set coins=coins+listing.current_bid,updated_at=now()
    where user_id=listing.high_bidder_id;
  end if;
  update public.market_sol_purchases set status='confirmed',signature=p_signature,finalized_at=now() where id=purchase.id;
  update public.player_cards set owner_id=p_buyer_id,status='owned',updated_at=now() where id=card.id;
  update public.market_cards set owner_id=p_buyer_id,status='owned',updated_at=now() where authoritative_card_id=card.id;
  update public.market_listings set status='sold',buyer_id=p_buyer_id,completed_at=now() where id=listing.id;
  insert into public.solana_transaction_records(
    signature,market_purchase_id,user_id,network,sender_wallet,treasury_wallet,
    amount_lamports,purpose,reconciliation_status
  ) values (
    p_signature,purchase.id,p_buyer_id,purchase.network,purchase.buyer_wallet,
    purchase.seller_wallet,purchase.expected_lamports,'market_card_purchase','not_applicable_testnet'
  );
  return public.card_json(card);
end;
$$;

revoke all on function public.finalize_gridiron_cash_purchase(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.finalize_market_sol_purchase(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.finalize_gridiron_cash_purchase(uuid,uuid,text),
  public.finalize_market_sol_purchase(uuid,uuid,text) to service_role;
