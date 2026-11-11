-- =====================================================================
-- Gimmy Cards — Storage buckets, Realtime publication and scheduled jobs.
-- Requires the Supabase platform (storage schema, pg_cron, realtime).
-- =====================================================================

-- Storage -------------------------------------------------------------
-- card-images: public read (lot photos), admin write, 8 MB, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-images', 'card-images', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- payment-proofs: PRIVATE. Owner uploads to "<uid>/...", admins read. 10 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "card images admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'card-images' and public.is_admin());
create policy "card images admin update" on storage.objects for update to authenticated
  using (bucket_id = 'card-images' and public.is_admin());
create policy "card images admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'card-images' and public.is_admin());

create policy "proofs owner upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "proofs owner or admin read" on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- Realtime ------------------------------------------------------------
-- lots carries the public live state (current_price, bid_count, status)
alter publication supabase_realtime add table public.lots;
alter publication supabase_realtime add table public.notifications;

-- Scheduled jobs (pg_cron) ----------------------------------------------
-- Closing happens on the server every minute, even if nobody has the site open.
-- Bids after ends_at are rejected by place_bid regardless of this schedule.
create extension if not exists pg_cron;

select cron.schedule('gimmy-close-due-lots', '* * * * *', $$select public.close_due_lots()$$);
select cron.schedule('gimmy-expire-transfers', '*/5 * * * *', $$select public.expire_transfers()$$);
select cron.schedule('gimmy-ending-soon', '*/5 * * * *', $$select public.notify_ending_soon()$$);
select cron.schedule('gimmy-flag-overdue', '15 * * * *', $$select public.flag_overdue_orders()$$);
