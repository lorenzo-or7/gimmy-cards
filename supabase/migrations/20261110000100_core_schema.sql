-- =====================================================================
-- Gimmy Cards — core schema
-- Tables, enums, indexes and integrity constraints.
-- Critical business rules live in 20261110000200_functions.sql
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.app_role as enum ('participant', 'admin', 'super_admin');
create type public.card_condition as enum ('M', 'NM', 'SP', 'MP', 'HP', 'DM');
create type public.card_language as enum ('BR', 'ING', 'JAP', 'CNH');
create type public.auction_status as enum ('draft', 'published', 'closed', 'cancelled');
create type public.lot_kind as enum ('single', 'combo');
-- open: accepting bids (if inside the time window)
-- sold: closed by instant buyout
-- closed: ended by time with a winner
-- unsold: ended with no bids
-- cancelled: cancelled by an admin
create type public.lot_status as enum ('open', 'sold', 'closed', 'unsold', 'cancelled');
create type public.order_source as enum ('auction', 'transfer');
create type public.order_status as enum ('awaiting_payment', 'proof_submitted', 'paid', 'defaulted', 'cancelled');
create type public.order_item_status as enum ('active', 'void');
create type public.proof_status as enum ('pending', 'approved', 'rejected');
create type public.transfer_status as enum ('offered', 'accepted', 'declined', 'expired', 'cancelled');
create type public.stored_status as enum ('stored', 'requested', 'shipped', 'delivered');
create type public.shipment_method as enum ('shipping', 'pickup');
create type public.shipment_status as enum ('requested', 'preparing', 'shipped', 'delivered', 'ready_for_pickup', 'picked_up', 'cancelled');

-- ---------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  whatsapp text not null default '' check (char_length(whatsapp) <= 32),
  role public.app_role not null default 'participant',
  notify_prefs jsonb not null default '{"ending_soon": true, "new_auction": true, "outbid": true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role) where role <> 'participant';

-- ---------------------------------------------------------------------
-- Cards
-- ---------------------------------------------------------------------
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  collection text not null default '' check (char_length(collection) <= 160),
  language public.card_language not null,
  condition public.card_condition not null,
  front_path text,
  back_path text,
  notes text not null default '' check (char_length(notes) <= 2000),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index cards_title_idx on public.cards using btree (lower(title));

-- ---------------------------------------------------------------------
-- Auctions and lots
-- ---------------------------------------------------------------------
create table public.auctions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  description text not null default '' check (char_length(description) <= 4000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.auction_status not null default 'draft',
  payment_due_at timestamptz,
  orders_created_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  closed_at timestamptz,
  constraint auctions_window check (ends_at > starts_at)
);
create index auctions_status_ends_idx on public.auctions (status, ends_at);
create index auctions_starts_idx on public.auctions (starts_at);

create table public.lots (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions (id) on delete cascade,
  kind public.lot_kind not null default 'single',
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 4000),
  starting_price numeric(12, 2) not null check (starting_price > 0),
  increment numeric(12, 2) not null check (increment > 0),
  buyout_price numeric(12, 2),
  ends_at timestamptz not null,
  status public.lot_status not null default 'open',
  position int not null default 0,
  -- denormalised public state (kept in sync by place_bid / buy_now)
  current_price numeric(12, 2),
  bid_count int not null default 0,
  bidder_count int not null default 0,
  winner_id uuid references public.profiles (id),
  winning_amount numeric(12, 2),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint lots_buyout_above_start check (buyout_price is null or buyout_price > starting_price)
);
create index lots_auction_idx on public.lots (auction_id, position);
create index lots_open_due_idx on public.lots (ends_at) where status = 'open';

create table public.lot_cards (
  lot_id uuid not null references public.lots (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete restrict,
  position int not null default 0,
  primary key (lot_id, card_id)
);
create index lot_cards_card_idx on public.lot_cards (card_id);

-- ---------------------------------------------------------------------
-- Bids — id is a monotonic identity: inserts for a lot are serialised by a
-- row lock on the lot, so id order == server registration order.
-- ---------------------------------------------------------------------
create table public.bids (
  id bigint generated always as identity primary key,
  lot_id uuid not null references public.lots (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  is_buyout boolean not null default false,
  client_key uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint bids_no_identical unique (lot_id, user_id, amount),
  constraint bids_idempotent unique (user_id, client_key)
);
create index bids_lot_rank_idx on public.bids (lot_id, amount desc, id asc);
create index bids_user_idx on public.bids (user_id, created_at desc);

-- Final ranking snapshot, written once when a lot closes.
create table public.lot_rankings (
  lot_id uuid not null references public.lots (id) on delete cascade,
  rank int not null check (rank >= 1),
  user_id uuid not null references public.profiles (id),
  bid_id bigint not null references public.bids (id),
  amount numeric(12, 2) not null,
  primary key (lot_id, rank),
  unique (lot_id, user_id)
);

-- ---------------------------------------------------------------------
-- Orders and payments
-- ---------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  auction_id uuid not null references public.auctions (id),
  user_id uuid not null references public.profiles (id),
  source public.order_source not null default 'auction',
  status public.order_status not null default 'awaiting_payment',
  total numeric(12, 2) not null default 0 check (total >= 0),
  due_at timestamptz not null,
  paid_at timestamptz,
  confirmed_by uuid references public.profiles (id),
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- one regular order per participant per auction ("each auction is paid separately")
create unique index orders_one_per_auction on public.orders (auction_id, user_id) where source = 'auction';
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_due_idx on public.orders (status, due_at);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  lot_id uuid not null references public.lots (id),
  amount numeric(12, 2) not null check (amount > 0),
  status public.order_item_status not null default 'active',
  created_at timestamptz not null default now()
);
-- a lot can belong to only one live order item at a time
create unique index order_items_one_active_per_lot on public.order_items (lot_id) where status = 'active';
create index order_items_order_idx on public.order_items (order_id);

create table public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  file_path text not null,
  status public.proof_status not null default 'pending',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_note text not null default '',
  created_at timestamptz not null default now()
);
create index payment_proofs_order_idx on public.payment_proofs (order_id, created_at desc);

-- ---------------------------------------------------------------------
-- Default (non-payment) transfers to the next eligible bidder
-- ---------------------------------------------------------------------
create table public.default_transfers (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots (id),
  original_winner_id uuid not null references public.profiles (id),
  offered_to uuid not null references public.profiles (id),
  offered_rank int not null,
  amount numeric(12, 2) not null,
  reason text not null default '',
  status public.transfer_status not null default 'offered',
  offered_at timestamptz not null default now(),
  expires_at timestamptz not null,
  payment_due_at timestamptz not null,
  responded_at timestamptz,
  order_id uuid references public.orders (id),
  admin_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
-- never two active offers for the same lot
create unique index default_transfers_one_active on public.default_transfers (lot_id) where status = 'offered';
create index default_transfers_user_idx on public.default_transfers (offered_to, status);

-- ---------------------------------------------------------------------
-- Storage of paid items, shipments
-- ---------------------------------------------------------------------
create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  method public.shipment_method not null,
  recipient_name text not null default '',
  address jsonb not null default '{}'::jsonb,
  postal_code text not null default '',
  status public.shipment_status not null default 'requested',
  shipping_fee numeric(12, 2),
  tracking_code text not null default '',
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shipments_user_idx on public.shipments (user_id, created_at desc);
create index shipments_status_idx on public.shipments (status);

create table public.stored_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  order_item_id uuid not null unique references public.order_items (id),
  lot_id uuid not null references public.lots (id),
  status public.stored_status not null default 'stored',
  shipment_id uuid references public.shipments (id),
  stored_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stored_items_user_idx on public.stored_items (user_id, status);

-- ---------------------------------------------------------------------
-- Notifications and audit
-- ---------------------------------------------------------------------
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  link text not null default '',
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create unique index notifications_dedupe on public.notifications (user_id, dedupe_key) where dedupe_key is not null;

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id),
  action text not null,
  entity text not null,
  entity_id text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);
create index audit_log_created_idx on public.audit_log (created_at desc);

-- Single-row settings (payment instructions etc.)
create table public.app_settings (
  id boolean primary key default true check (id),
  pix_key text not null default 'lojagimmycards@gmail.com',
  card_link text not null default 'https://mpago.la/2QfsRQH',
  pickup_info text not null default 'Retirada em eventos, feiras ou local combinado em Curitiba/PR.',
  bid_rate_limit_per_minute int not null default 20,
  updated_at timestamptz not null default now()
);
insert into public.app_settings default values;
