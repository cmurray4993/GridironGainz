-- Supabase installs pgcrypto in the extensions schema. Keep the function's
-- restricted search_path while resolving the cryptographic RNG explicitly.

create or replace function public.secure_random_unit()
returns double precision
language plpgsql
volatile
set search_path = public
as $$
declare
  bytes bytea := extensions.gen_random_bytes(4);
  value numeric;
begin
  value := (
    get_byte(bytes, 0)::numeric * 16777216
    + get_byte(bytes, 1)::numeric * 65536
    + get_byte(bytes, 2)::numeric * 256
    + get_byte(bytes, 3)::numeric
  ) / 4294967296.0;
  return value::double precision;
end;
$$;
