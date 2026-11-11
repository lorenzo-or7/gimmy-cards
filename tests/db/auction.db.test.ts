import { beforeAll, describe, expect, it } from 'vitest'
import { createDb, expectError, expire, key, liveLot, type Db } from './harness'

let db: Db
let admin: string
let superAdmin: string
let joao: string
let maria: string
let pedro: string
let ana: string

beforeAll(async () => {
  db = await createDb()
  superAdmin = await db.createUser('Gimmy Root', 'super_admin')
  admin = await db.createUser('Admin Comum', 'admin')
  joao = await db.createUser('João Silva')
  maria = await db.createUser('Maria Souza')
  pedro = await db.createUser('Pedro Lima')
  ana = await db.createUser('Ana Costa')
}, 60_000)

type BidRes = { bid_id: number; amount: number; rank: number; replayed: boolean; lot_status: string }

describe('accounts and permissions', () => {
  it('creates a participant profile from sign-up metadata, ignoring any role in metadata', async () => {
    const p = await db.one<{ full_name: string; role: string; whatsapp: string }>(
      'select full_name, role, whatsapp from public.profiles where id = $1', [joao])
    expect(p.full_name).toBe('João Silva')
    expect(p.role).toBe('participant')
    expect(p.whatsapp).toBe('+5541999990000')
  })

  it('blocks a participant from elevating their own role', async () => {
    await db.as(joao)
    await expectError(db.query(`update public.profiles set role = 'admin' where id = $1`, [joao]), 'FORBIDDEN')
  })

  it('only a super admin can change roles, and the last super admin is protected', async () => {
    await db.as(admin)
    await expectError(db.rpc('admin_set_role', [pedro, 'admin']), 'FORBIDDEN')
    await db.as(superAdmin)
    await expectError(db.rpc('admin_set_role', [superAdmin, 'admin']), 'LAST_SUPER_ADMIN')
  })

  it('participants cannot call admin functions', async () => {
    await db.as(joao)
    await expectError(db.rpc('admin_overview', []), 'FORBIDDEN')
  })

  it('anonymous users cannot bid', async () => {
    const { lotId } = await liveLot(db, admin)
    await db.as(null)
    await expectError(db.rpc('place_bid', [lotId, 20, key()]), 'AUTH_REQUIRED')
  })
})

describe('lot setup', () => {
  it('rejects publishing a combo with fewer than two cards', async () => {
    await db.as(admin)
    const a = await db.one<{ id: string }>(
      `insert into public.auctions (title, starts_at, ends_at) values ('Combo inválido', now(), now() + interval '1 day') returning id`)
    await db.query(`insert into public.lots (auction_id, kind, title, starting_price, increment) values ($1, 'combo', 'Combo', 10, 5)`, [a.id])
    await expectError(db.rpc('admin_publish_auction', [a.id]), 'LOT_CARDS_INVALID')
  })

  it('publishes a combo with many cards and inherits the auction end time', async () => {
    const { lotId, auctionId } = await liveLot(db, admin, { kind: 'combo', cards: 12 })
    const r = await db.one<{ n: number; same: boolean }>(
      `select (select count(*)::int from public.lot_cards where lot_id = $1) n,
              (select l.ends_at = a.ends_at from public.lots l join public.auctions a on a.id = l.auction_id where l.id = $1) same`, [lotId])
    expect(r.n).toBe(12)
    expect(r.same).toBe(true)
    expect(auctionId).toBeTruthy()
  })

  it('rejects a buyout price below the starting price', async () => {
    await db.as(admin)
    const a = await db.one<{ id: string }>(
      `insert into public.auctions (title, starts_at, ends_at) values ('Teste buyout', now(), now() + interval '1 day') returning id`)
    await expectError(
      db.query(`insert into public.lots (auction_id, title, starting_price, increment, buyout_price) values ($1, 'x', 50, 5, 40)`, [a.id]),
      'lots_buyout_above_start')
  })

  it('participants cannot write lots directly', async () => {
    const { lotId } = await liveLot(db, admin)
    await db.as(joao)
    const res = await db.query(`update public.lots set status = 'sold' where id = $1`, [lotId]).catch((e) => e)
    // either RLS hides the row (0 rows) or the guard raises — never succeeds
    const row = await db.one<{ status: string }>(`select status from public.lots where id = $1`, [lotId])
    expect(row.status).toBe('open')
    expect(res).toBeDefined()
  })
})

describe('bidding rules', () => {
  it('enforces the minimum on the first bid', async () => {
    const { lotId } = await liveLot(db, admin, { start: 20, inc: 5 })
    await db.as(joao)
    await expectError(db.rpc('place_bid', [lotId, 19.99, key()]), 'BELOW_MINIMUM')
    const r = await db.rpc<BidRes>('place_bid', [lotId, 20, key()])
    expect(r.rank).toBe(1)
  })

  it('requires the increment when going above the top bid', async () => {
    const { lotId } = await liveLot(db, admin, { start: 20, inc: 5 })
    await db.as(joao)
    await db.rpc('place_bid', [lotId, 30, key()])
    await db.as(maria)
    await expectError(db.rpc('place_bid', [lotId, 33, key()]), 'BELOW_INCREMENT')
    const r = await db.rpc<BidRes>('place_bid', [lotId, 35, key()])
    expect(r.rank).toBe(1)
  })

  it('allows repeating an existing value; the earlier registration keeps priority (official example)', async () => {
    const { lotId } = await liveLot(db, admin, { start: 20, inc: 5, buyout: null })
    await db.as(pedro)
    await db.rpc('place_bid', [lotId, 95, key()])
    await db.as(joao)
    await db.rpc('place_bid', [lotId, 100, key()])
    await db.as(maria)
    const m = await db.rpc<BidRes>('place_bid', [lotId, 100, key()])
    expect(m.rank).toBe(2)

    await db.as(null)
    const rows = await db.query<{ rank: number; full_name: string; amount: string }>(
      `select s.rank, p.full_name, s.amount::text from public.lot_standings($1) s join public.profiles p on p.id = s.user_id order by s.rank`, [lotId])
    expect(rows.rows.map((r) => [r.rank, r.full_name, r.amount])).toEqual([
      [1, 'João Silva', '100.00'],
      [2, 'Maria Souza', '100.00'],
      [3, 'Pedro Lima', '95.00'],
    ])
  })

  it('accepts a lower offer as a secondary position, but never below the minimum or the own best bid', async () => {
    const { lotId } = await liveLot(db, admin, { start: 20, inc: 5 })
    await db.as(joao)
    await db.rpc('place_bid', [lotId, 60, key()])
    await db.as(maria)
    const r = await db.rpc<BidRes>('place_bid', [lotId, 40, key()])
    expect(r.rank).toBe(2)
    await expectError(db.rpc('place_bid', [lotId, 40, key()]), 'NOT_ABOVE_OWN_BID')
    await expectError(db.rpc('place_bid', [lotId, 35, key()]), 'NOT_ABOVE_OWN_BID')
  })

  it('does not create duplicate records for retried requests (idempotency key)', async () => {
    const { lotId } = await liveLot(db, admin)
    await db.as(ana)
    const k = key()
    const a = await db.rpc<BidRes>('place_bid', [lotId, 25, k])
    const b = await db.rpc<BidRes>('place_bid', [lotId, 25, k])
    expect(b.bid_id).toBe(a.bid_id)
    expect(b.replayed).toBe(true)
    const c = await db.one<{ n: number }>(`select count(*)::int n from public.bids where lot_id = $1`, [lotId])
    expect(c.n).toBe(1)
  })

  it('serialises a burst of competing bids in server order (sequential simulation)', async () => {
    const { lotId } = await liveLot(db, admin, { start: 10, inc: 1 })
    const users = [joao, maria, pedro, ana]
    // all four try 50 "at the same time"; registration order decides
    for (const u of users) {
      await db.as(u)
      await db.rpc('place_bid', [lotId, 50, key()])
    }
    await db.as(null)
    const rows = await db.query<{ user_id: string; rank: number }>(`select user_id, rank from public.lot_standings($1)`, [lotId])
    expect(rows.rows.map((r) => r.user_id)).toEqual(users)
    const ids = await db.query<{ id: string }>(`select id::text from public.bids where lot_id = $1 order by created_at, id`, [lotId])
    const sorted = [...ids.rows].map((r) => BigInt(r.id))
    expect(sorted).toEqual([...sorted].sort((x, y) => (x < y ? -1 : 1)))
  })

  it('rejects bids after the official end time and on unpublished auctions', async () => {
    const { lotId, auctionId } = await liveLot(db, admin)
    await expire(db, auctionId)
    await db.as(joao)
    await expectError(db.rpc('place_bid', [lotId, 30, key()]), 'LOT_ENDED')

    await db.as(admin)
    const a = await db.one<{ id: string }>(
      `insert into public.auctions (title, starts_at, ends_at) values ('rascunho', now() - interval '1 hour', now() + interval '1 day') returning id`)
    const l = await db.one<{ id: string }>(
      `insert into public.lots (auction_id, title, starting_price, increment) values ($1, 'x', 10, 1) returning id`, [a.id])
    await db.as(joao)
    await expectError(db.rpc('place_bid', [l.id, 10, key()]), 'AUCTION_NOT_OPEN')
  })

  it('rejects bids before the auction starts', async () => {
    await db.as(admin)
    const a = await db.one<{ id: string }>(
      `insert into public.auctions (title, starts_at, ends_at) values ('futuro', now() + interval '1 day', now() + interval '2 days') returning id`)
    const l = await db.one<{ id: string }>(
      `insert into public.lots (auction_id, title, starting_price, increment) values ($1, 'x', 10, 1) returning id`, [a.id])
    const c = await db.one<{ id: string }>(`insert into public.cards (title, language, condition) values ('c', 'JAP', 'M') returning id`)
    await db.query(`insert into public.lot_cards (lot_id, card_id) values ($1, $2)`, [l.id, c.id])
    await db.rpc('admin_publish_auction', [a.id])
    await db.as(joao)
    await expectError(db.rpc('place_bid', [l.id, 10, key()]), 'AUCTION_NOT_STARTED')
  })

  it('a normal bid can never reach the buyout ceiling', async () => {
    const { lotId } = await liveLot(db, admin, { start: 20, inc: 5, buyout: 100 })
    await db.as(joao)
    await expectError(db.rpc('place_bid', [lotId, 100, key()]), 'USE_BUYOUT')
    await expectError(db.rpc('place_bid', [lotId, 150, key()]), 'USE_BUYOUT')
  })

  it('notifies the previous leader when outbid', async () => {
    const { lotId } = await liveLot(db, admin, { start: 20, inc: 5 })
    await db.as(pedro)
    await db.rpc('place_bid', [lotId, 20, key()])
    await db.as(ana)
    await db.rpc('place_bid', [lotId, 25, key()])
    await db.as(null)
    const n = await db.one<{ n: number }>(
      `select count(*)::int n from public.notifications where user_id = $1 and kind = 'outbid' and link = $2`, [pedro, '/lote/' + lotId])
    expect(n.n).toBe(1)
  })
})

describe('instant buyout', () => {
  it('closes the lot atomically, only one buyer, later bids rejected', async () => {
    const { lotId } = await liveLot(db, admin, { start: 20, inc: 5, buyout: 100 })
    await db.as(joao)
    await db.rpc('place_bid', [lotId, 40, key()])
    await db.as(maria)
    const r = await db.rpc<BidRes>('buy_now', [lotId, key()])
    expect(r.lot_status).toBe('sold')
    await db.as(pedro)
    await expectError(db.rpc('buy_now', [lotId, key()]), 'LOT_CLOSED')
    await expectError(db.rpc('place_bid', [lotId, 60, key()]), 'LOT_CLOSED')
    await db.as(null)
    const lot = await db.one<{ status: string; winner_id: string; winning_amount: string }>(
      `select status, winner_id, winning_amount::text from public.lots where id = $1`, [lotId])
    expect(lot).toEqual({ status: 'sold', winner_id: maria, winning_amount: '100.00' })
    const ranks = await db.query<{ user_id: string }>(`select user_id from public.lot_rankings where lot_id = $1 order by rank`, [lotId])
    expect(ranks.rows.map((x) => x.user_id)).toEqual([maria, joao])
  })

  it('rejects buyout on lots without a buyout price', async () => {
    const { lotId } = await liveLot(db, admin, { buyout: null })
    await db.as(joao)
    await expectError(db.rpc('buy_now', [lotId, key()]), 'NO_BUYOUT')
  })
})

describe('closing, orders and payments', () => {
  it('closes after the end time, snapshots ranking and handles lots without bids', async () => {
    const { lotId, auctionId } = await liveLot(db, admin)
    await db.as(admin)
    // add an empty second lot
    const l2 = await db.one<{ id: string }>(
      `insert into public.lots (auction_id, title, starting_price, increment) values ($1, 'Sem lances', 10, 1) returning id`, [auctionId])
    await db.as(joao)
    await db.rpc('place_bid', [lotId, 30, key()])
    await expire(db, auctionId)
    const res = await db.rpc<{ lots_closed: number; orders_created: number }>('close_due_lots', [])
    expect(res.lots_closed).toBeGreaterThanOrEqual(2)
    await db.as(null)
    const s = await db.query<{ id: string; status: string }>(`select id, status from public.lots where auction_id = $1`, [auctionId])
    const byId = Object.fromEntries(s.rows.map((r) => [r.id, r.status]))
    expect(byId[lotId]).toBe('closed')
    expect(byId[l2.id]).toBe('unsold')
    const a = await db.one<{ status: string }>(`select status from public.auctions where id = $1`, [auctionId])
    expect(a.status).toBe('closed')
    // idempotent
    const again = await db.rpc<{ lots_closed: number; orders_created: number }>('close_due_lots', [])
    const o = await db.one<{ n: number }>(`select count(*)::int n from public.orders where auction_id = $1`, [auctionId])
    expect(o.n).toBe(1)
    expect(again.orders_created).toBe(0)
  })

  it('groups won lots into one order per participant per auction with the summed total', async () => {
    const { lotId: l1, auctionId } = await liveLot(db, admin, { start: 10, inc: 5 })
    await db.as(admin)
    const l2 = await db.one<{ id: string }>(
      `insert into public.lots (auction_id, title, starting_price, increment, position) values ($1, 'Lote 2', 10, 5, 1) returning id`, [auctionId])
    await db.as(ana)
    await db.rpc('place_bid', [l1, 45, key()])
    await db.rpc('place_bid', [l2.id, 15.5, key()])
    await expire(db, auctionId)
    await db.rpc('close_due_lots', [])
    await db.as(ana)
    const o = await db.one<{ id: string; total: string; status: string; items: number; due_ok: boolean }>(
      `select o.id, o.total::text, o.status, (select count(*)::int from public.order_items where order_id = o.id) items,
              o.due_at = public.payment_due_for(a.ends_at) due_ok
       from public.orders o join public.auctions a on a.id = o.auction_id where o.auction_id = $1`, [auctionId])
    expect(o.total).toBe('60.50')
    expect(o.items).toBe(2)
    expect(o.status).toBe('awaiting_payment')
    expect(o.due_ok).toBe(true)
  })

  it('computes the payment deadline as the next Monday at 18:00 in Brasília', async () => {
    // Wednesday 2026-11-11 19:00 BRT (22:00 UTC) -> Monday 2026-11-16 18:00 BRT
    const r = await db.one<{ d: string }>(
      `select to_char(public.payment_due_for('2026-11-11 22:00:00+00') at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI:SS ID') d`)
    expect(r.d).toBe('2026-11-16 18:00:00 1')
    const f = await db.one<{ d: string }>(
      `select to_char(public.payment_due_for('2026-11-13 22:00:00+00') at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI:SS') d`)
    expect(f.d).toBe('2026-11-16 18:00:00')
  })

  it('a proof does not mark the order paid; only an admin confirmation does, which stores the cards', async () => {
    const { lotId, auctionId } = await liveLot(db, admin)
    await db.as(pedro)
    await db.rpc('place_bid', [lotId, 50, key()])
    await expire(db, auctionId)
    await db.rpc('close_due_lots', [])
    await db.as(pedro)
    const o = await db.one<{ id: string }>(`select id from public.orders where auction_id = $1`, [auctionId])
    await expectError(db.rpc('submit_payment_proof', [o.id, `${joao}/x.pdf`]), 'INVALID_FILE')
    await db.rpc('submit_payment_proof', [o.id, `${pedro}/comprovante.pdf`])
    const after = await db.one<{ status: string }>(`select status from public.orders where id = $1`, [o.id])
    expect(after.status).toBe('proof_submitted')

    await db.as(joao)
    await expectError(db.rpc('admin_review_payment', [o.id, true, '']), 'FORBIDDEN')
    await db.as(admin)
    await db.rpc('admin_review_payment', [o.id, true, 'PIX conferido'])
    await db.as(pedro)
    const paid = await db.one<{ status: string; stored: number }>(
      `select o.status, (select count(*)::int from public.stored_items s where s.user_id = $2 and s.lot_id = $3) stored
       from public.orders o where o.id = $1`, [o.id, pedro, lotId])
    expect(paid).toEqual({ status: 'paid', stored: 1 })
  })

  it('a participant cannot see another participant\'s orders', async () => {
    await db.as(maria)
    await db.query('set role authenticated')
    try {
      const r = await db.query(`select * from public.orders where user_id <> $1`, [maria])
      expect(r.rows.length).toBe(0)
    } finally {
      await db.query('reset role')
    }
  })
})

describe('default (non-payment) transfers', () => {
  async function closedLotWithBids(amounts: [string, number][]) {
    const { lotId, auctionId } = await liveLot(db, admin, { start: 10, inc: 5, buyout: null })
    for (const [u, v] of amounts) {
      await db.as(u)
      await db.rpc('place_bid', [lotId, v, key()])
    }
    await expire(db, auctionId)
    await db.rpc('close_due_lots', [])
    await db.as(null)
    const o = await db.one<{ id: string; user_id: string }>(
      `select o.id, o.user_id from public.orders o join public.order_items oi on oi.order_id = o.id where oi.lot_id = $1`, [lotId])
    return { lotId, auctionId, orderId: o.id, winner: o.user_id }
  }

  async function makeOverdue(orderId: string) {
    await db.as(null)
    await db.query(`update public.orders set due_at = now() - interval '1 minute' where id = $1`, [orderId])
  }

  it('cannot mark default before the deadline, then offers to the 2nd place (tie respected) and accepts', async () => {
    // joao 100 (1st), maria 100 (2nd by order), pedro 95 (3rd)
    const { lotId, orderId, winner } = await closedLotWithBids([[joao, 100], [maria, 100], [pedro, 95]])
    expect(winner).toBe(joao)
    await db.as(admin)
    await expectError(db.rpc('admin_mark_default', [orderId, 'não pagou']), 'NOT_OVERDUE')
    await expectError(db.rpc('admin_offer_next_bidder', [lotId, 'x', null, 24]), 'LOT_HAS_ACTIVE_ORDER')
    await makeOverdue(orderId)
    await db.as(admin)
    await expectError(db.rpc('admin_mark_default', [orderId, '']), 'REASON_REQUIRED')
    await db.rpc('admin_mark_default', [orderId, 'Sem pagamento até segunda'])
    const offer = await db.rpc<{ transfer_id: string; rank: number; amount: number }>(
      'admin_offer_next_bidder', [lotId, 'Inadimplência do 1º colocado', null, 24])
    expect(offer.rank).toBe(2)
    expect(Number(offer.amount)).toBe(100)
    // no second active offer
    await expectError(db.rpc('admin_offer_next_bidder', [lotId, 'x', null, 24]), 'TRANSFER_ALREADY_ACTIVE')

    await db.as(pedro)
    await expectError(db.rpc('respond_transfer', [offer.transfer_id, true]), 'NOT_FOUND')
    await db.as(maria)
    const r = await db.rpc<{ status: string; order_id: string }>('respond_transfer', [offer.transfer_id, true])
    expect(r.status).toBe('accepted')
    const o = await db.one<{ total: string; source: string; status: string }>(
      `select total::text, source, status from public.orders where id = $1`, [r.order_id])
    expect(o).toEqual({ total: '100.00', source: 'transfer', status: 'awaiting_payment' })
  })

  it('a decline lets the admin move on to the next place, preserving order', async () => {
    const { lotId, orderId } = await closedLotWithBids([[ana, 80], [pedro, 70], [maria, 60]])
    await makeOverdue(orderId)
    await db.as(admin)
    await db.rpc('admin_mark_default', [orderId, 'não pagou'])
    const first = await db.rpc<{ transfer_id: string; rank: number }>('admin_offer_next_bidder', [lotId, 'x', null, 24])
    expect(first.rank).toBe(2)
    await db.as(pedro)
    await db.rpc('respond_transfer', [first.transfer_id, false])
    await db.as(admin)
    const second = await db.rpc<{ transfer_id: string; rank: number; amount: number }>('admin_offer_next_bidder', [lotId, 'x', null, 24])
    expect(second.rank).toBe(3)
    expect(Number(second.amount)).toBe(60)
  })

  it('offers expire after the acceptance window; accepting late is refused', async () => {
    const { lotId, orderId } = await closedLotWithBids([[joao, 50], [ana, 45]])
    await makeOverdue(orderId)
    await db.as(admin)
    await db.rpc('admin_mark_default', [orderId, 'não pagou'])
    const offer = await db.rpc<{ transfer_id: string }>('admin_offer_next_bidder', [lotId, 'x', null, 24])
    await db.as(null)
    await db.query(`update public.default_transfers set expires_at = now() - interval '1 second' where id = $1`, [offer.transfer_id])
    await db.as(ana)
    const r = await db.rpc<{ status: string }>('respond_transfer', [offer.transfer_id, true])
    expect(r.status).toBe('expired')
    await db.as(admin)
    await expectError(db.rpc('admin_offer_next_bidder', [lotId, 'x', null, 24]), 'NO_ELIGIBLE_BIDDER')
  })

  it('records the transfer in the audit log', async () => {
    await db.as(null)
    const n = await db.one<{ n: number }>(`select count(*)::int n from public.audit_log where action = 'transfer_offered'`)
    expect(n.n).toBeGreaterThan(0)
  })
})

describe('storage and shipping', () => {
  async function paidItem(user: string) {
    const { lotId, auctionId } = await liveLot(db, admin, { buyout: null })
    await db.as(user)
    await db.rpc('place_bid', [lotId, 20, key()])
    await expire(db, auctionId)
    await db.rpc('close_due_lots', [])
    await db.as(null)
    const o = await db.one<{ id: string }>(`select id from public.orders where auction_id = $1`, [auctionId])
    await db.as(admin)
    await db.rpc('admin_review_payment', [o.id, true, ''])
    await db.as(null)
    return db.one<{ id: string }>(`select id from public.stored_items where lot_id = $1`, [lotId])
  }

  it('accumulates paid items from different auctions and ships them together', async () => {
    const a = await paidItem(ana)
    const b = await paidItem(ana)
    await db.as(ana)
    await expectError(db.rpc('request_shipment', [[a.id, b.id], 'shipping', 'Ana Costa', JSON.stringify({ street: 'Rua X, 10', city: 'Curitiba' }), '123']), 'INVALID_POSTAL_CODE')
    const id = await db.rpc<string>('request_shipment', [[a.id, b.id], 'shipping', 'Ana Costa', JSON.stringify({ street: 'Rua X, 10', city: 'Curitiba', state: 'PR' }), '80000-000'])
    expect(id).toBeTruthy()
    const s = await db.query<{ status: string }>(`select status from public.stored_items where id = any($1::uuid[])`, [[a.id, b.id]])
    expect(s.rows.every((r) => r.status === 'requested')).toBe(true)
    // cannot request the same items twice
    await expectError(db.rpc('request_shipment', [[a.id], 'pickup', '', '{}', '']), 'ITEMS_UNAVAILABLE')
  })

  it('a participant cannot request shipment of someone else\'s items', async () => {
    const item = await paidItem(pedro)
    await db.as(joao)
    await expectError(db.rpc('request_shipment', [[item.id], 'pickup', '', '{}', '']), 'ITEMS_UNAVAILABLE')
  })

  it('cancelling a shipment returns items to storage', async () => {
    const item = await paidItem(maria)
    await db.as(maria)
    const sid = await db.rpc<string>('request_shipment', [[item.id], 'pickup', '', '{}', ''])
    await db.as(admin)
    await db.rpc('admin_update_shipment', [sid, 'cancelled', null, null, 'cliente pediu'])
    await db.as(null)
    const s = await db.one<{ status: string; shipment_id: string | null }>(
      `select status, shipment_id from public.stored_items where id = $1`, [item.id])
    expect(s).toEqual({ status: 'stored', shipment_id: null })
  })
})

describe('public data', () => {
  it('bid board masks names', async () => {
    const { lotId } = await liveLot(db, admin)
    await db.as(maria)
    await db.rpc('place_bid', [lotId, 30, key()])
    await db.as(null)
    const r = await db.one<{ alias: string; is_me: boolean }>(`select alias, is_me from public.lot_bid_board($1)`, [lotId])
    expect(r.alias).toBe('Maria S.')
    expect(r.is_me).toBe(false)
  })

  it('draft auctions are invisible to visitors (RLS)', async () => {
    await db.as(admin)
    await db.query(`insert into public.auctions (title, starts_at, ends_at) values ('secreto', now(), now() + interval '1 day')`)
    await db.as(null)
    await db.query('set role anon')
    try {
      const r = await db.query(`select * from public.auctions where title = 'secreto'`)
      expect(r.rows.length).toBe(0)
    } finally {
      await db.query('reset role')
    }
  })

  it('admin overview returns real counts', async () => {
    await db.as(admin)
    const o = await db.rpc<{ bids_total: number; orders_paid: number }>('admin_overview', [])
    expect(o.bids_total).toBeGreaterThan(10)
    expect(o.orders_paid).toBeGreaterThan(0)
  })
})
