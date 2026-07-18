create extension if not exists pgcrypto;

create table if not exists public.gridiron_cash_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  total_purchased bigint not null default 0 check (total_purchased >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.gridiron_cash_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_address text not null,
  expected_lamports bigint not null check (expected_lamports > 0),
  gc_amount bigint not null check (gc_amount > 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed', 'expired')),
  signature text unique,
  current_pool_lamports bigint not null default 0,
  next_pool_lamports bigint not null default 0,
  development_lamports bigint not null default 0,
  failure_reason text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '20 minutes'),
  finalized_at timestamptz
);

create index if not exists gridiron_cash_purchases_user_created_idx
  on public.gridiron_cash_purchases (user_id, created_at desc);

create table if not exists public.gridiron_cash_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta bigint not null,
  reason text not null,
  purchase_id uuid unique references public.gridiron_cash_purchases(id) on delete restrict,
  balance_after bigint not null check (balance_after >= 0),
  created_at timestamptz not null default now()
);

create index if not exists gridiron_cash_ledger_user_created_idx
  on public.gridiron_cash_ledger (user_id, created_at desc);

create table if not exists public.treasury_allocation (
  singleton boolean primary key default true check (singleton),
  current_pool_lamports bigint not null default 0 check (current_pool_lamports >= 0),
  next_pool_lamports bigint not null default 0 check (next_pool_lamports >= 0),
  development_lamports bigint not null default 0 check (development_lamports >= 0),
  updated_at timestamptz not null default now()
);

insert into public.treasury_allocation (singleton)
values (true)
on conflict (singleton) do nothing;

grant select on public.gridiron_cash_accounts to authenticated;
grant all on public.gridiron_cash_accounts to service_role;

grant select on public.gridiron_cash_purchases to authenticated;
grant all on public.gridiron_cash_purchases to service_role;

grant select on public.gridiron_cash_ledger to authenticated;
grant all on public.gridiron_cash_ledger to service_role;

grant select on public.treasury_allocation to authenticated;
grant all on public.treasury_allocation to service_role;

alter table public.gridiron_cash_accounts enable row level security;
alter table public.gridiron_cash_purchases enable row level security;
alter table public.gridiron_cash_ledger enable row level security;
alter table public.treasury_allocation enable row level security;

drop policy if exists "Users can view their GC account" on public.gridiron_cash_accounts;
create policy "Users can view their GC account"
  on public.gridiron_cash_accounts for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can view their GC purchases" on public.gridiron_cash_purchases;
create policy "Users can view their GC purchases"
  on public.gridiron_cash_purchases for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can view their GC ledger" on public.gridiron_cash_ledger;
create policy "Users can view their GC ledger"
  on public.gridiron_cash_ledger for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Authenticated users can view treasury allocation" on public.treasury_allocation;
create policy "Authenticated users can view treasury allocation"
  on public.treasury_allocation for select to authenticated
  using (true);

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
  current_share bigint;
  next_share bigint;
  development_share bigint;
begin
  select * into purchase
  from public.gridiron_cash_purchases
  where id = p_purchase_id and user_id = p_user_id
  for update;

  if not found then raise exception 'Purchase not found'; end if;

  if purchase.status = 'confirmed' then
    if purchase.signature is distinct from p_signature then
      raise exception 'Purchase already finalized with another signature';
    end if;
    return query
      select account.balance, purchase.gc_amount, purchase.expected_lamports,
        purchase.current_pool_lamports, purchase.next_pool_lamports,
        purchase.development_lamports, purchase.finalized_at
      from public.gridiron_cash_accounts account
      where account.user_id = p_user_id;
    return;
  end if;

  if purchase.status <> 'pending' then raise exception 'Purchase is not pending'; end if;

  if purchase.expires_at < now() then
    update public.gridiron_cash_purchases
      set status = 'expired', failure_reason = 'Payment intent expired'
      where id = purchase.id;
    raise exception 'Purchase expired';
  end if;

  if exists (
    select 1 from public.gridiron_cash_purchases
    where signature = p_signature and id <> purchase.id
  ) then
    raise exception 'Transaction signature has already been redeemed';
  end if;

  current_share := floor(purchase.expected_lamports * 0.60)::bigint;
  next_share := floor(purchase.expected_lamports * 0.20)::bigint;
  development_share := purchase.expected_lamports - current_share - next_share;

  insert into public.gridiron_cash_accounts (user_id, balance, total_purchased)
  values (p_user_id, purchase.gc_amount, purchase.gc_amount)
  on conflict (user_id) do update
    set balance = public.gridiron_cash_accounts.balance + excluded.balance,
        total_purchased = public.gridiron_cash_accounts.total_purchased + excluded.total_purchased,
        updated_at = now()
  returning public.gridiron_cash_accounts.balance into new_balance;

  update public.gridiron_cash_purchases
    set status = 'confirmed', signature = p_signature,
        current_pool_lamports = current_share,
        next_pool_lamports = next_share,
        development_lamports = development_share,
        finalized_at = now(), failure_reason = null
    where id = purchase.id
    returning public.gridiron_cash_purchases.finalized_at into purchase.finalized_at;

  insert into public.gridiron_cash_ledger (user_id, delta, reason, purchase_id, balance_after)
  values (p_user_id, purchase.gc_amount, 'sol_purchase', purchase.id, new_balance);

  insert into public.treasury_allocation (
    singleton, current_pool_lamports, next_pool_lamports, development_lamports
  ) values (true, current_share, next_share, development_share)
  on conflict (singleton) do update
    set current_pool_lamports = public.treasury_allocation.current_pool_lamports + excluded.current_pool_lamports,
        next_pool_lamports = public.treasury_allocation.next_pool_lamports + excluded.next_pool_lamports,
        development_lamports = public.treasury_allocation.development_lamports + excluded.development_lamports,
        updated_at = now();

  return query select new_balance, purchase.gc_amount, purchase.expected_lamports,
    current_share, next_share, development_share, purchase.finalized_at;
end;
$$;

revoke all on function public.finalize_gridiron_cash_purchase(uuid, uuid, text) from public;
revoke all on function public.finalize_gridiron_cash_purchase(uuid, uuid, text) from anon;
revoke all on function public.finalize_gridiron_cash_purchase(uuid, uuid, text) from authenticated;
grant execute on function public.finalize_gridiron_cash_purchase(uuid, uuid, text) to service_role;