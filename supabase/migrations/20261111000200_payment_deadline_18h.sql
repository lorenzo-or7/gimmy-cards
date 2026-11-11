-- =====================================================================
-- Gimmy Cards V3 — official payment deadline is now Monday 18:00
-- (America/Sao_Paulo), replacing Monday 23:59:59. Earlier migrations are
-- untouched; this redefines the function they call.
--
-- Existing orders keep the deadline they were created with: shortening a
-- deadline already communicated to a participant is an admin decision
-- (use admin_set_order_due if needed).
-- =====================================================================

create or replace function public.payment_due_for(p_ends_at timestamptz)
returns timestamptz language sql immutable as $$
  select (((p_ends_at at time zone 'America/Sao_Paulo')::date
          + (8 - extract(isodow from (p_ends_at at time zone 'America/Sao_Paulo'))::int))
          + time '18:00:00') at time zone 'America/Sao_Paulo'
$$;

grant execute on function public.payment_due_for(timestamptz) to anon, authenticated;
