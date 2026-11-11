import { beforeAll, describe, expect, it } from 'vitest'
import { createDb, expectError, type Db } from './harness'

let db: Db
let admin: string
let ana: string
let beto: string
let pika: number
let charizard: number
let mew: number

const pid = async (name: string) => (await db.one<{ id: number }>(`select id from public.pokemon where name = $1`, [name])).id

async function card(title: string, pokemon: number[]) {
  await db.as(admin)
  const id = await db.rpc<string>('admin_save_card', [JSON.stringify({ title, language: 'BR', condition: 'NM' })])
  await db.rpc('admin_set_card_pokemon', [id, pokemon])
  return id
}
async function draftAuction(title = 'Leilão favoritos') {
  await db.as(admin)
  const starts = new Date(Date.now() - 3600_000).toISOString()
  const ends = new Date(Date.now() + 23 * 3600_000).toISOString()
  return db.rpc<string>('admin_save_auction', [JSON.stringify({ title, starts_at: starts, ends_at: ends })])
}
async function lot(auction: string, cards: string[], title = 'Lote') {
  await db.as(admin)
  return db.rpc<string>('admin_save_lot', [JSON.stringify({ auction_id: auction, kind: cards.length > 1 ? 'combo' : 'single', title, starting_price: 10, increment: 1, card_ids: cards })])
}
const favNotes = async (user: string) =>
  (await db.query<{ link: string; body: string; image_path: string | null }>(`select link, body, image_path from public.notifications where user_id = $1 and kind = 'favorite' order by id`, [user])).rows

beforeAll(async () => {
  db = await createDb()
  admin = await db.createUser('Admin Fav', 'super_admin')
  ana = await db.createUser('Ana Fã')
  beto = await db.createUser('Beto Fã')
  pika = await pid('Pikachu')
  charizard = await pid('Charizard')
  mew = await pid('Mew')
}, 60_000)

describe('Pokémon catalogue', () => {
  it('ships Pokédex #1–#251 plus popular later species, searchable by name or number', async () => {
    const n = await db.one<{ n: number }>(`select count(*)::int n from public.pokemon`)
    expect(n.n).toBeGreaterThan(280)
    await db.as(null)
    const r = await db.rpc<{ name: string; dex: number }[]>('search_pokemon', ['pika', 10])
    expect(r[0]).toMatchObject({ name: 'Pikachu', dex: 25 })
    const byDex = await db.rpc<{ name: string }[]>('search_pokemon', ['151', 5])
    expect(byDex[0].name).toBe('Mew')
  })
  it('only admins can add Pokémon or tag cards', async () => {
    await db.as(ana)
    await expectError(db.rpc('admin_add_pokemon', ['Fakemon', null]), 'FORBIDDEN')
    await db.as(admin)
    const id = await db.rpc<number>('admin_add_pokemon', ['Walking Wake', 1009])
    const again = await db.rpc<number>('admin_add_pokemon', ['walking wake', null])
    expect(again).toBe(id)
  })
})

describe('favorites', () => {
  it('persists, lists and removes favorites per user (isolated)', async () => {
    await db.as(ana)
    await db.rpc('add_favorite_pokemon', [pika])
    await db.rpc('add_favorite_pokemon', [pika]) // idempotent
    await db.rpc('add_favorite_pokemon', [mew])
    let mine = await db.rpc<{ name: string }[]>('my_favorites', [])
    expect(mine.map((x) => x.name).sort()).toEqual(['Mew', 'Pikachu'])
    await db.rpc('remove_favorite_pokemon', [mew])
    mine = await db.rpc<{ name: string }[]>('my_favorites', [])
    expect(mine.map((x) => x.name)).toEqual(['Pikachu'])

    await db.as(beto)
    expect(await db.rpc<unknown[]>('my_favorites', [])).toEqual([])
    await db.rpc('add_favorite_pokemon', [charizard])
    await db.query('set role authenticated')
    try {
      const leak = await db.query(`select * from public.favorite_pokemon where user_id <> $1`, [beto])
      expect(leak.rows.length).toBe(0)
    } finally {
      await db.query('reset role')
    }
  })

  it('publishing a single-card lot notifies only matching fans, with link and image', async () => {
    const c = await card('Pikachu Promo', [pika])
    const a = await draftAuction()
    const l = await lot(a, [c], 'Pikachu Promo')
    expect(await favNotes(ana)).toHaveLength(0) // drafts never notify
    await db.as(admin)
    await db.rpc('admin_publish_auction', [a])
    const notes = await favNotes(ana)
    expect(notes).toHaveLength(1)
    expect(notes[0].link).toBe(`/lote/${l}`)
    expect(notes[0].body).toContain('Pikachu')
    expect(await favNotes(beto)).toHaveLength(0)
  })

  it('combos notify when any card matches, grouped into one alert per lot', async () => {
    await db.as(ana)
    await db.rpc('add_favorite_pokemon', [charizard])
    const c1 = await card('Pikachu Full Art', [pika])
    const c2 = await card('Charizard Holo', [charizard])
    const c3 = await card('Sem Pokémon', [])
    const a = await draftAuction('Combos')
    const l = await lot(a, [c1, c2, c3], 'Combo Kanto')
    await db.as(admin)
    await db.rpc('admin_publish_auction', [a])
    const forLot = (await favNotes(ana)).filter((n) => n.link === `/lote/${l}`)
    expect(forLot).toHaveLength(1)
    expect(forLot[0].body).toContain('Charizard')
    expect(forLot[0].body).toContain('Pikachu')
    expect((await favNotes(beto)).filter((n) => n.link === `/lote/${l}`)).toHaveLength(1)
  })

  it('never duplicates: unpublish/republish and re-saving the lot do not resend', async () => {
    const c = await card('Pikachu V', [pika])
    const a = await draftAuction('Repetido')
    const l = await lot(a, [c], 'Pikachu V')
    await db.as(admin)
    await db.rpc('admin_publish_auction', [a])
    await db.rpc('admin_unpublish_auction', [a])
    await db.rpc('admin_publish_auction', [a])
    await db.rpc('admin_save_lot', [JSON.stringify({ id: l, auction_id: a, kind: 'single', title: 'Pikachu V', starting_price: 10, increment: 1, card_ids: [c] })])
    expect((await favNotes(ana)).filter((n) => n.link === `/lote/${l}`)).toHaveLength(1)
  })

  it('a lot added to an already published auction also notifies', async () => {
    const a = await draftAuction('Ao vivo')
    const c0 = await card('Outra carta', [])
    await lot(a, [c0], 'Abertura')
    await db.as(admin)
    await db.rpc('admin_publish_auction', [a])
    const c = await card('Pikachu tardio', [pika])
    const l = await lot(a, [c], 'Pikachu tardio')
    expect((await favNotes(ana)).filter((n) => n.link === `/lote/${l}`)).toHaveLength(1)
  })

  it('respects the "favorites" notification preference', async () => {
    await db.as(beto)
    await db.rpc('update_my_profile', ['Beto Fã', '', JSON.stringify({ favorites: false })])
    const c = await card('Charizard EX', [charizard])
    const a = await draftAuction('Preferência')
    const l = await lot(a, [c], 'Charizard EX')
    await db.as(admin)
    await db.rpc('admin_publish_auction', [a])
    expect((await favNotes(beto)).filter((n) => n.link === `/lote/${l}`)).toHaveLength(0)
  })

  it('cards expose their Pokémon and the featured strip only lists single-card lots', async () => {
    await db.as(null)
    const featured = await db.rpc<{ kind: string; cards: { pokemon: { name: string }[] }[] }[]>('list_featured_cards', [30])
    expect(featured.length).toBeGreaterThan(0)
    expect(featured.every((l) => l.kind === 'single')).toBe(true)
    expect(featured.some((l) => l.cards[0].pokemon.some((p) => p.name === 'Pikachu'))).toBe(true)
  })

  it('visitors cannot call favorite functions', async () => {
    await db.as(null)
    await expectError(db.rpc('add_favorite_pokemon', [pika]), 'AUTH_REQUIRED')
  })
})
