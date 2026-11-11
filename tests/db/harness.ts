/**
 * Test harness: runs the real SQL migrations inside PGlite (PostgreSQL compiled
 * to WASM). Supabase-only pieces (auth schema, roles) are stubbed minimally;
 * the storage/realtime/cron migration is not applied here.
 */
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const MIGRATIONS = [
  '20261110000100_core_schema.sql',
  '20261110000200_functions.sql',
  '20261110000300_rls.sql',
  '20261110000350_api.sql',
  '20261111000100_pokemon_favorites.sql',
  '20261111000200_payment_deadline_18h.sql',
]

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique not null,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  -- mimic Supabase defaults: API roles get table privileges, RLS decides rows
  grant usage on schema public, auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`

export type Db = PGlite & {
  as(userId: string | null): Promise<void>
  createUser(name: string, role?: 'participant' | 'admin' | 'super_admin'): Promise<string>
  one<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T>
  rpc<T = unknown>(fn: string, args: unknown[]): Promise<T>
}

export async function createDb(): Promise<Db> {
  const pg = new PGlite({ extensions: { pgcrypto } })
  await pg.exec('create extension if not exists pgcrypto;')
  await pg.exec(SUPABASE_STUB)
  for (const file of MIGRATIONS) {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations', file), 'utf8')
    await pg.exec(sql)
  }
  const db = pg as Db
  db.as = async (userId) => {
    await pg.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ''])
  }
  db.createUser = async (name, role = 'participant') => {
    const email = `${name.toLowerCase().replace(/\s+/g, '.')}.${Math.random().toString(36).slice(2, 7)}@test.local`
    const res = await pg.query<{ id: string }>(
      `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
      [email, JSON.stringify({ full_name: name, whatsapp: '+55 41 99999-0000', role: 'super_admin' })],
    )
    const id = res.rows[0].id
    if (role !== 'participant') {
      await db.as(null)
      await pg.query(`update public.profiles set role = $1 where id = $2`, [role, id])
    }
    return id
  }
  db.one = async (sql, params = []) => {
    const res = await pg.query(sql, params)
    return res.rows[0] as never
  }
  db.rpc = async (fn, args) => {
    const placeholders = args.map((_, i) => `$${i + 1}`).join(', ')
    const res = await pg.query<{ r: unknown }>(`select public.${fn}(${placeholders}) as r`, args)
    return res.rows[0]?.r as never
  }
  return db
}

/** Creates a published auction that is live right now, with one lot. */
export async function liveLot(
  db: Db,
  adminId: string,
  opts: { start?: number; inc?: number; buyout?: number | null; kind?: 'single' | 'combo'; cards?: number } = {},
) {
  await db.as(adminId)
  const auction = await db.one<{ id: string }>(
    `insert into public.auctions (title, starts_at, ends_at) values ('Leilão de teste', now() - interval '1 hour', now() + interval '23 hours') returning id`,
  )
  const lot = await db.one<{ id: string }>(
    `insert into public.lots (auction_id, kind, title, starting_price, increment, buyout_price) values ($1, $2, 'Lote teste', $3, $4, $5) returning id`,
    [auction.id, opts.kind ?? 'single', opts.start ?? 20, opts.inc ?? 5, opts.buyout === undefined ? 100 : opts.buyout],
  )
  const n = opts.cards ?? (opts.kind === 'combo' ? 3 : 1)
  for (let i = 0; i < n; i++) {
    const card = await db.one<{ id: string }>(
      `insert into public.cards (title, collection, language, condition) values ($1, 'Coleção', 'BR', 'NM') returning id`,
      [`Carta ${i + 1}`],
    )
    await db.query(`insert into public.lot_cards (lot_id, card_id, position) values ($1, $2, $3)`, [lot.id, card.id, i])
  }
  await db.rpc('admin_publish_auction', [auction.id])
  return { auctionId: auction.id, lotId: lot.id }
}

/** Moves a lot (and its auction) into the past so it can be closed. */
export async function expire(db: Db, auctionId: string) {
  await db.as(null)
  await db.query(`select set_config('gimmy.internal', 'on', false)`)
  const end = new Date(Date.now() - 1000).toISOString()
  const start = new Date(Date.now() - 25 * 3600_000).toISOString()
  // lots first (moving earlier is always valid), then the auction
  await db.query(`update public.lots set ends_at = $2 where auction_id = $1`, [auctionId, end])
  await db.query(`update public.auctions set starts_at = $2, ends_at = $3 where id = $1`, [auctionId, start, end])
  await db.query(`select set_config('gimmy.internal', '', false)`)
}

export const key = () => crypto.randomUUID()

export async function expectError(p: Promise<unknown>, code: string) {
  try {
    await p
  } catch (e) {
    const msg = (e as Error).message
    if (!msg.includes(code)) throw new Error(`Expected ${code}, got: ${msg}`)
    return
  }
  throw new Error(`Expected error ${code}, but the call succeeded`)
}
