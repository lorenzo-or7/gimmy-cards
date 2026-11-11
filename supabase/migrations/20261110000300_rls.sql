-- =====================================================================
-- Gimmy Cards — Row Level Security and grants
-- Default: deny. Writes to sensitive tables only through functions.
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.cards enable row level security;
alter table public.auctions enable row level security;
alter table public.lots enable row level security;
alter table public.lot_cards enable row level security;
alter table public.bids enable row level security;
alter table public.lot_rankings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_proofs enable row level security;
alter table public.default_transfers enable row level security;
alter table public.shipments enable row level security;
alter table public.stored_items enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;
alter table public.app_settings enable row level security;

-- Profiles ------------------------------------------------------------
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- role column is additionally protected by the profiles_guard trigger
revoke update on public.profiles from authenticated;
grant update (full_name, whatsapp, notify_prefs) on public.profiles to authenticated;

-- Catalogue: public reads only for non-draft auctions ------------------
create policy auctions_public_read on public.auctions for select to anon, authenticated
  using (status <> 'draft' or public.is_admin());
create policy auctions_admin_write on public.auctions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy lots_public_read on public.lots for select to anon, authenticated
  using (exists (select 1 from public.auctions a where a.id = auction_id and (a.status <> 'draft' or public.is_admin())));
create policy lots_admin_write on public.lots for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy lot_cards_public_read on public.lot_cards for select to anon, authenticated
  using (exists (select 1 from public.lots l join public.auctions a on a.id = l.auction_id
                 where l.id = lot_id and (a.status <> 'draft' or public.is_admin())));
create policy lot_cards_admin_write on public.lot_cards for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy cards_public_read on public.cards for select to anon, authenticated
  using (public.is_admin() or exists (
    select 1 from public.lot_cards lc join public.lots l on l.id = lc.lot_id join public.auctions a on a.id = l.auction_id
    where lc.card_id = cards.id and a.status <> 'draft'));
create policy cards_admin_write on public.cards for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Bids: never inserted directly (place_bid / buy_now). Own + admin reads.
create policy bids_read_own on public.bids for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy rankings_read on public.lot_rankings for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Orders and money ----------------------------------------------------
create policy orders_read_own on public.orders for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy order_items_read_own on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));
create policy proofs_read_own on public.payment_proofs for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy transfers_read_own on public.default_transfers for select to authenticated
  using (offered_to = auth.uid() or public.is_admin());
create policy shipments_read_own on public.shipments for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy stored_read_own on public.stored_items for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Notifications: read own (updates through mark_notifications_read)
create policy notifications_read_own on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy audit_admin_read on public.audit_log for select to authenticated
  using (public.is_admin());

create policy settings_public_read on public.app_settings for select to anon, authenticated using (true);
create policy settings_super_write on public.app_settings for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------------------------------------------------------------------
-- Function grants: lock down internals, expose the public RPC surface.
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_admin(uuid), public.is_super_admin(uuid) to anon, authenticated;
grant execute on function public.payment_due_for(timestamptz), public.public_alias(text), public.brl(numeric) to anon, authenticated;
grant execute on function public.lot_bid_board(uuid), public.lot_winner_alias(uuid), public.close_due_lots() to anon, authenticated;

grant execute on function
  public.place_bid(uuid, numeric, uuid),
  public.buy_now(uuid, uuid),
  public.submit_payment_proof(uuid, text),
  public.respond_transfer(uuid, boolean),
  public.request_shipment(uuid[], public.shipment_method, text, jsonb, text),
  public.mark_notifications_read(bigint[]),
  public.admin_review_payment(uuid, boolean, text),
  public.admin_set_order_due(uuid, timestamptz),
  public.admin_mark_default(uuid, text),
  public.admin_offer_next_bidder(uuid, text, timestamptz, int),
  public.admin_cancel_transfer(uuid, text),
  public.admin_update_shipment(uuid, public.shipment_status, numeric, text, text),
  public.admin_publish_auction(uuid),
  public.admin_unpublish_auction(uuid),
  public.admin_cancel_auction(uuid, text),
  public.admin_cancel_lot(uuid, text),
  public.admin_end_lot_now(uuid, text),
  public.admin_duplicate_auction(uuid, timestamptz, timestamptz),
  public.admin_set_role(uuid, public.app_role),
  public.admin_overview()
to authenticated;
-- (admin_* functions re-check the caller's role internally)
