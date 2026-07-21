-- Audited, account-scoped developer helpers for the no-value devnet beta.
-- The raw one-time invite is never stored in source control or the database.

create table if not exists public.beta_developer_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  claimed_at timestamptz not null default now(),
  disabled_at timestamptz
);

create table if not exists public.beta_developer_invites (
  token_sha256 text primary key check (token_sha256 ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  consumed_by uuid references auth.users(id) on delete set null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

insert into public.beta_developer_invites(token_sha256, expires_at)
values ('8c94f518085c25e0ba7d6186282c8fa3f2cadbda80d2e32abe7d61ee39088d86', '2026-08-31T23:59:59Z')
on conflict(token_sha256) do nothing;

alter table public.beta_developer_accounts enable row level security;
alter table public.beta_developer_invites enable row level security;
revoke all on public.beta_developer_accounts, public.beta_developer_invites
  from public, anon, authenticated;

create or replace function public.require_beta_developer()
returns uuid
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  uid uuid := public.require_current_legal_acceptance();
begin
  if not exists (
    select 1 from public.app_release_controls
    where singleton
      and release_mode = 'beta_devnet'
      and real_money_enabled is false
      and purchase_funded_prizes is false
      and real_sol_market_enabled is false
  ) then
    raise exception 'Developer tools are only available in the no-value devnet beta';
  end if;
  if not exists (
    select 1 from public.beta_developer_accounts
    where user_id = uid and enabled and disabled_at is null
  ) then
    raise exception 'Developer access required';
  end if;
  return uid;
end;
$$;

create or replace function public.get_beta_developer_status()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  mode text;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  select release_mode into mode from public.app_release_controls where singleton;
  return jsonb_build_object(
    'enabled', exists(
      select 1 from public.beta_developer_accounts
      where user_id = uid and enabled and disabled_at is null
    ),
    'releaseMode', mode
  );
end;
$$;

create or replace function public.claim_beta_developer_access(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_current_legal_acceptance();
  token_hash text := encode(extensions.digest(convert_to(trim(coalesce(p_token, '')), 'UTF8'), 'sha256'), 'hex');
  invite public.beta_developer_invites%rowtype;
begin
  if not exists (
    select 1 from public.app_release_controls
    where singleton and release_mode = 'beta_devnet'
      and real_money_enabled is false
      and purchase_funded_prizes is false
      and real_sol_market_enabled is false
  ) then
    raise exception 'Developer access can only be claimed in the no-value devnet beta';
  end if;

  select * into invite
  from public.beta_developer_invites
  where token_sha256 = token_hash
  for update;

  if invite.token_sha256 is null or invite.expires_at <= now() or invite.consumed_at is not null then
    raise exception 'Invalid or expired developer access code';
  end if;

  insert into public.beta_developer_accounts(user_id, enabled)
  values(uid, true)
  on conflict(user_id) do update
  set enabled = true, disabled_at = null;

  update public.beta_developer_invites
  set consumed_by = uid, consumed_at = now()
  where token_sha256 = token_hash;

  return jsonb_build_object('enabled', true);
end;
$$;

create or replace function public.grant_beta_test_currency(
  p_currency text,
  p_amount bigint,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_beta_developer();
  prior public.currency_ledger%rowtype;
  new_balance bigint;
begin
  if p_request_id is null then raise exception 'Request ID required'; end if;
  if p_currency not in ('coins', 'gc') then raise exception 'Invalid test currency'; end if;
  if p_amount <= 0 then raise exception 'Grant amount must be positive'; end if;
  if p_currency = 'coins' and p_amount > 2000000 then raise exception 'Coin grant exceeds beta limit'; end if;
  if p_currency = 'gc' and p_amount > 100000 then raise exception 'GC grant exceeds beta limit'; end if;

  select * into prior from public.currency_ledger
  where user_id = uid and currency = p_currency and idempotency_key = p_request_id;
  if prior.id is not null then
    return jsonb_build_object('currency', p_currency, 'amount', p_amount,
      'balance', prior.balance_after, 'duplicate', true);
  end if;

  perform set_config('app.currency_reason', 'developer_test_grant', true);
  perform set_config('app.currency_reference_type', 'beta_developer_tool', true);
  perform set_config('app.currency_reference_id', p_request_id::text, true);
  perform set_config('app.currency_idempotency_key', p_request_id::text, true);

  if p_currency = 'coins' then
    insert into public.economy_accounts(user_id, coins) values(uid, 0)
      on conflict(user_id) do nothing;
    update public.economy_accounts
    set coins = coins + p_amount
    where user_id = uid
    returning coins into new_balance;
  else
    insert into public.gridiron_cash_accounts(user_id, balance, total_purchased)
    values(uid, 0, 0) on conflict(user_id) do nothing;
    update public.gridiron_cash_accounts
    set balance = balance + p_amount, updated_at = now()
    where user_id = uid
    returning balance into new_balance;
  end if;

  return jsonb_build_object('currency', p_currency, 'amount', p_amount,
    'balance', new_balance, 'duplicate', false);
end;
$$;

revoke all on function public.require_beta_developer() from public, anon, authenticated;
revoke all on function public.get_beta_developer_status() from public, anon;
revoke all on function public.claim_beta_developer_access(text) from public, anon;
revoke all on function public.grant_beta_test_currency(text,bigint,uuid) from public, anon;
grant execute on function public.get_beta_developer_status() to authenticated;
grant execute on function public.claim_beta_developer_access(text) to authenticated;
grant execute on function public.grant_beta_test_currency(text,bigint,uuid) to authenticated;
grant execute on function public.require_beta_developer(), public.get_beta_developer_status(),
  public.claim_beta_developer_access(text), public.grant_beta_test_currency(text,bigint,uuid)
  to service_role;
grant all on public.beta_developer_accounts, public.beta_developer_invites to service_role;
