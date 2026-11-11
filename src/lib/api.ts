import { getBackend } from './backend'
import { toAppError } from './errors'
import type {
  AdminBid, AdminStored, Auction, AuditEntry, BidResult, BoardBid, Card, CardCondition, CardLanguage, Lot, LotKind,
  LotRanking, Notification, Order, Overview, Paged, Participant, Profile, Settings, Shipment, ShipmentMethod,
  ShipmentStatus, StoredItem, TransferOffer, Role, Pokemon,
} from './types'

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const b = await getBackend()
  try {
    return await b.rpc<T>(fn, args)
  } catch (e) {
    throw toAppError(e)
  }
}

/** Postgres numeric arrives as string from PostgREST; normalise recursively. */
const NUMERIC_KEYS = new Set([
  'starting_price', 'increment', 'buyout_price', 'current_price', 'winning_amount', 'my_amount', 'amount', 'total',
  'shipping_fee', 'revenue_paid', 'revenue_open',
])
function norm<T>(v: T): T {
  if (v instanceof Date) return v.toISOString() as T
  if (typeof v === 'bigint') return Number(v) as T
  if (Array.isArray(v)) return v.map(norm) as T
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      o[k] = NUMERIC_KEYS.has(k) && x !== null && x !== undefined && x !== '' ? Number(x) : norm(x)
    }
    return o as T
  }
  return v
}
const q = async <T,>(fn: string, args?: Record<string, unknown>) => norm(await rpc<T>(fn, args))

export const api = {
  // public
  settings: () => q<Settings>('get_settings'),
  auctions: (scope: 'live' | 'upcoming' | 'closed', limit = 12, offset = 0) =>
    q<Auction[]>('list_auctions', { p_scope: scope, p_limit: limit, p_offset: offset }).then((x) => x ?? []),
  auction: (id: string) => q<Auction | null>('get_auction', { p_id: id }),
  lot: (id: string) => q<Lot | null>('get_lot', { p_id: id }),
  board: (lotId: string) => q<BoardBid[]>('lot_bid_board', { p_lot_id: lotId }).then((x) => x ?? []),
  catalog: (f: { search?: string; language?: CardLanguage | null; condition?: CardCondition | null; kind?: LotKind | null; limit?: number; offset?: number }) =>
    q<Paged<Lot>>('list_catalog', {
      p_search: f.search ?? '', p_language: f.language ?? null, p_condition: f.condition ?? null, p_kind: f.kind ?? null,
      p_limit: f.limit ?? 24, p_offset: f.offset ?? 0,
    }),
  history: (limit = 24, offset = 0) => q<Paged<Lot>>('list_history', { p_limit: limit, p_offset: offset }),
  featured: (limit = 12) => q<Lot[]>('list_featured_cards', { p_limit: limit }).then((x) => x ?? []),
  searchPokemon: (query: string, limit = 20) => q<Pokemon[]>('search_pokemon', { p_query: query, p_limit: limit }).then((x) => x ?? []),
  myFavorites: () => q<Pokemon[]>('my_favorites').then((x) => x ?? []),
  addFavorite: (id: number) => rpc<void>('add_favorite_pokemon', { p_pokemon_id: id }),
  removeFavorite: (id: number) => rpc<void>('remove_favorite_pokemon', { p_pokemon_id: id }),
  nudgeClose: () => rpc<unknown>('close_due_lots').catch(() => null),

  // participant
  me: () => q<Profile | null>('get_my_profile'),
  updateMe: (full_name: string, whatsapp: string, notify_prefs?: Profile['notify_prefs']) =>
    rpc<void>('update_my_profile', { p_full_name: full_name, p_whatsapp: whatsapp, p_notify_prefs: notify_prefs ?? null }),
  placeBid: (lotId: string, amount: number, clientKey: string) =>
    q<BidResult>('place_bid', { p_lot_id: lotId, p_amount: amount, p_client_key: clientKey }),
  buyNow: (lotId: string, clientKey: string) => q<BidResult>('buy_now', { p_lot_id: lotId, p_client_key: clientKey }),
  myBids: () => q<Lot[]>('my_bids').then((x) => x ?? []),
  myWins: () => q<{ wins: Lot[]; offers: TransferOffer[] }>('my_wins'),
  respondTransfer: (id: string, accept: boolean) =>
    q<{ status: string; order_id?: string }>('respond_transfer', { p_transfer_id: id, p_accept: accept }),
  myOrders: () => q<Order[]>('my_orders').then((x) => x ?? []),
  order: (id: string) => q<Order | null>('get_order', { p_id: id }),
  submitProof: (orderId: string, path: string) => rpc<string>('submit_payment_proof', { p_order_id: orderId, p_file_path: path }),
  myStored: () => q<StoredItem[]>('my_stored').then((x) => x ?? []),
  requestShipment: (ids: string[], method: ShipmentMethod, recipient = '', address: Record<string, string> = {}, postal = '') =>
    rpc<string>('request_shipment', { p_item_ids: ids, p_method: method, p_recipient: recipient, p_address: address, p_postal_code: postal }),
  notifications: (limit = 50) => q<{ unread: number; items: Notification[] }>('my_notifications', { p_limit: limit }),
  markRead: (ids: number[] | null = null) => rpc<number>('mark_notifications_read', { p_ids: ids }),

  // admin
  admin: {
    overview: () => q<Overview>('admin_overview'),
    auctions: () => q<Auction[]>('admin_list_auctions').then((x) => x ?? []),
    auction: (id: string) => q<Auction | null>('admin_get_auction', { p_id: id }),
    saveAuction: (p: { id?: string; title: string; description: string; starts_at: string; ends_at: string; payment_due_at?: string | null; sync_lot_ends?: boolean }) =>
      rpc<string>('admin_save_auction', { p }),
    saveLot: (p: {
      id?: string; auction_id: string; kind: LotKind; title: string; description: string; starting_price: number;
      increment: number; buyout_price: number | null; ends_at?: string | null; position?: number; card_ids: string[]
    }) => rpc<string>('admin_save_lot', { p }),
    deleteLot: (id: string) => rpc<void>('admin_delete_lot', { p_id: id }),
    publish: (id: string) => rpc<void>('admin_publish_auction', { p_auction_id: id }),
    unpublish: (id: string) => rpc<void>('admin_unpublish_auction', { p_auction_id: id }),
    cancelAuction: (id: string, reason: string) => rpc<void>('admin_cancel_auction', { p_auction_id: id, p_reason: reason }),
    duplicate: (id: string, starts: string, ends: string) =>
      rpc<string>('admin_duplicate_auction', { p_auction_id: id, p_starts_at: starts, p_ends_at: ends }),
    cancelLot: (id: string, reason: string) => rpc<void>('admin_cancel_lot', { p_lot_id: id, p_reason: reason }),
    endLotNow: (id: string, reason: string) => rpc<void>('admin_end_lot_now', { p_lot_id: id, p_reason: reason }),
    cards: (search = '', limit = 60, offset = 0) =>
      q<Paged<Card>>('admin_list_cards', { p_search: search, p_limit: limit, p_offset: offset }),
    saveCard: (p: Partial<Card> & { title: string; language: CardLanguage; condition: CardCondition }) =>
      rpc<string>('admin_save_card', { p }),
    deleteCard: (id: string) => rpc<void>('admin_delete_card', { p_id: id }),
    setCardPokemon: (cardId: string, ids: number[]) => rpc<void>('admin_set_card_pokemon', { p_card_id: cardId, p_pokemon_ids: ids }),
    addPokemon: (name: string, dex: number | null) => rpc<number>('admin_add_pokemon', { p_name: name, p_dex: dex }),
    participants: (search = '') => q<Participant[]>('admin_list_participants', { p_search: search }).then((x) => x ?? []),
    setRole: (userId: string, role: Role) => rpc<void>('admin_set_role', { p_user_id: userId, p_role: role }),
    bids: (lotId: string | null = null, limit = 150) => q<AdminBid[]>('admin_list_bids', { p_lot: lotId, p_limit: limit }).then((x) => x ?? []),
    ranking: (lotId: string) => q<LotRanking>('admin_lot_ranking', { p_lot: lotId }),
    orders: (status: string | null = null) => q<Order[]>('admin_list_orders', { p_status: status }).then((x) => x ?? []),
    reviewPayment: (orderId: string, approve: boolean, note = '') =>
      rpc<void>('admin_review_payment', { p_order_id: orderId, p_approve: approve, p_note: note }),
    setOrderDue: (orderId: string, due: string) => rpc<void>('admin_set_order_due', { p_order_id: orderId, p_due: due }),
    markDefault: (orderId: string, reason: string) => rpc<void>('admin_mark_default', { p_order_id: orderId, p_reason: reason }),
    offerNext: (lotId: string, reason: string, paymentDue: string | null, hours = 24) =>
      q<{ transfer_id: string; rank: number; amount: number; expires_at: string }>('admin_offer_next_bidder', {
        p_lot_id: lotId, p_reason: reason, p_payment_due: paymentDue, p_accept_hours: hours,
      }),
    cancelTransfer: (id: string, reason: string) => rpc<void>('admin_cancel_transfer', { p_transfer_id: id, p_reason: reason }),
    shipments: (status: string | null = null) => q<Shipment[]>('admin_list_shipments', { p_status: status }).then((x) => x ?? []),
    updateShipment: (id: string, status: ShipmentStatus, fee: number | null, tracking: string | null, notes: string | null) =>
      rpc<void>('admin_update_shipment', { p_id: id, p_status: status, p_fee: fee, p_tracking: tracking, p_notes: notes }),
    stored: () => q<AdminStored[]>('admin_list_stored').then((x) => x ?? []),
    audit: (limit = 100) => q<AuditEntry[]>('admin_audit', { p_limit: limit }).then((x) => x ?? []),
    saveSettings: (pix: string, card: string, pickup: string) =>
      rpc<void>('admin_save_settings', { p_pix_key: pix, p_card_link: card, p_pickup_info: pickup }),
  },
}

export async function imageUrl(path: string | null | undefined, variant: 'thumb' | 'full' = 'full') {
  return (await getBackend()).storage.imageUrl(path, variant)
}
