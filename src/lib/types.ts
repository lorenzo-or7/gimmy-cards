export type Role = 'participant' | 'admin' | 'super_admin'
export type CardCondition = 'M' | 'NM' | 'SP' | 'MP' | 'HP' | 'DM'
export type CardLanguage = 'BR' | 'ING' | 'JAP' | 'CNH'
export type AuctionStatus = 'draft' | 'published' | 'closed' | 'cancelled'
export type LotKind = 'single' | 'combo'
export type LotStatus = 'open' | 'sold' | 'closed' | 'unsold' | 'cancelled'
export type OrderStatus = 'awaiting_payment' | 'proof_submitted' | 'paid' | 'defaulted' | 'cancelled'
export type TransferStatus = 'offered' | 'accepted' | 'declined' | 'expired' | 'cancelled'
export type StoredStatus = 'stored' | 'requested' | 'shipped' | 'delivered'
export type ShipmentMethod = 'shipping' | 'pickup'
export type ShipmentStatus = 'requested' | 'preparing' | 'shipped' | 'delivered' | 'ready_for_pickup' | 'picked_up' | 'cancelled'

export interface Pokemon {
  id: number
  dex: number | null
  name: string
  created_at?: string
  live_lots?: number
}

export interface Card {
  id: string
  title: string
  collection: string
  language: CardLanguage
  condition: CardCondition
  front_path: string | null
  back_path: string | null
  notes: string
  position: number
  created_at?: string
  lot_count?: number
  pokemon?: Pokemon[]
}

export interface Lot {
  id: string
  auction_id: string
  kind: LotKind
  title: string
  description: string
  starting_price: number
  increment: number
  buyout_price: number | null
  ends_at: string
  status: LotStatus
  position: number
  current_price: number | null
  bid_count: number
  bidder_count: number
  winning_amount: number | null
  closed_at: string | null
  card_count: number
  cards: Card[]
  winner_alias: string | null
  is_winner: boolean
  my_rank?: number | null
  my_amount?: number | null
  auction_title?: string
  auction_starts_at?: string
  auction?: Auction
  // my_bids extras
  last_bid_at?: string
  my_bid_count?: number
  // my_wins extras
  order_id?: string | null
  order_status?: OrderStatus | null
}

export interface Auction {
  id: string
  title: string
  description: string
  starts_at: string
  ends_at: string
  status: AuctionStatus
  payment_due_at: string
  published_at: string | null
  closed_at: string | null
  lot_count: number
  bid_count: number
  lots: Lot[] | null
}

export interface BoardBid {
  bid_id: number
  alias: string
  amount: number
  is_buyout: boolean
  created_at: string
  is_me: boolean
  user_rank: number | null
}

export interface BidResult {
  bid_id: number
  amount: number
  created_at: string
  rank: number | null
  replayed: boolean
  lot_status: LotStatus
}

export interface Profile {
  id: string
  full_name: string
  whatsapp: string
  role: Role
  email: string
  notify_prefs: { ending_soon?: boolean; new_auction?: boolean; outbid?: boolean; favorites?: boolean }
  created_at: string
}

export interface OrderItem {
  id: string
  amount: number
  status: 'active' | 'void'
  lot: Lot
}

export interface PaymentProof {
  id: string
  file_path: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  review_note: string
}

export interface Order {
  id: string
  code: string
  auction_id: string
  auction_title: string
  source: 'auction' | 'transfer'
  status: OrderStatus
  total: number
  due_at: string
  paid_at: string | null
  created_at: string
  admin_note: string
  overdue: boolean
  user: { id: string; full_name: string; whatsapp: string }
  items: OrderItem[]
  proofs: PaymentProof[]
}

export interface TransferOffer {
  id: string
  status: TransferStatus
  amount: number
  expires_at: string
  payment_due_at: string
  offered_at: string
  rank: number
  order_id: string | null
  lot: Lot
}

export interface StoredItem {
  id: string
  status: StoredStatus
  stored_at: string
  paid_at: string | null
  order_code: string
  auction_title: string
  amount: number
  shipment: null | {
    id: string
    method: ShipmentMethod
    status: ShipmentStatus
    tracking_code: string
    shipping_fee: number | null
    admin_notes: string
  }
  lot: Lot
}

export interface Notification {
  id: number
  kind: string
  title: string
  body: string
  link: string
  read_at: string | null
  created_at: string
  image_path?: string | null
}

export interface Settings {
  pix_key: string
  card_link: string
  pickup_info: string
  now: string
}

export interface Paged<T> {
  total: number
  items: T[]
}

export interface Overview {
  live_auctions: number
  scheduled_auctions: number
  draft_auctions: number
  published_lots: number
  open_lots: number
  bids_total: number
  bids_24h: number
  orders_awaiting: number
  proofs_pending: number
  orders_paid: number
  revenue_paid: number
  revenue_open: number
  overdue: number
  transfers_active: number
  shipments_open: number
  stored_items: number
  participants: number
  bids_by_day: { day: string; count: number }[]
}

export interface Participant {
  id: string
  full_name: string
  whatsapp: string
  email: string
  role: Role
  created_at: string
  bid_count: number
  wins: number
  orders_open: number
  defaults: number
  stored: number
}

export interface AdminBid {
  id: number
  amount: number
  is_buyout: boolean
  created_at: string
  user_name: string
  user_id: string
  lot_id: string
  lot_title: string
  auction_title: string
  rank: number | null
}

export interface LotRanking {
  lot: Lot
  ranking: { rank: number; user_id: string; amount: number; bid_id: number; full_name: string; whatsapp: string }[]
  transfers: {
    id: string
    status: TransferStatus
    rank: number
    amount: number
    offered_to: string
    offered_at: string
    expires_at: string
    responded_at: string | null
    reason: string
    payment_due_at: string
    admin: string
  }[]
  orders: { order_id: string; code: string; status: OrderStatus; user: string; amount: number; item_status: string; due_at: string }[]
}

export interface Shipment {
  id: string
  method: ShipmentMethod
  status: ShipmentStatus
  recipient_name: string
  address: Record<string, string>
  postal_code: string
  shipping_fee: number | null
  tracking_code: string
  admin_notes: string
  created_at: string
  user: { id: string; full_name: string; whatsapp: string }
  items: { id: string; lot_title: string; status: StoredStatus }[]
}

export interface AdminStored {
  id: string
  status: StoredStatus
  stored_at: string
  user: { id: string; full_name: string; whatsapp: string }
  lot_title: string
  auction_title: string
  amount: number
  order_code: string
}

export interface AuditEntry {
  id: number
  action: string
  entity: string
  entity_id: string
  created_at: string
  actor: string | null
  data: Record<string, unknown>
}
