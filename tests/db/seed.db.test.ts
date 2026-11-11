import { beforeAll, describe, expect, it } from 'vitest'
import { webcrypto } from 'node:crypto'
import { seedDemo } from '../../src/lib/demo/seed'
import { createDb, type Db } from './harness'

let db: Db

beforeAll(async () => {
  db = await createDb()
  await db.exec(`
    alter table auth.users add column demo_password_hash text, add column demo_label text, add column demo_description text;
    create table public.demo_files (path text primary key, data text not null);
  `)
  const sha256 = async (s: string) =>
    [...new Uint8Array(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('')
  await seedDemo({ db, setUser: db.as, sha256 })
}, 120_000)

describe('demo seed (runs entirely through the real SQL functions)', () => {
  it('creates live, upcoming, closed and draft auctions', async () => {
    await db.as(null)
    const live = await db.rpc<unknown[]>('list_auctions', ['live', 12, 0])
    const up = await db.rpc<unknown[]>('list_auctions', ['upcoming', 12, 0])
    const closed = await db.rpc<unknown[]>('list_auctions', ['closed', 12, 0])
    const drafts = await db.one<{ n: number }>(`select count(*)::int n from public.auctions where status = 'draft'`)
    expect(live.length).toBe(1)
    expect(up.length).toBe(1)
    expect(closed.length).toBe(1)
    expect(drafts.n).toBe(1)
  })

  it('produces orders in every payment state needed for testing', async () => {
    const r = await db.query<{ status: string; overdue: boolean }>(
      `select status, due_at < now() as overdue from public.orders order by status`)
    const statuses = r.rows.map((x) => x.status)
    expect(statuses).toContain('paid')
    expect(statuses).toContain('awaiting_payment')
    expect(r.rows.some((x) => x.overdue && x.status === 'awaiting_payment')).toBe(true)
    const stored = await db.one<{ n: number }>(`select count(*)::int n from public.stored_items`)
    expect(stored.n).toBeGreaterThan(0)
  })

  it('has a combo with 8 cards and tie bids in the live auction', async () => {
    const combo = await db.one<{ n: number }>(
      `select max(c)::int n from (select count(*) c from public.lot_cards group by lot_id) x`)
    expect(combo.n).toBe(8)
    const ties = await db.one<{ n: number }>(
      `select count(*)::int n from (select lot_id, amount from public.bids group by lot_id, amount having count(*) > 1) x`)
    expect(ties.n).toBeGreaterThan(0)
  })
})
