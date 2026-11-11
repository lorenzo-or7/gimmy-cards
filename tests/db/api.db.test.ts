import { beforeAll, describe, expect, it } from 'vitest'
import { createDb, expectError, expire, key, liveLot, type Db } from './harness'

let db: Db
let admin: string
let bia: string
let caio: string
let live: { auctionId: string; lotId: string }

beforeAll(async () => {
  db = await createDb()
  admin = await db.createUser('Admin Principal', 'super_admin')
  bia = await db.createUser('Bia Rocha')
  caio = await db.createUser('Caio Nunes')
  live = await liveLot(db, admin, { start: 20, inc: 5, buyout: 100 })
  await db.as(bia)
  await db.rpc('place_bid', [live.lotId, 30, key()])
}, 60_000)

describe('public API', () => {
  it('lists live auctions with lots, cards and current price', async () => {
    await db.as(null)
    const list = await db.rpc<Array<{ id: string; lots: Array<{ current_price: number; cards: unknown[] }> }>>('list_auctions', ['live', 12, 0])
    const a = list.find((x) => x.id === live.auctionId)!
    expect(a).toBeTruthy()
    expect(Number(a.lots[0].current_price)).toBe(30)
    expect(a.lots[0].cards.length).toBe(1)
  })

  it('get_lot returns full detail; my_rank only for the signed-in bidder', async () => {
    await db.as(null)
    const anon = await db.rpc<Record<string, unknown>>('get_lot', [live.lotId])
    expect(anon.my_rank).toBeUndefined()
    await db.as(bia)
    const mine = await db.rpc<Record<string, unknown>>('get_lot', [live.lotId])
    expect(mine.my_rank).toBe(1)
    expect((mine.auction as { title: string }).title).toBe('Leilão de teste')
  })

  it('catalog filters by language and search', async () => {
    await db.as(null)
    const all = await db.rpc<{ total: number }>('list_catalog', ['', null, null, null, 24, 0])
    expect(all.total).toBeGreaterThan(0)
    const none = await db.rpc<{ total: number }>('list_catalog', ['', 'JAP', null, null, 24, 0])
    expect(none.total).toBe(0)
    const found = await db.rpc<{ total: number }>('list_catalog', ['Carta 1', null, null, null, 24, 0])
    expect(found.total).toBeGreaterThan(0)
  })

  it('history shows finished lots with the masked winner', async () => {
    const x = await liveLot(db, admin, { buyout: null })
    await db.as(caio)
    await db.rpc('place_bid', [x.lotId, 20, key()])
    await expire(db, x.auctionId)
    await db.rpc('close_due_lots', [])
    await db.as(null)
    const h = await db.rpc<{ items: Array<{ id: string; winner_alias: string }> }>('list_history', [24, 0])
    expect(h.items.find((i) => i.id === x.lotId)?.winner_alias).toBe('Caio N.')
  })
})

describe('participant API', () => {
  it('my_bids, my_wins, my_orders and get_order', async () => {
    await db.as(caio)
    const bids = await db.rpc<unknown[]>('my_bids', [])
    expect(bids.length).toBeGreaterThan(0)
    const wins = await db.rpc<{ wins: Array<{ order_id: string }> }>('my_wins', [])
    expect(wins.wins.length).toBe(1)
    const orders = await db.rpc<Array<{ id: string; total: number; items: unknown[] }>>('my_orders', [])
    expect(orders.length).toBe(1)
    const o = await db.rpc<{ id: string; items: unknown[]; user: { full_name: string } }>('get_order', [orders[0].id])
    expect(o.items.length).toBe(1)
    expect(o.user.full_name).toBe('Caio Nunes')
    await db.as(bia)
    const other = await db.rpc('get_order', [orders[0].id])
    expect(other).toBeNull()
  })

  it('notifications list with unread count, mark as read', async () => {
    await db.as(caio)
    const n = await db.rpc<{ unread: number; items: unknown[] }>('my_notifications', [50])
    expect(n.unread).toBeGreaterThan(0)
    await db.rpc('mark_notifications_read', [null])
    const after = await db.rpc<{ unread: number }>('my_notifications', [50])
    expect(after.unread).toBe(0)
  })

  it('profile update validates name and keeps role', async () => {
    await db.as(bia)
    await expectError(db.rpc('update_my_profile', ['', '', null]), 'NAME_REQUIRED')
    await db.rpc('update_my_profile', ['Bia Rocha Lima', '(41) 98888-7777', null])
    const p = await db.rpc<{ full_name: string; whatsapp: string; role: string }>('get_my_profile', [])
    expect(p).toMatchObject({ full_name: 'Bia Rocha Lima', whatsapp: '41988887777', role: 'participant' })
  })
})

describe('admin API', () => {
  it('creates a draft auction with a combo lot through the API and publishes it', async () => {
    await db.as(admin)
    const starts = new Date(Date.now() + 86_400_000).toISOString()
    const ends = new Date(Date.now() + 2 * 86_400_000).toISOString()
    const aid = await db.rpc<string>('admin_save_auction', [JSON.stringify({ title: 'Quinta especial', starts_at: starts, ends_at: ends })])
    const c1 = await db.rpc<string>('admin_save_card', [JSON.stringify({ title: 'Dragão Azul', collection: 'Base', language: 'JAP', condition: 'NM' })])
    const c2 = await db.rpc<string>('admin_save_card', [JSON.stringify({ title: 'Raposa Lunar', collection: 'Base', language: 'BR', condition: 'SP' })])
    await expectError(db.rpc('admin_save_lot', [JSON.stringify({ auction_id: aid, kind: 'combo', title: 'Combo', starting_price: 50, increment: 5, card_ids: [c1] })]), 'LOT_CARDS_INVALID')
    const lid = await db.rpc<string>('admin_save_lot', [JSON.stringify({ auction_id: aid, kind: 'combo', title: 'Combo da lua', starting_price: 50, increment: 5, buyout_price: 200, card_ids: [c1, c2] })])
    expect(lid).toBeTruthy()
    await db.as(null)
    expect(await db.rpc('get_auction', [aid])).toBeNull() // draft hidden
    await db.as(admin)
    await db.rpc('admin_publish_auction', [aid])
    await db.as(null)
    const up = await db.rpc<Array<{ id: string }>>('list_auctions', ['upcoming', 12, 0])
    expect(up.some((a) => a.id === aid)).toBe(true)
    await db.as(admin)
    await expectError(db.rpc('admin_delete_card', [c1]), 'CARD_IN_USE')
  })

  it('lists participants, bids, orders, ranking and audit', async () => {
    await db.as(admin)
    const ps = await db.rpc<unknown[]>('admin_list_participants', [''])
    expect(ps.length).toBe(3)
    const bids = await db.rpc<unknown[]>('admin_list_bids', [null, 100])
    expect(bids.length).toBeGreaterThan(0)
    const orders = await db.rpc<unknown[]>('admin_list_orders', [null])
    expect(orders.length).toBe(1)
    const r = await db.rpc<{ ranking: Array<{ full_name: string }> }>('admin_lot_ranking', [live.lotId])
    expect(r.ranking[0].full_name).toBe('Bia Rocha Lima')
    const audit = await db.rpc<unknown[]>('admin_audit', [50])
    expect(audit.length).toBeGreaterThan(0)
  })

  it('participants cannot use admin API', async () => {
    await db.as(bia)
    await expectError(db.rpc('admin_list_orders', [null]), 'FORBIDDEN')
    await expectError(db.rpc('admin_save_card', [JSON.stringify({ title: 'x', language: 'BR', condition: 'M' })]), 'FORBIDDEN')
  })
})

describe('function privileges', () => {
  it('visitors cannot call internal helpers or write functions', async () => {
    await db.as(null)
    await db.query('set role anon')
    try {
      await expectError(db.query(`select public._lot_json(l, true) from public.lots l limit 1`), 'permission denied')
      await expectError(db.query(`select public.notify($1, 'x', 'x')`, [caio]), 'permission denied')
      await expectError(db.query(`select public.place_bid($1, 50, gen_random_uuid())`, [live.lotId]), 'permission denied')
      // the public API still works
      const r = await db.query(`select public.list_auctions('live', 12, 0) as r`)
      expect(r.rows.length).toBe(1)
    } finally {
      await db.query('reset role')
    }
  })
  it('participants cannot read other people\'s bids directly (RLS)', async () => {
    await db.as(caio)
    await db.query('set role authenticated')
    try {
      const r = await db.query(`select * from public.bids where user_id <> $1`, [caio])
      expect(r.rows.length).toBe(0)
      const p = await db.query(`select * from public.profiles where id <> $1`, [caio])
      expect(p.rows.length).toBe(0)
    } finally {
      await db.query('reset role')
    }
  })
})
