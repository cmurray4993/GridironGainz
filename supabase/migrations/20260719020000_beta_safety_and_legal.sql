-- Safety controls for the closed beta. This migration deliberately separates
-- commerce records from contest rewards and makes legal acceptance auditable.

create table if not exists public.app_release_controls (
  singleton boolean primary key default true check (singleton),
  release_mode text not null default 'beta_devnet'
    check (release_mode in ('beta_devnet', 'testnet', 'mainnet')),
  real_money_enabled boolean not null default false,
  purchase_funded_prizes boolean not null default false,
  real_sol_market_enabled boolean not null default false,
  minimum_age integer not null default 18 check (minimum_age between 18 and 99),
  sponsor_prize_pool_lamports bigint not null default 0
    check (sponsor_prize_pool_lamports >= 0),
  legal_review_complete boolean not null default false,
  tax_review_complete boolean not null default false,
  security_review_complete boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.app_release_controls (
  singleton,
  release_mode,
  real_money_enabled,
  purchase_funded_prizes,
  sponsor_prize_pool_lamports
)
values (true, 'beta_devnet', false, false, 0)
on conflict (singleton) do update
set release_mode = 'beta_devnet',
    real_money_enabled = false,
    purchase_funded_prizes = false,
    sponsor_prize_pool_lamports = 0,
    updated_at = now();

alter table public.app_release_controls enable row level security;
drop policy if exists "Anyone can read release controls" on public.app_release_controls;
create policy "Anyone can read release controls"
  on public.app_release_controls for select
  using (true);
grant select on public.app_release_controls to anon, authenticated;
grant all on public.app_release_controls to service_role;

create table if not exists public.legal_documents (
  code text not null check (code in ('terms', 'privacy', 'contest_rules', 'purchase_policy')),
  version text not null,
  effective_at timestamptz not null,
  document_path text not null,
  content_sha256 text,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (code, version)
);

insert into public.legal_documents (code, version, effective_at, document_path, is_current)
values
  ('terms', 'beta-2026-07-19', '2026-07-19T00:00:00Z', '/terms', true),
  ('privacy', 'beta-2026-07-19', '2026-07-19T00:00:00Z', '/privacy', true),
  ('contest_rules', 'beta-2026-07-19', '2026-07-19T00:00:00Z', '/rules', true),
  ('purchase_policy', 'beta-2026-07-19', '2026-07-19T00:00:00Z', '/purchase-policy', true)
on conflict (code, version) do update
set effective_at = excluded.effective_at,
    document_path = excluded.document_path,
    is_current = excluded.is_current;

create unique index if not exists legal_documents_one_current_per_code
  on public.legal_documents (code) where is_current;

alter table public.legal_documents enable row level security;
drop policy if exists "Anyone can read legal documents" on public.legal_documents;
create policy "Anyone can read legal documents"
  on public.legal_documents for select
  using (true);
grant select on public.legal_documents to anon, authenticated;
grant all on public.legal_documents to service_role;

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  contest_rules_version text not null,
  purchase_policy_version text not null,
  age_of_majority_attested boolean not null check (age_of_majority_attested),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  user_agent_sha256 text,
  ip_sha256 text,
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (
    user_id,
    terms_version,
    privacy_version,
    contest_rules_version,
    purchase_policy_version
  )
);

create index if not exists legal_acceptances_user_accepted_idx
  on public.legal_acceptances (user_id, accepted_at desc);

alter table public.legal_acceptances enable row level security;
drop policy if exists "Users can read their legal acceptances" on public.legal_acceptances;
create policy "Users can read their legal acceptances"
  on public.legal_acceptances for select to authenticated
  using (auth.uid() = user_id);
grant select on public.legal_acceptances to authenticated;
grant all on public.legal_acceptances to service_role;

create or replace function public.accept_current_legal_documents(
  p_age_of_majority_attested boolean,
  p_country_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  country text := upper(trim(p_country_code));
  versions jsonb;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  if coalesce(p_age_of_majority_attested, false) is not true then
    raise exception 'Age-of-majority confirmation is required';
  end if;
  if country !~ '^[A-Z]{2}$' then raise exception 'Two-letter country code required'; end if;

  select jsonb_object_agg(code, version) into versions
  from public.legal_documents
  where is_current;

  if versions is null or (select count(*) from public.legal_documents where is_current) <> 4 then
    raise exception 'Legal documents are not fully configured';
  end if;

  insert into public.legal_acceptances (
    user_id,
    terms_version,
    privacy_version,
    contest_rules_version,
    purchase_policy_version,
    age_of_majority_attested,
    country_code
  ) values (
    uid,
    versions->>'terms',
    versions->>'privacy',
    versions->>'contest_rules',
    versions->>'purchase_policy',
    true,
    country
  )
  on conflict do nothing;

  return jsonb_build_object(
    'accepted', true,
    'versions', versions,
    'country_code', country
  );
end;
$$;

create or replace function public.get_release_eligibility()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with current_versions as (
    select jsonb_object_agg(code, version) as versions
    from public.legal_documents
    where is_current
  ), latest_acceptance as (
    select la.*
    from public.legal_acceptances la
    where la.user_id = auth.uid() and la.revoked_at is null
    order by la.accepted_at desc
    limit 1
  )
  select jsonb_build_object(
    'release', to_jsonb(rc),
    'current_versions', cv.versions,
    'accepted', coalesce(
      la.terms_version = cv.versions->>'terms'
      and la.privacy_version = cv.versions->>'privacy'
      and la.contest_rules_version = cv.versions->>'contest_rules'
      and la.purchase_policy_version = cv.versions->>'purchase_policy',
      false
    ),
    'country_code', la.country_code,
    'accepted_at', la.accepted_at
  )
  from public.app_release_controls rc
  cross join current_versions cv
  left join latest_acceptance la on true
  where rc.singleton = true;
$$;

create or replace function public.require_current_legal_acceptance()
returns uuid
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  uid uuid := auth.uid();
  accepted boolean;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  select exists (
    select 1
    from public.legal_acceptances acceptance
    where acceptance.user_id = uid
      and acceptance.revoked_at is null
      and acceptance.age_of_majority_attested
      and acceptance.terms_version = (select version from public.legal_documents where code = 'terms' and is_current)
      and acceptance.privacy_version = (select version from public.legal_documents where code = 'privacy' and is_current)
      and acceptance.contest_rules_version = (select version from public.legal_documents where code = 'contest_rules' and is_current)
      and acceptance.purchase_policy_version = (select version from public.legal_documents where code = 'purchase_policy' and is_current)
  ) into accepted;
  if not accepted then raise exception 'Current legal documents must be accepted'; end if;
  return uid;
end;
$$;

revoke all on function public.accept_current_legal_documents(boolean, text) from public, anon;
grant execute on function public.accept_current_legal_documents(boolean, text) to authenticated;
revoke all on function public.get_release_eligibility() from public, anon;
grant execute on function public.get_release_eligibility() to authenticated;
revoke all on function public.require_current_legal_acceptance() from public, anon, authenticated;

alter table public.gridiron_cash_purchases
  add column if not exists network text not null default 'devnet'
    check (network in ('devnet', 'testnet', 'mainnet-beta')),
  add column if not exists confirmed_slot bigint,
  add column if not exists block_time timestamptz,
  add column if not exists transaction_fee_lamports bigint,
  add column if not exists usd_fmv_cents numeric,
  add column if not exists usd_price_source text,
  add column if not exists accounting_status text not null default 'not_applicable_testnet'
    check (accounting_status in ('not_applicable_testnet', 'pending_valuation', 'reconciled', 'review_required'));

create table if not exists public.solana_transaction_records (
  signature text primary key,
  purchase_id uuid unique references public.gridiron_cash_purchases(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  network text not null check (network in ('devnet', 'testnet', 'mainnet-beta')),
  sender_wallet text not null,
  treasury_wallet text not null,
  amount_lamports bigint not null check (amount_lamports > 0),
  fee_lamports bigint check (fee_lamports >= 0),
  slot bigint,
  block_time timestamptz,
  purpose text not null default 'gridiron_cash_purchase',
  reconciliation_status text not null default 'not_applicable_testnet'
    check (reconciliation_status in ('not_applicable_testnet', 'pending', 'reconciled', 'review_required')),
  recorded_at timestamptz not null default now()
);

alter table public.market_sol_purchases
  add column if not exists network text not null default 'devnet'
    check (network in ('devnet', 'testnet', 'mainnet-beta')),
  add column if not exists confirmed_slot bigint,
  add column if not exists block_time timestamptz,
  add column if not exists transaction_fee_lamports bigint,
  add column if not exists reconciliation_status text not null default 'not_applicable_testnet'
    check (reconciliation_status in ('not_applicable_testnet', 'pending', 'reconciled', 'review_required'));

alter table public.solana_transaction_records
  add column if not exists market_purchase_id uuid unique
    references public.market_sol_purchases(id) on delete restrict;

alter table public.solana_transaction_records
  drop constraint if exists solana_transaction_records_one_purpose;
alter table public.solana_transaction_records
  add constraint solana_transaction_records_one_purpose
  check (num_nonnulls(purchase_id, market_purchase_id) = 1);

create index if not exists solana_transaction_records_user_recorded_idx
  on public.solana_transaction_records (user_id, recorded_at desc);
alter table public.solana_transaction_records enable row level security;
drop policy if exists "Users can read their chain transactions" on public.solana_transaction_records;
create policy "Users can read their chain transactions"
  on public.solana_transaction_records for select to authenticated
  using (auth.uid() = user_id);
grant select on public.solana_transaction_records to authenticated;
grant all on public.solana_transaction_records to service_role;

-- Override the earlier 60/20/20 finalizer. Confirmed beta transactions grant
-- test GC but contribute zero to every prize-allocation column.
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
  select * into purchase
  from public.gridiron_cash_purchases
  where id = p_purchase_id and user_id = p_user_id
  for update;

  if not found then raise exception 'Purchase not found'; end if;
  if purchase.network <> 'devnet' then
    raise exception 'Only devnet test purchases are enabled';
  end if;

  if purchase.status = 'confirmed' then
    if purchase.signature is distinct from p_signature then
      raise exception 'Purchase already finalized with another signature';
    end if;
    return query
      select account.balance, purchase.gc_amount, purchase.expected_lamports,
        0::bigint, 0::bigint, 0::bigint, purchase.finalized_at
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

  insert into public.gridiron_cash_accounts (user_id, balance, total_purchased)
  values (p_user_id, purchase.gc_amount, purchase.gc_amount)
  on conflict (user_id) do update
    set balance = public.gridiron_cash_accounts.balance + excluded.balance,
        total_purchased = public.gridiron_cash_accounts.total_purchased + excluded.total_purchased,
        updated_at = now()
  returning public.gridiron_cash_accounts.balance into new_balance;

  update public.gridiron_cash_purchases
  set status = 'confirmed',
      signature = p_signature,
      current_pool_lamports = 0,
      next_pool_lamports = 0,
      development_lamports = 0,
      finalized_at = now(),
      failure_reason = null,
      accounting_status = 'not_applicable_testnet'
  where id = purchase.id
  returning public.gridiron_cash_purchases.finalized_at into purchase.finalized_at;

  insert into public.gridiron_cash_ledger (user_id, delta, reason, purchase_id, balance_after)
  values (p_user_id, purchase.gc_amount, 'devnet_test_purchase', purchase.id, new_balance);

  return query select new_balance, purchase.gc_amount, purchase.expected_lamports,
    0::bigint, 0::bigint, 0::bigint, purchase.finalized_at;
end;
$$;

revoke all on function public.finalize_gridiron_cash_purchase(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.finalize_gridiron_cash_purchase(uuid, uuid, text) to service_role;

comment on table public.solana_transaction_records is
  'Append-only reconciliation index for verified Solana activity; beta records are devnet and have no tax value.';
comment on column public.app_release_controls.sponsor_prize_pool_lamports is
  'Fixed, predeclared contest funding. Never calculated from player purchases.';

create or replace function public.reject_immutable_financial_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Financial audit records are append-only; create a reversing entry instead';
end;
$$;

drop trigger if exists currency_ledger_is_append_only on public.currency_ledger;
create trigger currency_ledger_is_append_only
before update or delete on public.currency_ledger
for each row execute function public.reject_immutable_financial_change();

drop trigger if exists gc_ledger_is_append_only on public.gridiron_cash_ledger;
create trigger gc_ledger_is_append_only
before update or delete on public.gridiron_cash_ledger
for each row execute function public.reject_immutable_financial_change();

drop trigger if exists solana_records_are_append_only on public.solana_transaction_records;
create trigger solana_records_are_append_only
before update or delete on public.solana_transaction_records
for each row execute function public.reject_immutable_financial_change();

create or replace view public.financial_event_export
with (security_invoker = true)
as
select
  record.signature,
  record.network,
  record.purpose,
  record.user_id as buyer_user_id,
  listing.seller_id as seller_user_id,
  record.sender_wallet,
  record.treasury_wallet as destination_wallet,
  record.amount_lamports,
  record.fee_lamports,
  record.slot,
  record.block_time,
  purchase.gc_amount,
  purchase.usd_fmv_cents,
  purchase.usd_price_source,
  coalesce(purchase.accounting_status, record.reconciliation_status) as accounting_status,
  record.recorded_at
from public.solana_transaction_records record
left join public.gridiron_cash_purchases purchase on purchase.id = record.purchase_id
left join public.market_sol_purchases market_purchase on market_purchase.id = record.market_purchase_id
left join public.market_listings listing on listing.id = market_purchase.listing_id;

revoke all on public.financial_event_export from public, anon, authenticated;
grant select on public.financial_event_export to service_role;

-- Remove any legacy purchase-funded amount from unfinished beta seasons and
-- create future seasons only from the fixed sponsor-funded configuration.
update public.seasons
set prize_pool_lamports = 0
where status <> 'complete';

create or replace function public.ensure_current_season()
returns public.seasons
language plpgsql
security definer
set search_path = public
as $$
declare
  current public.seasons%rowtype;
  next_number int;
  next_start date;
  sponsor_pool bigint;
begin
  select * into current
  from public.seasons
  where current_date between starts_on and ends_on
  order by season_number desc
  limit 1;
  if found then return current; end if;

  select coalesce(max(season_number), 0) + 1,
    coalesce(max(ends_on) + 1, current_date)
  into next_number, next_start
  from public.seasons;
  if next_start > current_date then next_start := current_date; end if;

  select case
    when real_money_enabled and legal_review_complete and tax_review_complete and security_review_complete
      then sponsor_prize_pool_lamports
    else 0
  end
  into sponsor_pool
  from public.app_release_controls
  where singleton = true;

  insert into public.seasons (
    season_number,
    starts_on,
    ends_on,
    status,
    prize_pool_lamports
  ) values (
    next_number,
    next_start,
    next_start + 9,
    'active',
    coalesce(sponsor_pool, 0)
  )
  returning * into current;
  return current;
end;
$$;
