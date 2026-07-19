-- Pack purchases now debit GC atomically inside open_authoritative_pack. The
-- older generic service helper accepted arbitrary reason/reference strings and
-- has no remaining caller, so remove that unnecessary financial surface.
drop function if exists public.spend_gridiron_cash(uuid,bigint,text,text);
