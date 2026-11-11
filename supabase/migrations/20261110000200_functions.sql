-- =====================================================================
-- Gimmy Cards — server-side business rules
-- Every critical transition (bids, buyout, closing, orders, payments,
-- default transfers, shipments, roles) happens here, never in the client.
-- Errors are raised as stable codes (e.g. 'BELOW_MINIMUM') that the
-- frontend translates.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.current_role_of(p_uid uuid)
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = p_uid
$$;

create or replace function public.is_admin(p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin', 'super_admin') from public.profiles where id = p_uid), false)
$$;

create or replace function public.is_super_admin(p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'super_admin' from public.profiles where id = p_uid), false)
$$;

create or replace function public.require_admin()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_admin(v) then raise exception 'FORBIDDEN'; end if;
  return v;
end $$;

create or replace function public.require_user()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.profiles where id = v) then raise exception 'PROFILE_MISSING'; end if;
  return v;
end $$;

-- "Maria Souza" -> "Maria S."  (public bid boards never show full names)
create or replace function public.public_alias(p_name text)
returns text language sql immutable as $$
  select case
    when p_name is null or btrim(p_name) = '' then 'Participante'
    when array_length(regexp_split_to_array(btrim(p_name), '\s+'), 1) = 1 then btrim(p_name)
    else split_part(btrim(p_name), ' ', 1) || ' ' ||
         upper(left((regexp_split_to_array(btrim(p_name), '\s+'))[array_length(regexp_split_to_array(btrim(p_name), '\s+'), 1)], 1)) || '.'
  end
$$;

-- Payment deadline: the Monday after the auction ends, 23:59:59 in Brasília.
create or replace function public.payment_due_for(p_ends_at timestamptz)
returns timestamptz language sql immutable as $$
  select (((p_ends_at at time zone 'America/Sao_Paulo')::date
          + (8 - extract(isodow from (p_ends_at at time zone 'America/Sao_Paulo'))::int))
          + time '23:59:59') at time zone 'America/Sao_Paulo'
$$;

create or replace function public.notify(
  p_user uuid, p_kind text, p_title text, p_body text default '', p_link text default '', p_dedupe text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
  values (p_user, p_kind, p_title, coalesce(p_body, ''), coalesce(p_link, ''), p_dedupe)
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
end $$;

create or replace function public.notify_admins(
  p_kind text, p_title text, p_body text default '', p_link text default '', p_dedupe text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from public.profiles where role in ('admin', 'super_admin') loop
    perform public.notify(r.id, p_kind, p_title, p_body, p_link, p_dedupe);
  end loop;
end $$;

create or replace function public.audit(p_action text, p_entity text, p_entity_id text, p_data jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (actor_id, action, entity, entity_id, data)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_data, '{}'::jsonb))
$$;

create or replace function public.brl(p numeric)
returns text language sql immutable as $$
  select 'R$ ' || replace(replace(replace(to_char(p, 'FM999G999G990D00'), ',', '#'), '.', ','), '#', '.')
$$;

-- ---------------------------------------------------------------------
-- New user -> profile (role is ALWAYS participant; never from metadata)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, whatsapp)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    left(regexp_replace(coalesce(new.raw_user_meta_data ->> 'whatsapp', ''), '[^0-9+]', '', 'g'), 32)
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role changes only by a super admin (or by the database owner / service role,
-- where auth.uid() is null — e.g. the SQL editor when bootstrapping).
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null
     and not public.is_super_admin(auth.uid()) then
    raise exception 'FORBIDDEN';
  end if;
  if new.id is distinct from old.id then raise exception 'FORBIDDEN'; end if;
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Lots: inherit auction end; freeze prices once bids exist.
create or replace function public.guard_lot_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_auction public.auctions%rowtype;
begin
  select * into v_auction from public.auctions where id = new.auction_id;
  if tg_op = 'INSERT' then
    if new.ends_at is null then new.ends_at := v_auction.ends_at; end if;
    if v_auction.status in ('closed', 'cancelled') then raise exception 'AUCTION_LOCKED'; end if;
    new.status := 'open';
    new.current_price := null; new.bid_count := 0; new.bidder_count := 0;
    new.winner_id := null; new.winning_amount := null; new.closed_at := null;
  else
    -- protected columns are only written by security-definer functions,
    -- which set this flag for the transaction.
    if coalesce(current_setting('gimmy.internal', true), '') <> 'on' then
      if new.status is distinct from old.status or new.current_price is distinct from old.current_price
         or new.bid_count is distinct from old.bid_count or new.winner_id is distinct from old.winner_id
         or new.winning_amount is distinct from old.winning_amount or new.closed_at is distinct from old.closed_at
         or new.bidder_count is distinct from old.bidder_count then
        raise exception 'FORBIDDEN';
      end if;
      if old.bid_count > 0 and (new.starting_price <> old.starting_price or new.increment <> old.increment
         or new.buyout_price is distinct from old.buyout_price or new.ends_at <> old.ends_at
         or new.auction_id <> old.auction_id) then
        raise exception 'LOT_HAS_BIDS';
      end if;
    end if;
  end if;
  if new.ends_at > v_auction.ends_at then raise exception 'LOT_ENDS_AFTER_AUCTION'; end if;
  return new;
end $$;

create trigger lots_guard_ins before insert on public.lots
  for each row execute function public.guard_lot_write();
create trigger lots_guard_upd before update on public.lots
  for each row execute function public.guard_lot_write();

create or replace function public.guard_lot_delete()
returns trigger language plpgsql as $$
begin
  if old.bid_count > 0 then raise exception 'LOT_HAS_BIDS'; end if;
  return old;
end $$;
create trigger lots_guard_del before delete on public.lots
  for each row execute function public.guard_lot_delete();

-- Auctions: status changes only through functions; time edits blocked once bids exist.
create or replace function public.guard_auction_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'draft'; new.orders_created_at := null; new.closed_at := null; new.published_at := null;
    return new;
  end if;
  if coalesce(current_setting('gimmy.internal', true), '') <> 'on' then
    if new.status is distinct from old.status or new.orders_created_at is distinct from old.orders_created_at
       or new.closed_at is distinct from old.closed_at or new.published_at is distinct from old.published_at then
      raise exception 'FORBIDDEN';
    end if;
    if old.status <> 'draft' and (new.starts_at <> old.starts_at or new.ends_at <> old.ends_at)
       and exists (select 1 from public.lots where auction_id = old.id and bid_count > 0) then
      raise exception 'AUCTION_HAS_BIDS';
    end if;
  end if;
  return new;
end $$;

create trigger auctions_guard_ins before insert on public.auctions
  for each row execute function public.guard_auction_write();
create trigger auctions_guard_upd before update on public.auctions
  for each row execute function public.guard_auction_write();

-- Generic audit for admin table writes
create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- writes made inside business functions audit themselves explicitly
  if coalesce(current_setting('gimmy.internal', true), '') = 'on' then return coalesce(new, old); end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, data)
  values (auth.uid(), lower(tg_op), tg_table_name,
          coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id', ''),
          case when tg_op = 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
               when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create trigger audit_cards after insert or update or delete on public.cards
  for each row execute function public.audit_row();
create trigger audit_auctions after insert or update or delete on public.auctions
  for each row execute function public.audit_row();
create trigger audit_lots after insert or update or delete on public.lots
  for each row execute function public.audit_row();

-- ---------------------------------------------------------------------
-- Ranking helpers
-- Rank = best bid of each participant, ordered by amount DESC, then the
-- server sequence (bid id) ASC. Earlier registration wins ties.
-- ---------------------------------------------------------------------
create or replace function public.lot_standings(p_lot uuid)
returns table (rank int, user_id uuid, bid_id bigint, amount numeric)
language sql stable security definer set search_path = public as $$
  select (row_number() over (order by b.amount desc, b.id asc))::int, b.user_id, b.id, b.amount
  from (
    select distinct on (user_id) user_id, id, amount
    from public.bids where lot_id = p_lot
    order by user_id, amount desc, id asc
  ) b
  order by b.amount desc, b.id asc
$$;

-- Internal: snapshot ranking and set winner. Caller must hold the lot lock.
create or replace function public._finalize_lot(p_lot uuid, p_status public.lot_status)
returns void language plpgsql security definer set search_path = public as $$
declare v_lot public.lots%rowtype; v_win record;
begin
  perform set_config('gimmy.internal', 'on', true);
  select * into v_lot from public.lots where id = p_lot;
  delete from public.lot_rankings where lot_id = p_lot;
  insert into public.lot_rankings (lot_id, rank, user_id, bid_id, amount)
  select p_lot, s.rank, s.user_id, s.bid_id, s.amount from public.lot_standings(p_lot) s;

  select * into v_win from public.lot_rankings where lot_id = p_lot and rank = 1;
  if v_win is null then
    update public.lots set status = 'unsold', closed_at = clock_timestamp() where id = p_lot;
  else
    update public.lots
      set status = case when p_status = 'sold' then 'sold'::public.lot_status else 'closed'::public.lot_status end,
          winner_id = v_win.user_id, winning_amount = v_win.amount, closed_at = clock_timestamp()
      where id = p_lot;
    perform public.notify(v_win.user_id, 'won', 'Você arrematou ' || v_lot.title,
      'Valor final: ' || public.brl(v_win.amount) || '. O pedido aparece em Meus pedidos quando o leilão terminar.',
      '/lote/' || p_lot, 'won:' || p_lot);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- place_bid — the only way to register a regular bid
-- ---------------------------------------------------------------------
create or replace function public.place_bid(p_lot_id uuid, p_amount numeric, p_client_key uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public.require_user();
  v_now timestamptz := clock_timestamp();
  v_lot public.lots%rowtype;
  v_auction public.auctions%rowtype;
  v_existing public.bids%rowtype;
  v_max numeric; v_user_best numeric; v_prev_leader uuid; v_recent int; v_limit int;
  v_bid public.bids%rowtype; v_rank int;
begin
  if p_client_key is null then raise exception 'INVALID_REQUEST'; end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) or p_amount > 1000000 then
    raise exception 'INVALID_AMOUNT';
  end if;

  -- Lock the lot: serialises every bid on this lot.
  select * into v_lot from public.lots where id = p_lot_id for update;
  if not found then raise exception 'LOT_NOT_FOUND'; end if;

  -- Idempotency (checked after the lock so a concurrent retry sees the first insert).
  select * into v_existing from public.bids where user_id = v_uid and client_key = p_client_key;
  if found then
    if v_existing.lot_id <> p_lot_id or v_existing.amount <> p_amount then raise exception 'INVALID_REQUEST'; end if;
    select rank into v_rank from public.lot_standings(p_lot_id) where user_id = v_uid;
    return jsonb_build_object('bid_id', v_existing.id, 'amount', v_existing.amount, 'created_at', v_existing.created_at,
                              'rank', v_rank, 'replayed', true, 'lot_status', v_lot.status);
  end if;

  select * into v_auction from public.auctions where id = v_lot.auction_id;
  if v_auction.status <> 'published' then raise exception 'AUCTION_NOT_OPEN'; end if;
  if v_now < v_auction.starts_at then raise exception 'AUCTION_NOT_STARTED'; end if;
  if v_lot.status <> 'open' then raise exception 'LOT_CLOSED'; end if;
  if v_now >= v_lot.ends_at then raise exception 'LOT_ENDED'; end if;

  select bid_rate_limit_per_minute into v_limit from public.app_settings limit 1;
  select count(*) into v_recent from public.bids where user_id = v_uid and created_at > v_now - interval '1 minute';
  if v_recent >= coalesce(v_limit, 20) then raise exception 'RATE_LIMITED'; end if;

  if v_lot.buyout_price is not null and p_amount >= v_lot.buyout_price then
    raise exception 'USE_BUYOUT';
  end if;

  select max(amount) into v_max from public.bids where lot_id = p_lot_id;
  select max(amount) into v_user_best from public.bids where lot_id = p_lot_id and user_id = v_uid;

  if p_amount < v_lot.starting_price then raise exception 'BELOW_MINIMUM'; end if;
  if v_user_best is not null and p_amount <= v_user_best then raise exception 'NOT_ABOVE_OWN_BID'; end if;
  if v_max is not null and p_amount > v_max and p_amount < v_max + v_lot.increment then
    raise exception 'BELOW_INCREMENT';
  end if;
  -- amount = v_max  -> tie, allowed (ranks after earlier bids at the same value)
  -- amount < v_max  -> secondary position, allowed (>= starting price, above own bid)

  select user_id into v_prev_leader from public.lot_standings(p_lot_id) where rank = 1;

  insert into public.bids (lot_id, user_id, amount, client_key, created_at)
  values (p_lot_id, v_uid, p_amount, p_client_key, v_now)
  returning * into v_bid;

  perform set_config('gimmy.internal', 'on', true);
  update public.lots set
    current_price = greatest(coalesce(current_price, 0), p_amount),
    bid_count = bid_count + 1,
    bidder_count = (select count(distinct user_id) from public.bids where lot_id = p_lot_id)
  where id = p_lot_id;

  if v_prev_leader is not null and v_prev_leader <> v_uid and p_amount > v_max then
    perform public.notify(v_prev_leader, 'outbid', 'Seu lance foi superado',
      v_lot.title || ' agora está em ' || public.brl(p_amount) || '.', '/lote/' || p_lot_id,
      'outbid:' || p_lot_id || ':' || v_bid.id);
  end if;

  select rank into v_rank from public.lot_standings(p_lot_id) where user_id = v_uid;
  return jsonb_build_object('bid_id', v_bid.id, 'amount', v_bid.amount, 'created_at', v_bid.created_at,
                            'rank', v_rank, 'replayed', false, 'lot_status', 'open');
end $$;

-- ---------------------------------------------------------------------
-- buy_now — instant buyout. Atomic: only one buyer, closes the lot.
-- ---------------------------------------------------------------------
create or replace function public.buy_now(p_lot_id uuid, p_client_key uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public.require_user();
  v_now timestamptz := clock_timestamp();
  v_lot public.lots%rowtype; v_auction public.auctions%rowtype;
  v_existing public.bids%rowtype; v_bid public.bids%rowtype;
begin
  if p_client_key is null then raise exception 'INVALID_REQUEST'; end if;
  select * into v_lot from public.lots where id = p_lot_id for update;
  if not found then raise exception 'LOT_NOT_FOUND'; end if;

  select * into v_existing from public.bids where user_id = v_uid and client_key = p_client_key;
  if found then
    return jsonb_build_object('bid_id', v_existing.id, 'amount', v_existing.amount, 'created_at', v_existing.created_at,
                              'rank', 1, 'replayed', true, 'lot_status', v_lot.status);
  end if;

  select * into v_auction from public.auctions where id = v_lot.auction_id;
  if v_auction.status <> 'published' then raise exception 'AUCTION_NOT_OPEN'; end if;
  if v_now < v_auction.starts_at then raise exception 'AUCTION_NOT_STARTED'; end if;
  if v_lot.status <> 'open' then raise exception 'LOT_CLOSED'; end if;
  if v_now >= v_lot.ends_at then raise exception 'LOT_ENDED'; end if;
  if v_lot.buyout_price is null then raise exception 'NO_BUYOUT'; end if;

  insert into public.bids (lot_id, user_id, amount, is_buyout, client_key, created_at)
  values (p_lot_id, v_uid, v_lot.buyout_price, true, p_client_key, v_now)
  returning * into v_bid;

  perform set_config('gimmy.internal', 'on', true);
  update public.lots set
    current_price = v_lot.buyout_price, bid_count = bid_count + 1,
    bidder_count = (select count(distinct user_id) from public.bids where lot_id = p_lot_id)
  where id = p_lot_id;

  perform public._finalize_lot(p_lot_id, 'sold');
  perform public.audit('buy_now', 'lots', p_lot_id::text, jsonb_build_object('bid_id', v_bid.id, 'amount', v_bid.amount));

  return jsonb_build_object('bid_id', v_bid.id, 'amount', v_bid.amount, 'created_at', v_bid.created_at,
                            'rank', 1, 'replayed', false, 'lot_status', 'sold');
end $$;

-- ---------------------------------------------------------------------
-- Orders for a finished auction: one per winner, items summed.
-- ---------------------------------------------------------------------
create or replace function public._create_orders_for_auction(p_auction uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_auction public.auctions%rowtype; v_due timestamptz; r record; v_order uuid; v_count int := 0;
begin
  select * into v_auction from public.auctions where id = p_auction for update;
  if v_auction.orders_created_at is not null then return 0; end if;
  v_due := coalesce(v_auction.payment_due_at, public.payment_due_for(v_auction.ends_at));

  for r in
    select winner_id as user_id, sum(winning_amount) as total
    from public.lots where auction_id = p_auction and status in ('sold', 'closed') and winner_id is not null
    group by winner_id
  loop
    insert into public.orders (auction_id, user_id, source, total, due_at)
    values (p_auction, r.user_id, 'auction', r.total, v_due)
    on conflict (auction_id, user_id) where source = 'auction' do nothing
    returning id into v_order;
    if v_order is not null then
      insert into public.order_items (order_id, lot_id, amount)
      select v_order, l.id, l.winning_amount from public.lots l
      where l.auction_id = p_auction and l.winner_id = r.user_id and l.status in ('sold', 'closed')
      order by l.position;
      perform public.notify(r.user_id, 'order', 'Seu pedido está pronto para pagamento',
        'Total ' || public.brl(r.total) || '. Prazo: ' ||
        to_char(v_due at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI') || '.',
        '/conta/pedidos/' || v_order, 'order:' || v_order);
      v_count := v_count + 1;
    end if;
  end loop;

  perform set_config('gimmy.internal', 'on', true);
  update public.auctions set orders_created_at = now(), closed_at = coalesce(closed_at, now()),
    status = 'closed', payment_due_at = v_due where id = p_auction;
  return v_count;
end $$;

-- ---------------------------------------------------------------------
-- close_due_lots — idempotent sweeper. Runs every minute via pg_cron and may
-- also be nudged by clients (it only acts on lots whose time has passed).
-- ---------------------------------------------------------------------
create or replace function public.close_due_lots()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; v_lots int := 0; v_orders int := 0; v_auctions int := 0;
begin
  for r in
    select l.id from public.lots l join public.auctions a on a.id = l.auction_id
    where l.status = 'open' and l.ends_at <= clock_timestamp() and a.status = 'published'
    order by l.ends_at
    for update of l skip locked
  loop
    perform public._finalize_lot(r.id, 'closed');
    v_lots := v_lots + 1;
  end loop;

  for r in
    select a.id from public.auctions a
    where a.status = 'published' and a.ends_at <= clock_timestamp() and a.orders_created_at is null
      and not exists (select 1 from public.lots l where l.auction_id = a.id and l.status = 'open')
    for update skip locked
  loop
    v_orders := v_orders + public._create_orders_for_auction(r.id);
    v_auctions := v_auctions + 1;
  end loop;

  return jsonb_build_object('lots_closed', v_lots, 'auctions_closed', v_auctions, 'orders_created', v_orders);
end $$;

-- ---------------------------------------------------------------------
-- Public bid board (masked names). Visitors can read it.
-- ---------------------------------------------------------------------
create or replace function public.lot_bid_board(p_lot_id uuid)
returns table (bid_id bigint, alias text, amount numeric, is_buyout boolean, created_at timestamptz, is_me boolean, user_rank int)
language sql stable security definer set search_path = public as $$
  select b.id, public.public_alias(p.full_name), b.amount, b.is_buyout, b.created_at,
         coalesce(b.user_id = auth.uid(), false),
         (select s.rank from public.lot_standings(b.lot_id) s where s.bid_id = b.id)
  from public.bids b
  join public.profiles p on p.id = b.user_id
  join public.lots l on l.id = b.lot_id
  join public.auctions a on a.id = l.auction_id
  where b.lot_id = p_lot_id and (a.status in ('published', 'closed') or public.is_admin())
  order by b.amount desc, b.id asc
  limit 200
$$;

create or replace function public.lot_winner_alias(p_lot_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select public.public_alias(p.full_name) from public.lots l join public.profiles p on p.id = l.winner_id
  where l.id = p_lot_id
$$;

-- ---------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------
create or replace function public.submit_payment_proof(p_order_id uuid, p_file_path text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public.require_user(); v_order public.orders%rowtype; v_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.user_id <> v_uid then raise exception 'NOT_FOUND'; end if;
  if v_order.status not in ('awaiting_payment', 'proof_submitted') then raise exception 'ORDER_NOT_PAYABLE'; end if;
  if p_file_path is null or p_file_path not like v_uid::text || '/%' or p_file_path like '%..%' then
    raise exception 'INVALID_FILE';
  end if;
  if (select count(*) from public.payment_proofs where order_id = p_order_id) >= 10 then
    raise exception 'TOO_MANY_FILES';
  end if;
  insert into public.payment_proofs (order_id, user_id, file_path) values (p_order_id, v_uid, p_file_path)
  returning id into v_id;
  update public.orders set status = 'proof_submitted', updated_at = now() where id = p_order_id;
  perform public.notify_admins('proof', 'Novo comprovante enviado', 'Pedido ' || v_order.code || ' — ' || public.brl(v_order.total),
    '/admin/pagamentos', 'proof:' || v_id);
  return v_id;
end $$;

-- Approve (marks paid, creates stored items) or reject a payment.
create or replace function public.admin_review_payment(p_order_id uuid, p_approve boolean, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare v_admin uuid := public.require_admin(); v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_order.status not in ('awaiting_payment', 'proof_submitted', 'defaulted') then raise exception 'ORDER_NOT_PAYABLE'; end if;
  if v_order.status = 'defaulted' and p_approve then raise exception 'ORDER_DEFAULTED'; end if;

  if p_approve then
    update public.orders set status = 'paid', paid_at = now(), confirmed_by = v_admin,
      admin_note = coalesce(p_note, ''), updated_at = now() where id = p_order_id;
    update public.payment_proofs set status = 'approved', reviewed_by = v_admin, reviewed_at = now(),
      review_note = coalesce(p_note, '') where order_id = p_order_id and status = 'pending';
    insert into public.stored_items (user_id, order_item_id, lot_id)
    select v_order.user_id, oi.id, oi.lot_id from public.order_items oi
    where oi.order_id = p_order_id and oi.status = 'active'
    on conflict (order_item_id) do nothing;
    perform public.notify(v_order.user_id, 'payment_confirmed', 'Pagamento confirmado',
      'Pedido ' || v_order.code || ' confirmado. As cartas já estão em Minhas cartas.', '/conta/armazenadas',
      'paid:' || p_order_id);
  else
    update public.payment_proofs set status = 'rejected', reviewed_by = v_admin, reviewed_at = now(),
      review_note = coalesce(p_note, '') where order_id = p_order_id and status = 'pending';
    update public.orders set status = 'awaiting_payment', updated_at = now() where id = p_order_id and status = 'proof_submitted';
    perform public.notify(v_order.user_id, 'payment_rejected', 'Comprovante não confirmado',
      coalesce(nullif(p_note, ''), 'Confira o comprovante e envie novamente.'), '/conta/pedidos/' || p_order_id);
  end if;
  perform public.audit(case when p_approve then 'payment_approved' else 'payment_rejected' end, 'orders', p_order_id::text,
    jsonb_build_object('note', p_note, 'total', v_order.total));
end $$;

create or replace function public.admin_set_order_due(p_order_id uuid, p_due timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare v_admin uuid := public.require_admin();
begin
  update public.orders set due_at = p_due, updated_at = now()
  where id = p_order_id and status in ('awaiting_payment', 'proof_submitted');
  if not found then raise exception 'ORDER_NOT_PAYABLE'; end if;
  perform public.audit('order_due_changed', 'orders', p_order_id::text, jsonb_build_object('due_at', p_due));
end $$;

-- Flags overdue orders to admins (once per order). Does NOT change status.
create or replace function public.flag_overdue_orders()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id, code from public.orders
           where status in ('awaiting_payment', 'proof_submitted') and due_at < now() loop
    perform public.notify_admins('overdue', 'Pagamento em atraso', 'Pedido ' || r.code || ' passou do prazo.',
      '/admin/pedidos', 'overdue:' || r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Default handling (inadimplência)
-- ---------------------------------------------------------------------
create or replace function public.admin_mark_default(p_order_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_admin uuid := public.require_admin(); v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_order.status not in ('awaiting_payment', 'proof_submitted') then raise exception 'ORDER_NOT_PAYABLE'; end if;
  if v_order.due_at > now() then raise exception 'NOT_OVERDUE'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'REASON_REQUIRED'; end if;
  update public.orders set status = 'defaulted', admin_note = p_reason, updated_at = now() where id = p_order_id;
  update public.order_items set status = 'void' where order_id = p_order_id;
  -- if this was a transfer order, close that chapter
  update public.default_transfers set status = 'cancelled' where order_id = p_order_id and status = 'offered';
  perform public.audit('order_defaulted', 'orders', p_order_id::text, jsonb_build_object('reason', p_reason, 'user_id', v_order.user_id));
end $$;

-- Offer a defaulted lot to the next eligible bidder (by ranking order).
create or replace function public.admin_offer_next_bidder(
  p_lot_id uuid, p_reason text, p_payment_due timestamptz default null, p_accept_hours int default 24)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_admin uuid := public.require_admin();
  v_lot public.lots%rowtype; v_next record; v_original uuid; v_id uuid; v_expires timestamptz;
begin
  select * into v_lot from public.lots where id = p_lot_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_lot.status not in ('closed', 'sold') then raise exception 'LOT_NOT_CLOSED'; end if;
  if exists (select 1 from public.order_items where lot_id = p_lot_id and status = 'active') then
    raise exception 'LOT_HAS_ACTIVE_ORDER';
  end if;
  if exists (select 1 from public.default_transfers where lot_id = p_lot_id and status = 'offered') then
    raise exception 'TRANSFER_ALREADY_ACTIVE';
  end if;
  if not exists (select 1 from public.order_items where lot_id = p_lot_id and status = 'void') then
    raise exception 'NO_DEFAULT_RECORDED';
  end if;

  select user_id into v_original from public.lot_rankings where lot_id = p_lot_id and rank = 1;

  -- next = lowest rank not yet contacted and never part of a voided order for this lot
  select r.* into v_next from public.lot_rankings r
  where r.lot_id = p_lot_id
    and r.user_id <> v_original
    and not exists (select 1 from public.default_transfers t where t.lot_id = p_lot_id and t.offered_to = r.user_id)
    and not exists (select 1 from public.order_items oi join public.orders o on o.id = oi.order_id
                    where oi.lot_id = p_lot_id and o.user_id = r.user_id)
  order by r.rank asc limit 1;
  if v_next is null then raise exception 'NO_ELIGIBLE_BIDDER'; end if;

  v_expires := now() + make_interval(hours => greatest(1, least(coalesce(p_accept_hours, 24), 168)));
  insert into public.default_transfers (lot_id, original_winner_id, offered_to, offered_rank, amount, reason,
                                        expires_at, payment_due_at, admin_id)
  values (p_lot_id, v_original, v_next.user_id, v_next.rank, v_next.amount, coalesce(p_reason, ''),
          v_expires, coalesce(p_payment_due, v_expires + interval '48 hours'), v_admin)
  returning id into v_id;

  perform public.notify(v_next.user_id, 'transfer_offer', 'Uma carta ficou disponível para você',
    v_lot.title || ' pelo valor do seu lance: ' || public.brl(v_next.amount) || '. Responda em até 24 horas.',
    '/conta/arremates', 'transfer:' || v_id);
  perform public.audit('transfer_offered', 'default_transfers', v_id::text,
    jsonb_build_object('lot_id', p_lot_id, 'to', v_next.user_id, 'rank', v_next.rank, 'amount', v_next.amount, 'reason', p_reason));
  return jsonb_build_object('transfer_id', v_id, 'rank', v_next.rank, 'amount', v_next.amount, 'expires_at', v_expires);
end $$;

create or replace function public.respond_transfer(p_transfer_id uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public.require_user(); v_t public.default_transfers%rowtype; v_lot public.lots%rowtype; v_order uuid;
begin
  select * into v_t from public.default_transfers where id = p_transfer_id for update;
  if not found or v_t.offered_to <> v_uid then raise exception 'NOT_FOUND'; end if;
  if v_t.status <> 'offered' then raise exception 'OFFER_NOT_ACTIVE'; end if;
  if now() >= v_t.expires_at then
    update public.default_transfers set status = 'expired', responded_at = now() where id = p_transfer_id;
    return jsonb_build_object('status', 'expired');
  end if;
  select * into v_lot from public.lots where id = v_t.lot_id;

  if p_accept then
    insert into public.orders (auction_id, user_id, source, total, due_at)
    values (v_lot.auction_id, v_uid, 'transfer', v_t.amount, v_t.payment_due_at) returning id into v_order;
    insert into public.order_items (order_id, lot_id, amount) values (v_order, v_t.lot_id, v_t.amount);
    update public.default_transfers set status = 'accepted', responded_at = now(), order_id = v_order where id = p_transfer_id;
    perform public.notify_admins('transfer_accepted', 'Oferta aceita', v_lot.title || ' — aguardando pagamento.',
      '/admin/pedidos', 'transfer_accepted:' || p_transfer_id);
  else
    update public.default_transfers set status = 'declined', responded_at = now() where id = p_transfer_id;
    perform public.notify_admins('transfer_declined', 'Oferta recusada', v_lot.title || ' — ofereça ao próximo colocado.',
      '/admin/pedidos', 'transfer_declined:' || p_transfer_id);
  end if;
  perform public.audit(case when p_accept then 'transfer_accepted' else 'transfer_declined' end,
    'default_transfers', p_transfer_id::text, '{}'::jsonb);
  return jsonb_build_object('status', case when p_accept then 'accepted' else 'declined' end, 'order_id', v_order);
end $$;

create or replace function public.expire_transfers()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with x as (
    update public.default_transfers set status = 'expired', responded_at = now()
    where status = 'offered' and expires_at <= now() returning id, lot_id
  ) select count(*) into n from x;
  if n > 0 then
    perform public.notify_admins('transfer_expired', 'Oferta expirada', 'Uma oferta de inadimplência expirou sem resposta.', '/admin/pedidos');
  end if;
  return n;
end $$;

create or replace function public.admin_cancel_transfer(p_transfer_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_admin uuid := public.require_admin();
begin
  update public.default_transfers set status = 'cancelled', responded_at = now()
  where id = p_transfer_id and status = 'offered';
  if not found then raise exception 'OFFER_NOT_ACTIVE'; end if;
  perform public.audit('transfer_cancelled', 'default_transfers', p_transfer_id::text, jsonb_build_object('reason', p_reason));
end $$;

-- ---------------------------------------------------------------------
-- Storage & shipments
-- ---------------------------------------------------------------------
create or replace function public.request_shipment(
  p_item_ids uuid[], p_method public.shipment_method, p_recipient text default '',
  p_address jsonb default '{}'::jsonb, p_postal_code text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public.require_user(); v_count int; v_id uuid;
begin
  if p_item_ids is null or array_length(p_item_ids, 1) is null then raise exception 'NO_ITEMS'; end if;
  select count(*) into v_count from public.stored_items
  where id = any(p_item_ids) and user_id = v_uid and status = 'stored';
  if v_count <> array_length(p_item_ids, 1) then raise exception 'ITEMS_UNAVAILABLE'; end if;
  if p_method = 'shipping' then
    if char_length(btrim(coalesce(p_recipient, ''))) < 3 then raise exception 'RECIPIENT_REQUIRED'; end if;
    if regexp_replace(coalesce(p_postal_code, ''), '\D', '', 'g') !~ '^\d{8}$' then raise exception 'INVALID_POSTAL_CODE'; end if;
    if coalesce(p_address ->> 'street', '') = '' or coalesce(p_address ->> 'city', '') = '' then raise exception 'ADDRESS_REQUIRED'; end if;
  end if;
  insert into public.shipments (user_id, method, recipient_name, address, postal_code)
  values (v_uid, p_method, btrim(coalesce(p_recipient, '')), coalesce(p_address, '{}'::jsonb),
          regexp_replace(coalesce(p_postal_code, ''), '\D', '', 'g'))
  returning id into v_id;
  update public.stored_items set status = 'requested', shipment_id = v_id, updated_at = now()
  where id = any(p_item_ids);
  perform public.notify_admins('shipment', 'Nova solicitação de ' || case when p_method = 'shipping' then 'envio' else 'retirada' end,
    v_count || ' item(ns).', '/admin/armazenamento', 'shipment:' || v_id);
  return v_id;
end $$;

create or replace function public.admin_update_shipment(
  p_id uuid, p_status public.shipment_status, p_fee numeric default null, p_tracking text default null, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_admin uuid := public.require_admin(); v_s public.shipments%rowtype;
begin
  select * into v_s from public.shipments where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_s.status in ('delivered', 'picked_up', 'cancelled') then raise exception 'SHIPMENT_FINISHED'; end if;
  update public.shipments set status = p_status, shipping_fee = coalesce(p_fee, shipping_fee),
    tracking_code = coalesce(p_tracking, tracking_code), admin_notes = coalesce(p_notes, admin_notes), updated_at = now()
  where id = p_id;
  update public.stored_items set updated_at = now(),
    status = case p_status when 'shipped' then 'shipped'::public.stored_status
                           when 'delivered' then 'delivered'::public.stored_status
                           when 'picked_up' then 'delivered'::public.stored_status
                           when 'cancelled' then 'stored'::public.stored_status
                           else status end,
    shipment_id = case when p_status = 'cancelled' then null else shipment_id end
  where shipment_id = p_id;
  perform public.notify(v_s.user_id, 'shipment_update', 'Atualização da sua entrega',
    case p_status when 'preparing' then 'Estamos separando suas cartas.'
                  when 'shipped' then 'Suas cartas foram enviadas.' || coalesce(' Código: ' || nullif(p_tracking, ''), '')
                  when 'delivered' then 'Entrega concluída.'
                  when 'ready_for_pickup' then 'Suas cartas estão prontas para retirada.'
                  when 'picked_up' then 'Retirada registrada. Obrigado!'
                  when 'cancelled' then 'Solicitação cancelada. Os itens voltaram para o armazenamento.'
                  else 'Status atualizado.' end,
    '/conta/armazenadas');
  perform public.audit('shipment_' || p_status, 'shipments', p_id::text, jsonb_build_object('fee', p_fee, 'tracking', p_tracking));
end $$;

-- ---------------------------------------------------------------------
-- Auction lifecycle (admin)
-- ---------------------------------------------------------------------
create or replace function public.admin_publish_auction(p_auction_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_admin uuid := public.require_admin(); v_a public.auctions%rowtype; r record;
begin
  select * into v_a from public.auctions where id = p_auction_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_a.status <> 'draft' then raise exception 'AUCTION_NOT_DRAFT'; end if;
  if v_a.ends_at <= now() then raise exception 'AUCTION_IN_PAST'; end if;
  if not exists (select 1 from public.lots where auction_id = p_auction_id) then raise exception 'AUCTION_EMPTY'; end if;
  if exists (
    select 1 from public.lots l where l.auction_id = p_auction_id and (
      (l.kind = 'single' and (select count(*) from public.lot_cards c where c.lot_id = l.id) <> 1) or
      (l.kind = 'combo' and (select count(*) from public.lot_cards c where c.lot_id = l.id) < 2))
  ) then raise exception 'LOT_CARDS_INVALID'; end if;

  perform set_config('gimmy.internal', 'on', true);
  update public.auctions set status = 'published', published_at = now() where id = p_auction_id;
  for r in select id from public.profiles where coalesce((notify_prefs ->> 'new_auction')::boolean, true) loop
    perform public.notify(r.id, 'new_auction', 'Novo leilão: ' || v_a.title,
      'Começa ' || to_char(v_a.starts_at at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24"h"MI') || '.',
      '/leiloes/' || p_auction_id, 'new_auction:' || p_auction_id);
  end loop;
  perform public.audit('auction_published', 'auctions', p_auction_id::text, '{}'::jsonb);
end $$;

create or replace function public.admin_unpublish_auction(p_auction_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_admin uuid := public.require_admin();
begin
  if exists (select 1 from public.lots where auction_id = p_auction_id and bid_count > 0) then
    raise exception 'AUCTION_HAS_BIDS';
  end if;
  perform set_config('gimmy.internal', 'on', true);
  update public.auctions set status = 'draft', published_at = null where id = p_auction_id and status = 'published';
  if not found then raise exception 'AUCTION_NOT_PUBLISHED'; end if;
  perform public.audit('auction_unpublished', 'auctions', p_auction_id::text, '{}'::jsonb);
end $$;

-- Cancel: only super admins once bids exist; bids are kept for the record.
create or replace function public.admin_cancel_auction(p_auction_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_admin uuid := public.require_admin();
begin
  if coalesce(btrim(p_reason), '') = '' then raise exception 'REASON_REQUIRED'; end if;
  if exists (select 1 from public.lots where auction_id = p_auction_id and bid_count > 0)
     and not public.is_super_admin(v_admin) then raise exception 'FORBIDDEN'; end if;
  if exists (select 1 from public.orders where auction_id = p_auction_id) then raise exception 'AUCTION_HAS_ORDERS'; end if;
  perform set_config('gimmy.internal', 'on', true);
  update public.lots set status = 'cancelled', closed_at = now() where auction_id = p_auction_id and status = 'open';
  update public.auctions set status = 'cancelled', closed_at = now() where id = p_auction_id and status in ('draft', 'published');
  if not found then raise exception 'AUCTION_LOCKED'; end if;
  perform public.audit('auction_cancelled', 'auctions', p_auction_id::text, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.admin_cancel_lot(p_lot_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_admin uuid := public.require_admin(); v_lot public.lots%rowtype;
begin
  if coalesce(btrim(p_reason), '') = '' then raise exception 'REASON_REQUIRED'; end if;
  select * into v_lot from public.lots where id = p_lot_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_lot.status <> 'open' then raise exception 'LOT_CLOSED'; end if;
  if v_lot.bid_count > 0 and not public.is_super_admin(v_admin) then raise exception 'FORBIDDEN'; end if;
  perform set_config('gimmy.internal', 'on', true);
  update public.lots set status = 'cancelled', closed_at = now() where id = p_lot_id;
  perform public.audit('lot_cancelled', 'lots', p_lot_id::text, jsonb_build_object('reason', p_reason));
end $$;

-- Ends a lot early (exceptional). Ranking is computed exactly like a normal close.
create or replace function public.admin_end_lot_now(p_lot_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_admin uuid := public.require_admin(); v_lot public.lots%rowtype;
begin
  if not public.is_super_admin(v_admin) then raise exception 'FORBIDDEN'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'REASON_REQUIRED'; end if;
  select * into v_lot from public.lots where id = p_lot_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_lot.status <> 'open' then raise exception 'LOT_CLOSED'; end if;
  perform set_config('gimmy.internal', 'on', true);
  update public.lots set ends_at = least(ends_at, clock_timestamp()) where id = p_lot_id;
  perform public._finalize_lot(p_lot_id, 'closed');
  perform public.audit('lot_ended_early', 'lots', p_lot_id::text, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.admin_duplicate_auction(p_auction_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_admin uuid := public.require_admin(); v_new uuid; r record; v_lot uuid;
begin
  insert into public.auctions (title, description, starts_at, ends_at, created_by)
  select title || ' (cópia)', description, p_starts_at, p_ends_at, v_admin from public.auctions where id = p_auction_id
  returning id into v_new;
  if v_new is null then raise exception 'NOT_FOUND'; end if;
  for r in select * from public.lots where auction_id = p_auction_id order by position loop
    insert into public.lots (auction_id, kind, title, description, starting_price, increment, buyout_price, ends_at, position)
    values (v_new, r.kind, r.title, r.description, r.starting_price, r.increment, r.buyout_price, p_ends_at, r.position)
    returning id into v_lot;
    insert into public.lot_cards (lot_id, card_id, position) select v_lot, card_id, position from public.lot_cards where lot_id = r.id;
  end loop;
  return v_new;
end $$;

-- ---------------------------------------------------------------------
-- Roles (super admin only). There must always be one super admin.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_role(p_user_id uuid, p_role public.app_role)
returns void language plpgsql security definer set search_path = public as $$
declare v_admin uuid := public.require_admin(); v_old public.app_role;
begin
  if not public.is_super_admin(v_admin) then raise exception 'FORBIDDEN'; end if;
  select role into v_old from public.profiles where id = p_user_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_old = 'super_admin' and p_role <> 'super_admin'
     and (select count(*) from public.profiles where role = 'super_admin') <= 1 then
    raise exception 'LAST_SUPER_ADMIN';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
  perform public.audit('role_changed', 'profiles', p_user_id::text, jsonb_build_object('from', v_old, 'to', p_role));
end $$;

-- ---------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------
create or replace function public.mark_notifications_read(p_ids bigint[] default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public.require_user(); n int;
begin
  with x as (
    update public.notifications set read_at = now()
    where user_id = v_uid and read_at is null and (p_ids is null or id = any(p_ids)) returning 1
  ) select count(*) into n from x;
  return n;
end $$;

-- "Ending soon" heads-up for everyone who bid on a lot, once, 1h before close.
create or replace function public.notify_ending_soon()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in
    select distinct b.user_id, l.id as lot_id, l.title from public.lots l
    join public.bids b on b.lot_id = l.id
    join public.profiles p on p.id = b.user_id
    where l.status = 'open' and l.ends_at > now() and l.ends_at <= now() + interval '1 hour'
      and coalesce((p.notify_prefs ->> 'ending_soon')::boolean, true)
  loop
    perform public.notify(r.user_id, 'ending_soon', 'Falta menos de 1 hora', r.title || ' encerra em breve.',
      '/lote/' || r.lot_id, 'ending:' || r.lot_id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Admin overview (real counts)
-- ---------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_admin uuid := public.require_admin();
begin
  return jsonb_build_object(
    'live_auctions', (select count(*) from public.auctions where status = 'published' and starts_at <= now() and ends_at > now()),
    'scheduled_auctions', (select count(*) from public.auctions where status = 'published' and starts_at > now()),
    'draft_auctions', (select count(*) from public.auctions where status = 'draft'),
    'published_lots', (select count(*) from public.lots l join public.auctions a on a.id = l.auction_id where a.status = 'published'),
    'open_lots', (select count(*) from public.lots where status = 'open'),
    'bids_total', (select count(*) from public.bids),
    'bids_24h', (select count(*) from public.bids where created_at > now() - interval '24 hours'),
    'orders_awaiting', (select count(*) from public.orders where status = 'awaiting_payment'),
    'proofs_pending', (select count(*) from public.orders where status = 'proof_submitted'),
    'orders_paid', (select count(*) from public.orders where status = 'paid'),
    'revenue_paid', (select coalesce(sum(total), 0) from public.orders where status = 'paid'),
    'revenue_open', (select coalesce(sum(total), 0) from public.orders where status in ('awaiting_payment', 'proof_submitted')),
    'overdue', (select count(*) from public.orders where status in ('awaiting_payment', 'proof_submitted') and due_at < now()),
    'transfers_active', (select count(*) from public.default_transfers where status = 'offered'),
    'shipments_open', (select count(*) from public.shipments where status in ('requested', 'preparing', 'ready_for_pickup')),
    'stored_items', (select count(*) from public.stored_items where status = 'stored'),
    'participants', (select count(*) from public.profiles),
    'bids_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'count', coalesce(c, 0)) order by d), '[]'::jsonb)
      from generate_series((now() at time zone 'America/Sao_Paulo')::date - 13, (now() at time zone 'America/Sao_Paulo')::date, interval '1 day') d
      left join (select (created_at at time zone 'America/Sao_Paulo')::date dd, count(*) c from public.bids
                 where created_at > now() - interval '15 days' group by 1) x on x.dd = d::date
    )
  );
end $$;
