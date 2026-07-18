alter table public.gridiron_cash_ledger
  add column if not exists reference text;

create unique index if not exists gridiron_cash_ledger_reference_idx
  on public.gridiron_cash_ledger(reference)
  where reference is not null;

create or replace function public.spend_gridiron_cash(
  p_user_id uuid,
  p_amount bigint,
  p_reason text,
  p_reference text
) returns bigint
language plpgsql security definer set search_path = public as $$
declare current_balance bigint; resulting_balance bigint;
begin
  if p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  if p_reference is null or length(p_reference) < 8 then raise exception 'Purchase reference is required'; end if;

  if exists(select 1 from public.gridiron_cash_ledger where reference = p_reference and user_id = p_user_id) then
    select balance_after into resulting_balance from public.gridiron_cash_ledger
      where reference = p_reference and user_id = p_user_id;
    return resulting_balance;
  end if;

  select balance into current_balance from public.gridiron_cash_accounts
    where user_id = p_user_id for update;
  if not found or current_balance < p_amount then raise exception 'Not enough Gridiron Cash'; end if;
  resulting_balance := current_balance - p_amount;
  update public.gridiron_cash_accounts set balance = resulting_balance, updated_at = now()
    where user_id = p_user_id;
  insert into public.gridiron_cash_ledger(user_id, delta, reason, balance_after, reference)
    values (p_user_id, -p_amount, coalesce(nullif(p_reason, ''), 'pack_purchase'), resulting_balance, p_reference);
  return resulting_balance;
end $$;

revoke all on function public.spend_gridiron_cash(uuid,bigint,text,text) from public, anon, authenticated;
grant execute on function public.spend_gridiron_cash(uuid,bigint,text,text) to service_role;
