-- =====================================================================
-- Gimmy Cards — read/write API (RPC). The frontend talks to the database
-- only through these functions, so the same contract works on Supabase
-- (supabase.rpc) and in the in-browser demo (PGlite running these migrations).
-- =====================================================================

-- ---------------------------------------------------------------------
-- JSON builders
-- ---------------------------------------------------------------------
create or replace function public._card_json(c public.cards, p_position int default 0)
returns jsonb language sql stable as $$
  select jsonb_build_object('id', c.id, 'title', c.title, 'collection', c.collection, 'language', c.language,
    'condition', c.condition, 'front_path', c.front_path, 'back_path', c.back_path, 'notes', c.notes, 'position', p_position)
$$;

create or replace function public._lot_cards_json(p_lot uuid, p_limit int default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._card_json(c, lc.position) order by lc.position, c.title), '[]'::jsonb)
  from (select * from public.lot_cards where lot_id = p_lot order by position limit p_limit) lc
  join public.cards c on c.id = lc.card_id
$$;

create or replace function public._lot_json(l public.lots, p_full boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_me record; v_j jsonb;
begin
  v_j := jsonb_build_object(
    'id', l.id, 'auction_id', l.auction_id, 'kind', l.kind, 'title', l.title, 'description', l.description,
    'starting_price', l.starting_price, 'increment', l.increment, 'buyout_price', l.buyout_price,
    'ends_at', l.ends_at, 'status', l.status, 'position', l.position,
    'current_price', l.current_price, 'bid_count', l.bid_count, 'bidder_count', l.bidder_count,
    'winning_amount', l.winning_amount, 'closed_at', l.closed_at,
    'card_count', (select count(*) from public.lot_cards where lot_id = l.id),
    'cards', public._lot_cards_json(l.id, case when p_full then null else 4 end),
    'winner_alias', case when l.winner_id is not null then public.lot_winner_alias(l.id) end,
    'is_winner', coalesce(l.winner_id = v_uid, false)
  );
  if v_uid is not null then
    select s.rank, s.amount into v_me from public.lot_standings(l.id) s where s.user_id = v_uid;
    v_j := v_j || jsonb_build_object('my_rank', v_me.rank, 'my_amount', v_me.amount);
  end if;
  return v_j;
end $$;

create or replace function public._auction_json(a public.auctions, p_with_lots boolean default true, p_full boolean default false)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', a.id, 'title', a.title, 'description', a.description, 'starts_at', a.starts_at, 'ends_at', a.ends_at,
    'status', a.status, 'payment_due_at', coalesce(a.payment_due_at, public.payment_due_for(a.ends_at)),
    'published_at', a.published_at, 'closed_at', a.closed_at,
    'lot_count', (select count(*) from public.lots where auction_id = a.id),
    'bid_count', (select coalesce(sum(bid_count), 0) from public.lots where auction_id = a.id),
    'lots', case when p_with_lots then (
      select coalesce(jsonb_agg(public._lot_json(l, p_full) order by l.position, l.created_at), '[]'::jsonb)
      from public.lots l where l.auction_id = a.id) else null end)
$$;

-- ---------------------------------------------------------------------
-- Public reads
-- ---------------------------------------------------------------------
create or replace function public.get_settings()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('pix_key', pix_key, 'card_link', card_link, 'pickup_info', pickup_info, 'now', now())
  from public.app_settings limit 1
$$;

-- scope: live | upcoming | closed
create or replace function public.list_auctions(p_scope text, p_limit int default 12, p_offset int default 0)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._auction_json(a, true, false) order by
           case when p_scope = 'closed' then extract(epoch from a.ends_at) * -1 else extract(epoch from a.starts_at) end), '[]'::jsonb)
  from (
    select * from public.auctions a
    where case p_scope
      when 'live' then a.status = 'published' and a.starts_at <= now() and a.ends_at > now()
      when 'upcoming' then a.status = 'published' and a.starts_at > now()
      when 'closed' then a.status = 'closed' or (a.status = 'published' and a.ends_at <= now())
      else false end
    order by case when p_scope = 'closed' then extract(epoch from a.ends_at) * -1 else extract(epoch from a.starts_at) end
    limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)
  ) a
$$;

create or replace function public.get_auction(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select public._auction_json(a, true, false) from public.auctions a
  where a.id = p_id and (a.status <> 'draft' or public.is_admin())
$$;

create or replace function public.get_lot(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select public._lot_json(l, true) || jsonb_build_object('auction', public._auction_json(a, false))
  from public.lots l join public.auctions a on a.id = l.auction_id
  where l.id = p_id and (a.status <> 'draft' or public.is_admin())
$$;

-- Catalogue: lots in live or upcoming auctions, filterable.
create or replace function public.list_catalog(
  p_search text default '', p_language public.card_language default null, p_condition public.card_condition default null,
  p_kind public.lot_kind default null, p_limit int default 24, p_offset int default 0)
returns jsonb language sql stable security definer set search_path = public as $$
  with base as (
    select l.id, l.ends_at, l.position from public.lots l join public.auctions a on a.id = l.auction_id
    where a.status = 'published' and a.ends_at > now() and l.status = 'open'
      and (p_kind is null or l.kind = p_kind)
      and (coalesce(p_search, '') = '' or l.title ilike '%' || p_search || '%' or exists (
            select 1 from public.lot_cards lc join public.cards c on c.id = lc.card_id
            where lc.lot_id = l.id and (c.title ilike '%' || p_search || '%' or c.collection ilike '%' || p_search || '%')))
      and (p_language is null or exists (select 1 from public.lot_cards lc join public.cards c on c.id = lc.card_id where lc.lot_id = l.id and c.language = p_language))
      and (p_condition is null or exists (select 1 from public.lot_cards lc join public.cards c on c.id = lc.card_id where lc.lot_id = l.id and c.condition = p_condition))
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'items', coalesce((select jsonb_agg(public._lot_json(l, false) || jsonb_build_object('auction_title', a.title, 'auction_starts_at', a.starts_at) order by b.ends_at, b.position)
               from (select * from base order by ends_at, position limit least(greatest(p_limit, 1), 60) offset greatest(p_offset, 0)) b
               join public.lots l on l.id = b.id join public.auctions a on a.id = l.auction_id), '[]'::jsonb))
$$;

-- History: finished lots with public results.
create or replace function public.list_history(p_limit int default 24, p_offset int default 0)
returns jsonb language sql stable security definer set search_path = public as $$
  with base as (
    select l.id, l.closed_at from public.lots l join public.auctions a on a.id = l.auction_id
    where l.status in ('sold', 'closed', 'unsold') and a.status <> 'draft'
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'items', coalesce((select jsonb_agg(public._lot_json(l, false) || jsonb_build_object('auction_title', a.title) order by b.closed_at desc nulls last)
               from (select * from base order by closed_at desc nulls last limit least(greatest(p_limit, 1), 60) offset greatest(p_offset, 0)) b
               join public.lots l on l.id = b.id join public.auctions a on a.id = l.auction_id), '[]'::jsonb))
$$;

-- ---------------------------------------------------------------------
-- Participant reads
-- ---------------------------------------------------------------------
create or replace function public.get_my_profile()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'full_name', p.full_name, 'whatsapp', p.whatsapp, 'role', p.role,
    'notify_prefs', p.notify_prefs, 'email', u.email, 'created_at', p.created_at)
  from public.profiles p join auth.users u on u.id = p.id where p.id = auth.uid()
$$;

create or replace function public.update_my_profile(p_full_name text, p_whatsapp text, p_notify_prefs jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public.require_user();
begin
  if char_length(btrim(coalesce(p_full_name, ''))) < 2 then raise exception 'NAME_REQUIRED'; end if;
  update public.profiles set full_name = btrim(p_full_name),
    whatsapp = left(regexp_replace(coalesce(p_whatsapp, ''), '[^0-9+]', '', 'g'), 32),
    notify_prefs = coalesce(p_notify_prefs, notify_prefs)
  where id = v_uid;
end $$;

create or replace function public.my_bids()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.j order by x.last_bid desc), '[]'::jsonb) from (
    select public._lot_json(l, false) || jsonb_build_object('last_bid_at', max(b.created_at), 'my_bid_count', count(*),
             'auction_title', a.title) as j, max(b.created_at) as last_bid
    from public.bids b join public.lots l on l.id = b.lot_id join public.auctions a on a.id = l.auction_id
    where b.user_id = auth.uid()
    group by l.id, a.title
    order by max(b.created_at) desc limit 200
  ) x
$$;

create or replace function public.my_wins()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'wins', coalesce((select jsonb_agg(public._lot_json(l, false) || jsonb_build_object(
               'auction_title', a.title,
               'order_id', (select o.id from public.order_items oi join public.orders o on o.id = oi.order_id
                            where oi.lot_id = l.id and o.user_id = auth.uid() order by o.created_at desc limit 1),
               'order_status', (select o.status from public.order_items oi join public.orders o on o.id = oi.order_id
                            where oi.lot_id = l.id and o.user_id = auth.uid() order by o.created_at desc limit 1))
             order by l.closed_at desc)
             from public.lots l join public.auctions a on a.id = l.auction_id
             where l.winner_id = auth.uid() or exists (
               select 1 from public.default_transfers t where t.lot_id = l.id and t.offered_to = auth.uid() and t.status = 'accepted')), '[]'::jsonb),
    'offers', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'status', t.status, 'amount', t.amount, 'expires_at', t.expires_at,
               'payment_due_at', t.payment_due_at, 'offered_at', t.offered_at, 'rank', t.offered_rank, 'order_id', t.order_id,
               'lot', public._lot_json(l, false)) order by t.offered_at desc)
             from public.default_transfers t join public.lots l on l.id = t.lot_id where t.offered_to = auth.uid()), '[]'::jsonb))
$$;

create or replace function public._order_json(o public.orders, p_full boolean default false)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', o.id, 'code', o.code, 'auction_id', o.auction_id, 'auction_title', a.title, 'source', o.source,
    'status', o.status, 'total', o.total, 'due_at', o.due_at, 'paid_at', o.paid_at, 'created_at', o.created_at,
    'admin_note', o.admin_note, 'overdue', o.status in ('awaiting_payment', 'proof_submitted') and o.due_at < now(),
    'user', jsonb_build_object('id', p.id, 'full_name', p.full_name, 'whatsapp', p.whatsapp),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', oi.id, 'amount', oi.amount, 'status', oi.status,
               'lot', public._lot_json(l, p_full)) order by l.position)
             from public.order_items oi join public.lots l on l.id = oi.lot_id where oi.order_id = o.id), '[]'::jsonb),
    'proofs', coalesce((select jsonb_agg(jsonb_build_object('id', pp.id, 'file_path', pp.file_path, 'status', pp.status,
               'created_at', pp.created_at, 'review_note', pp.review_note) order by pp.created_at desc)
             from public.payment_proofs pp where pp.order_id = o.id), '[]'::jsonb))
  from public.auctions a, public.profiles p where a.id = o.auction_id and p.id = o.user_id
$$;

create or replace function public.my_orders()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._order_json(o) order by o.created_at desc), '[]'::jsonb)
  from public.orders o where o.user_id = auth.uid()
$$;

create or replace function public.get_order(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select public._order_json(o, true) from public.orders o
  where o.id = p_id and (o.user_id = auth.uid() or public.is_admin())
$$;

create or replace function public.my_stored()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'status', s.status, 'stored_at', s.stored_at,
           'paid_at', o.paid_at, 'order_code', o.code, 'auction_title', a.title, 'amount', oi.amount,
           'shipment', case when sh.id is null then null else jsonb_build_object('id', sh.id, 'method', sh.method,
             'status', sh.status, 'tracking_code', sh.tracking_code, 'shipping_fee', sh.shipping_fee, 'admin_notes', sh.admin_notes) end,
           'lot', public._lot_json(l, false)) order by s.stored_at desc), '[]'::jsonb)
  from public.stored_items s
  join public.order_items oi on oi.id = s.order_item_id
  join public.orders o on o.id = oi.order_id
  join public.lots l on l.id = s.lot_id
  join public.auctions a on a.id = l.auction_id
  left join public.shipments sh on sh.id = s.shipment_id
  where s.user_id = auth.uid()
$$;

create or replace function public.my_notifications(p_limit int default 50)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'unread', (select count(*) from public.notifications where user_id = auth.uid() and read_at is null),
    'items', coalesce((select jsonb_agg(to_jsonb(n) - 'dedupe_key' order by n.created_at desc)
             from (select * from public.notifications where user_id = auth.uid() order by created_at desc limit least(p_limit, 200)) n), '[]'::jsonb))
$$;

-- ---------------------------------------------------------------------
-- Admin reads / writes
-- ---------------------------------------------------------------------
create or replace function public.admin_list_auctions()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return (select coalesce(jsonb_agg(public._auction_json(a, false) order by a.starts_at desc), '[]'::jsonb) from public.auctions a);
end $$;

create or replace function public.admin_get_auction(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return (select public._auction_json(a, true, true) from public.auctions a where a.id = p_id);
end $$;

create or replace function public.admin_save_auction(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_admin uuid := public.require_admin(); v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_starts timestamptz := (p ->> 'starts_at')::timestamptz; v_ends timestamptz := (p ->> 'ends_at')::timestamptz;
begin
  if v_starts is null or v_ends is null or v_ends <= v_starts then raise exception 'INVALID_DATES'; end if;
  if v_id is null then
    insert into public.auctions (title, description, starts_at, ends_at, payment_due_at, created_by)
    values (p ->> 'title', coalesce(p ->> 'description', ''), v_starts, v_ends, nullif(p ->> 'payment_due_at', '')::timestamptz, v_admin)
    returning id into v_id;
  else
    update public.auctions set title = p ->> 'title', description = coalesce(p ->> 'description', ''),
      starts_at = v_starts, ends_at = v_ends, payment_due_at = nullif(p ->> 'payment_due_at', '')::timestamptz
    where id = v_id and status in ('draft', 'published');
    if not found then raise exception 'AUCTION_LOCKED'; end if;
    -- keep lot end times inside the auction window (only lots without bids move)
    update public.lots set ends_at = v_ends where auction_id = v_id and bid_count = 0 and (ends_at > v_ends or (p ->> 'sync_lot_ends')::boolean);
  end if;
  return v_id;
end $$;

-- p: { id?, auction_id, kind, title, description, starting_price, increment, buyout_price, ends_at?, position, card_ids[] }
create or replace function public.admin_save_lot(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_admin uuid := public.require_admin(); v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_cards uuid[] := array(select jsonb_array_elements_text(coalesce(p -> 'card_ids', '[]'::jsonb))::uuid);
  v_kind public.lot_kind := coalesce(nullif(p ->> 'kind', ''), 'single')::public.lot_kind; v_bids int;
begin
  if v_kind = 'single' and array_length(v_cards, 1) is distinct from 1 then raise exception 'LOT_CARDS_INVALID'; end if;
  if v_kind = 'combo' and coalesce(array_length(v_cards, 1), 0) < 2 then raise exception 'LOT_CARDS_INVALID'; end if;
  if v_id is null then
    insert into public.lots (auction_id, kind, title, description, starting_price, increment, buyout_price, ends_at, position)
    values ((p ->> 'auction_id')::uuid, v_kind, p ->> 'title', coalesce(p ->> 'description', ''),
            (p ->> 'starting_price')::numeric, (p ->> 'increment')::numeric, nullif(p ->> 'buyout_price', '')::numeric,
            nullif(p ->> 'ends_at', '')::timestamptz,
            coalesce((p ->> 'position')::int, (select coalesce(max(position) + 1, 0) from public.lots where auction_id = (p ->> 'auction_id')::uuid)))
    returning id into v_id;
  else
    select bid_count into v_bids from public.lots where id = v_id;
    update public.lots set kind = v_kind, title = p ->> 'title', description = coalesce(p ->> 'description', ''),
      starting_price = (p ->> 'starting_price')::numeric, increment = (p ->> 'increment')::numeric,
      buyout_price = nullif(p ->> 'buyout_price', '')::numeric,
      ends_at = coalesce(nullif(p ->> 'ends_at', '')::timestamptz, ends_at),
      position = coalesce((p ->> 'position')::int, position)
    where id = v_id;
    if v_bids > 0 and exists (
      select 1 from (select card_id from public.lot_cards where lot_id = v_id except select unnest(v_cards)) x
      union all select 1 from (select unnest(v_cards) except select card_id from public.lot_cards where lot_id = v_id) y)
    then raise exception 'LOT_HAS_BIDS'; end if;
    delete from public.lot_cards where lot_id = v_id;
  end if;
  insert into public.lot_cards (lot_id, card_id, position)
  select v_id, c, i - 1 from unnest(v_cards) with ordinality as t(c, i);
  return v_id;
end $$;

create or replace function public.admin_delete_lot(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  delete from public.lots where id = p_id;
end $$;

create or replace function public.admin_list_cards(p_search text default '', p_limit int default 60, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'total', (select count(*) from public.cards c where coalesce(p_search, '') = '' or c.title ilike '%' || p_search || '%' or c.collection ilike '%' || p_search || '%'),
    'items', coalesce((select jsonb_agg(public._card_json(c) || jsonb_build_object('created_at', c.created_at,
               'lot_count', (select count(*) from public.lot_cards lc where lc.card_id = c.id)) order by c.created_at desc)
             from (select * from public.cards c where coalesce(p_search, '') = '' or c.title ilike '%' || p_search || '%' or c.collection ilike '%' || p_search || '%'
                   order by c.created_at desc limit least(p_limit, 200) offset p_offset) c), '[]'::jsonb));
end $$;

create or replace function public.admin_save_card(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_admin uuid := public.require_admin(); v_id uuid := nullif(p ->> 'id', '')::uuid;
begin
  if v_id is null then
    insert into public.cards (title, collection, language, condition, front_path, back_path, notes, created_by)
    values (p ->> 'title', coalesce(p ->> 'collection', ''), (p ->> 'language')::public.card_language,
            (p ->> 'condition')::public.card_condition, nullif(p ->> 'front_path', ''), nullif(p ->> 'back_path', ''),
            coalesce(p ->> 'notes', ''), v_admin)
    returning id into v_id;
  else
    update public.cards set title = p ->> 'title', collection = coalesce(p ->> 'collection', ''),
      language = (p ->> 'language')::public.card_language, condition = (p ->> 'condition')::public.card_condition,
      front_path = coalesce(nullif(p ->> 'front_path', ''), front_path), back_path = coalesce(nullif(p ->> 'back_path', ''), back_path),
      notes = coalesce(p ->> 'notes', '')
    where id = v_id;
  end if;
  return v_id;
end $$;

create or replace function public.admin_delete_card(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if exists (select 1 from public.lot_cards where card_id = p_id) then raise exception 'CARD_IN_USE'; end if;
  delete from public.cards where id = p_id;
end $$;

create or replace function public.admin_list_participants(p_search text default '')
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'whatsapp', p.whatsapp,
      'email', u.email, 'role', p.role, 'created_at', p.created_at,
      'bid_count', (select count(*) from public.bids b where b.user_id = p.id),
      'wins', (select count(*) from public.lots l where l.winner_id = p.id),
      'orders_open', (select count(*) from public.orders o where o.user_id = p.id and o.status in ('awaiting_payment', 'proof_submitted')),
      'defaults', (select count(*) from public.orders o where o.user_id = p.id and o.status = 'defaulted'),
      'stored', (select count(*) from public.stored_items s where s.user_id = p.id and s.status = 'stored'))
    order by p.created_at desc), '[]'::jsonb)
    from public.profiles p join auth.users u on u.id = p.id
    where coalesce(p_search, '') = '' or p.full_name ilike '%' || p_search || '%' or u.email ilike '%' || p_search || '%' or p.whatsapp like '%' || p_search || '%');
end $$;

create or replace function public.admin_list_bids(p_lot uuid default null, p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return (select coalesce(jsonb_agg(x order by (x ->> 'id')::bigint desc), '[]'::jsonb) from (
    select jsonb_build_object('id', b.id, 'amount', b.amount, 'is_buyout', b.is_buyout, 'created_at', b.created_at,
      'user_name', p.full_name, 'user_id', p.id, 'lot_id', l.id, 'lot_title', l.title, 'auction_title', a.title,
      'rank', (select s.rank from public.lot_standings(l.id) s where s.bid_id = b.id)) x
    from public.bids b join public.profiles p on p.id = b.user_id join public.lots l on l.id = b.lot_id join public.auctions a on a.id = l.auction_id
    where p_lot is null or b.lot_id = p_lot
    order by b.id desc limit least(p_limit, 500)) t);
end $$;

-- Ranking + contact details + transfer history for one lot (default handling screen)
create or replace function public.admin_lot_ranking(p_lot uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'lot', (select public._lot_json(l, false) from public.lots l where l.id = p_lot),
    'ranking', coalesce((select jsonb_agg(jsonb_build_object('rank', s.rank, 'user_id', s.user_id, 'amount', s.amount,
        'bid_id', s.bid_id, 'full_name', p.full_name, 'whatsapp', p.whatsapp) order by s.rank)
      from (select * from public.lot_rankings where lot_id = p_lot
            union all
            select p_lot, x.rank, x.user_id, x.bid_id, x.amount from public.lot_standings(p_lot) x
            where not exists (select 1 from public.lot_rankings where lot_id = p_lot)) s
      join public.profiles p on p.id = s.user_id), '[]'::jsonb),
    'transfers', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'status', t.status, 'rank', t.offered_rank,
        'amount', t.amount, 'offered_to', p.full_name, 'offered_at', t.offered_at, 'expires_at', t.expires_at,
        'responded_at', t.responded_at, 'reason', t.reason, 'payment_due_at', t.payment_due_at, 'admin', ad.full_name) order by t.offered_at)
      from public.default_transfers t join public.profiles p on p.id = t.offered_to join public.profiles ad on ad.id = t.admin_id
      where t.lot_id = p_lot), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(jsonb_build_object('order_id', o.id, 'code', o.code, 'status', o.status, 'user', p.full_name,
        'amount', oi.amount, 'item_status', oi.status, 'due_at', o.due_at) order by o.created_at)
      from public.order_items oi join public.orders o on o.id = oi.order_id join public.profiles p on p.id = o.user_id
      where oi.lot_id = p_lot), '[]'::jsonb));
end $$;

create or replace function public.admin_list_orders(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return (select coalesce(jsonb_agg(public._order_json(o) order by
      case o.status when 'proof_submitted' then 0 when 'awaiting_payment' then 1 else 2 end, o.due_at), '[]'::jsonb)
    from public.orders o
    where p_status is null or p_status = '' or o.status::text = p_status
       or (p_status = 'overdue' and o.status in ('awaiting_payment', 'proof_submitted') and o.due_at < now()));
end $$;

create or replace function public.admin_list_shipments(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return (select coalesce(jsonb_agg(jsonb_build_object('id', sh.id, 'method', sh.method, 'status', sh.status,
      'recipient_name', sh.recipient_name, 'address', sh.address, 'postal_code', sh.postal_code, 'shipping_fee', sh.shipping_fee,
      'tracking_code', sh.tracking_code, 'admin_notes', sh.admin_notes, 'created_at', sh.created_at,
      'user', jsonb_build_object('id', p.id, 'full_name', p.full_name, 'whatsapp', p.whatsapp),
      'items', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'lot_title', l.title, 'status', s.status)), '[]'::jsonb)
                from public.stored_items s join public.lots l on l.id = s.lot_id where s.shipment_id = sh.id))
    order by sh.created_at desc), '[]'::jsonb)
    from public.shipments sh join public.profiles p on p.id = sh.user_id
    where p_status is null or p_status = '' or sh.status::text = p_status);
end $$;

create or replace function public.admin_list_stored()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'status', s.status, 'stored_at', s.stored_at,
      'user', jsonb_build_object('id', p.id, 'full_name', p.full_name, 'whatsapp', p.whatsapp),
      'lot_title', l.title, 'auction_title', a.title, 'amount', oi.amount, 'order_code', o.code)
    order by p.full_name, s.stored_at), '[]'::jsonb)
    from public.stored_items s join public.profiles p on p.id = s.user_id join public.lots l on l.id = s.lot_id
    join public.auctions a on a.id = l.auction_id join public.order_items oi on oi.id = s.order_item_id join public.orders o on o.id = oi.order_id
    where s.status in ('stored', 'requested'));
end $$;

create or replace function public.admin_audit(p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'action', l.action, 'entity', l.entity, 'entity_id', l.entity_id,
      'created_at', l.created_at, 'actor', p.full_name, 'data', l.data - 'before' - 'after') order by l.id desc), '[]'::jsonb)
    from (select * from public.audit_log order by id desc limit least(p_limit, 500)) l left join public.profiles p on p.id = l.actor_id);
end $$;

create or replace function public.admin_save_settings(p_pix_key text, p_card_link text, p_pickup_info text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  update public.app_settings set pix_key = p_pix_key, card_link = p_card_link, pickup_info = p_pickup_info, updated_at = now();
  perform public.audit('settings_changed', 'app_settings', 'true', jsonb_build_object('pix_key', p_pix_key, 'card_link', p_card_link));
end $$;

-- ---------------------------------------------------------------------
-- Grants for the API surface
-- ---------------------------------------------------------------------
grant execute on function
  public.get_settings(), public.list_auctions(text, int, int), public.get_auction(uuid), public.get_lot(uuid),
  public.list_catalog(text, public.card_language, public.card_condition, public.lot_kind, int, int),
  public.list_history(int, int)
to anon, authenticated;

grant execute on function
  public.get_my_profile(), public.update_my_profile(text, text, jsonb), public.my_bids(), public.my_wins(),
  public.my_orders(), public.get_order(uuid), public.my_stored(), public.my_notifications(int),
  public.admin_list_auctions(), public.admin_get_auction(uuid), public.admin_save_auction(jsonb), public.admin_save_lot(jsonb),
  public.admin_delete_lot(uuid), public.admin_list_cards(text, int, int), public.admin_save_card(jsonb), public.admin_delete_card(uuid),
  public.admin_list_participants(text), public.admin_list_bids(uuid, int), public.admin_lot_ranking(uuid),
  public.admin_list_orders(text), public.admin_list_shipments(text), public.admin_list_stored(), public.admin_audit(int),
  public.admin_save_settings(text, text, text)
to authenticated;

-- ---------------------------------------------------------------------
-- Lock down internal helpers. On Supabase, functions get EXECUTE for
-- anon/authenticated by default, so revoke everything that is not part of
-- the public API (the _* JSON builders, triggers, sweepers, notify...).
-- ---------------------------------------------------------------------
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

revoke execute on function
  public._card_json(public.cards, int), public._lot_cards_json(uuid, int), public._lot_json(public.lots, boolean),
  public._auction_json(public.auctions, boolean, boolean), public._order_json(public.orders, boolean),
  public._finalize_lot(uuid, public.lot_status), public._create_orders_for_auction(uuid),
  public.notify(uuid, text, text, text, text, text), public.notify_admins(text, text, text, text, text),
  public.audit(text, text, text, jsonb), public.lot_standings(uuid), public.current_role_of(uuid),
  public.require_admin(), public.require_user(), public.expire_transfers(), public.notify_ending_soon(),
  public.flag_overdue_orders(), public.handle_new_user(), public.guard_profile_update(), public.guard_lot_write(),
  public.guard_lot_delete(), public.guard_auction_write(), public.audit_row()
from public, anon, authenticated;
