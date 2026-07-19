-- Operational controls that make beta boundaries enforceable and keep future
-- real-value features fail-closed until professional reviews are recorded.

alter table public.app_release_controls
  add column if not exists operator_identity_complete boolean not null default false,
  add column if not exists jurisdiction_controls_complete boolean not null default false,
  add column if not exists consumer_protection_review_complete boolean not null default false,
  add column if not exists financial_compliance_review_complete boolean not null default false,
  add column if not exists incident_response_ready boolean not null default false,
  add column if not exists reconciliation_ready boolean not null default false;

update public.app_release_controls
set real_money_enabled = false,
    real_sol_market_enabled = false,
    purchase_funded_prizes = false,
    sponsor_prize_pool_lamports = 0,
    updated_at = now()
where singleton;

update public.treasury_allocation
set current_pool_lamports=0,next_pool_lamports=0,development_lamports=0,updated_at=now()
where singleton;

create table if not exists public.release_allowed_countries (
  release_mode text not null check (release_mode in ('beta_devnet','testnet','mainnet')),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  enabled boolean not null default false,
  approval_reference text,
  approved_at timestamptz,
  primary key (release_mode, country_code)
);

insert into public.release_allowed_countries(release_mode,country_code,enabled,approval_reference)
values ('beta_devnet','US',true,'Adults-only no-value devnet beta')
on conflict(release_mode,country_code) do update
set enabled = excluded.enabled, approval_reference = excluded.approval_reference;

alter table public.release_allowed_countries enable row level security;
drop policy if exists "Read enabled beta countries" on public.release_allowed_countries;
create policy "Read enabled beta countries" on public.release_allowed_countries
for select to anon, authenticated using(enabled);
grant select on public.release_allowed_countries to anon, authenticated;
grant all on public.release_allowed_countries to service_role;

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
  mode text;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  if coalesce(p_age_of_majority_attested, false) is not true then
    raise exception 'Age-of-majority confirmation is required';
  end if;
  if country !~ '^[A-Z]{2}$' then raise exception 'Two-letter country code required'; end if;
  select release_mode into mode from public.app_release_controls where singleton;
  if not exists (
    select 1 from public.release_allowed_countries
    where release_mode = mode and country_code = country and enabled
  ) then
    raise exception 'This release is not available in the selected country';
  end if;
  select jsonb_object_agg(code, version) into versions
  from public.legal_documents where is_current;
  if versions is null or (select count(*) from public.legal_documents where is_current) <> 4 then
    raise exception 'Legal documents are not fully configured';
  end if;
  insert into public.legal_acceptances(
    user_id,terms_version,privacy_version,contest_rules_version,
    purchase_policy_version,age_of_majority_attested,country_code
  ) values (
    uid,versions->>'terms',versions->>'privacy',versions->>'contest_rules',
    versions->>'purchase_policy',true,country
  ) on conflict do nothing;
  return jsonb_build_object('accepted',true,'versions',versions,'country_code',country);
end;
$$;

-- Reconciliation never rewrites the immutable chain receipt. Each review is a
-- new event, preserving who concluded what and when.
create table if not exists public.transaction_reconciliation_events (
  id uuid primary key default gen_random_uuid(),
  signature text not null references public.solana_transaction_records(signature) on delete restrict,
  status text not null check (status in ('pending','matched','mismatch','investigating','reversed_test_record')),
  reviewer_id uuid references auth.users(id) on delete set null,
  evidence_reference text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists transaction_reconciliation_signature_idx
  on public.transaction_reconciliation_events(signature,created_at desc);
alter table public.transaction_reconciliation_events enable row level security;
revoke all on public.transaction_reconciliation_events from public, anon, authenticated;
grant all on public.transaction_reconciliation_events to service_role;

drop trigger if exists reconciliation_events_are_append_only on public.transaction_reconciliation_events;
create trigger reconciliation_events_are_append_only
before update or delete on public.transaction_reconciliation_events
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
  coalesce(reconciliation.status,purchase.accounting_status,record.reconciliation_status) as accounting_status,
  record.recorded_at
from public.solana_transaction_records record
left join public.gridiron_cash_purchases purchase on purchase.id = record.purchase_id
left join public.market_sol_purchases market_purchase on market_purchase.id = record.market_purchase_id
left join public.market_listings listing on listing.id = market_purchase.listing_id
left join lateral (
  select event.status from public.transaction_reconciliation_events event
  where event.signature = record.signature
  order by event.created_at desc limit 1
) reconciliation on true;

revoke all on public.financial_event_export from public, anon, authenticated;
grant select on public.financial_event_export to service_role;

-- Restore the explicit client grant after the fail-closed function policy.
grant execute on function public.accept_current_legal_documents(boolean,text) to authenticated;
