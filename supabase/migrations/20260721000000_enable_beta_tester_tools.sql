-- Make no-value devnet tools available to every eligibility-approved beta tester.
-- Production/real-value release controls still fail closed inside the database.

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
    select 1
    from public.app_release_controls
    where singleton
      and release_mode = 'beta_devnet'
      and real_money_enabled is false
      and purchase_funded_prizes is false
      and real_sol_market_enabled is false
  ) then
    raise exception 'Beta testing tools are only available in the no-value devnet beta';
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
  uid uuid := public.require_current_legal_acceptance();
  mode text;
  safe_beta boolean;
begin
  select release_mode,
    release_mode = 'beta_devnet'
      and real_money_enabled is false
      and purchase_funded_prizes is false
      and real_sol_market_enabled is false
  into mode, safe_beta
  from public.app_release_controls
  where singleton;

  return jsonb_build_object(
    'enabled', coalesce(safe_beta, false),
    'releaseMode', mode,
    'audience', 'eligible_beta_testers',
    'userId', uid
  );
end;
$$;

-- Keep older beta clients compatible. Access no longer depends on an invite code;
-- the legal-acceptance and release-mode checks above are authoritative.
create or replace function public.claim_beta_developer_access(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_beta_developer();
  return jsonb_build_object('enabled', true, 'audience', 'eligible_beta_testers');
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
  granted_today bigint;
  daily_limit bigint;
begin
  if p_request_id is null then raise exception 'Request ID required'; end if;
  if p_currency not in ('coins', 'gc') then raise exception 'Invalid test currency'; end if;
  if p_amount <= 0 then raise exception 'Grant amount must be positive'; end if;
  if p_currency = 'coins' and p_amount > 2000000 then raise exception 'Coin grant exceeds beta limit'; end if;
  if p_currency = 'gc' and p_amount > 100000 then raise exception 'GC grant exceeds beta limit'; end if;

  select * into prior
  from public.currency_ledger
  where user_id = uid and currency = p_currency and idempotency_key = p_request_id;
  if prior.id is not null then
    return jsonb_build_object(
      'currency', p_currency,
      'amount', p_amount,
      'balance', prior.balance_after,
      'duplicate', true
    );
  end if;

  -- Serialize grants per tester/currency so simultaneous taps cannot bypass the cap.
  perform pg_advisory_xact_lock(hashtext(uid::text), hashtext(p_currency));
  daily_limit := case when p_currency = 'coins' then 10000000 else 100000 end;

  select coalesce(sum(greatest(delta, 0)), 0)
  into granted_today
  from public.currency_ledger
  where user_id = uid
    and currency = p_currency
    and reason in ('developer_test_grant', 'beta_test_grant')
    and created_at >= date_trunc('day', now());

  if granted_today + p_amount > daily_limit then
    raise exception 'Daily beta % grant limit reached', upper(p_currency);
  end if;

  perform set_config('app.currency_reason', 'beta_test_grant', true);
  perform set_config('app.currency_reference_type', 'beta_test_tool', true);
  perform set_config('app.currency_reference_id', p_request_id::text, true);
  perform set_config('app.currency_idempotency_key', p_request_id::text, true);

  if p_currency = 'coins' then
    insert into public.economy_accounts(user_id, coins)
    values(uid, 0)
    on conflict(user_id) do nothing;

    update public.economy_accounts
    set coins = coins + p_amount
    where user_id = uid
    returning coins into new_balance;
  else
    insert into public.gridiron_cash_accounts(user_id, balance, total_purchased)
    values(uid, 0, 0)
    on conflict(user_id) do nothing;

    update public.gridiron_cash_accounts
    set balance = balance + p_amount, updated_at = now()
    where user_id = uid
    returning balance into new_balance;
  end if;

  return jsonb_build_object(
    'currency', p_currency,
    'amount', p_amount,
    'balance', new_balance,
    'duplicate', false,
    'grantedToday', granted_today + p_amount,
    'dailyLimit', daily_limit
  );
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
