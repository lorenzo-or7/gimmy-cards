/**
 * DEMO data. Everything is created through the real SQL functions
 * (publish, place_bid, buy_now, close_due_lots, payments), so the demo
 * state is exactly what production would produce.
 */
import type { PGliteInterface } from '@electric-sql/pglite'
import { nextAuctionSlots } from '../domain'
import { demoCardBack, demoCardFront } from './art'

interface Ctx {
  db: PGliteInterface
  setUser(id: string | null): Promise<void>
  sha256(s: string): Promise<string>
}

type CardSeed = [title: string, collection: string, lang: 'BR' | 'ING' | 'JAP' | 'CNH', cond: 'M' | 'NM' | 'SP' | 'MP' | 'HP' | 'DM', pokemon?: string]

// Pokémon tags are demo-only associations for the fictional illustrations
const CARDS: CardSeed[] = [
  ['Dragão do Lago Sereno', 'Marés Antigas', 'JAP', 'NM', 'Dragonite'],
  ['Raposa de Nove Luas', 'Noites de Jade', 'JAP', 'M', 'Ninetales'],
  ['Guardiã do Farol', 'Costa Esquecida', 'BR', 'NM'],
  ['Tigre de Brasa', 'Forja Rubra', 'ING', 'SP', 'Arcanine'],
  ['Coruja Astral', 'Céu Partido', 'ING', 'NM', 'Noctowl'],
  ['Serpente de Cristal', 'Cavernas Vivas', 'CNH', 'M', 'Onix'],
  ['Cervo da Aurora', 'Bosque Alto', 'BR', 'SP'],
  ['Golem de Musgo', 'Bosque Alto', 'BR', 'MP'],
  ['Fênix Menor', 'Forja Rubra', 'JAP', 'NM', 'Moltres'],
  ['Lontra Mareira', 'Marés Antigas', 'BR', 'NM', 'Totodile'],
  ['Arauto da Tempestade', 'Céu Partido', 'ING', 'HP', 'Zapdos'],
  ['Kirin Dourado', 'Noites de Jade', 'CNH', 'NM', 'Girafarig'],
  ['Medusa Lunar', 'Marés Antigas', 'ING', 'SP'],
  ['Lobo de Cinzas', 'Forja Rubra', 'BR', 'NM', 'Houndoom'],
  ['Baleia Celeste', 'Céu Partido', 'JAP', 'M', 'Lapras'],
  ['Sapo Oráculo', 'Cavernas Vivas', 'BR', 'DM', 'Politoed'],
  ['Grifo de Bronze', 'Costa Esquecida', 'ING', 'NM', 'Pidgeot'],
  ['Carpa Imperial', 'Noites de Jade', 'JAP', 'SP', 'Magikarp'],
  ['Morcego Prisma', 'Cavernas Vivas', 'CNH', 'NM'],
  ['Urso Polar Rúnico', 'Bosque Alto', 'ING', 'MP'],
  ['Cavalo-marinho Real', 'Marés Antigas', 'BR', 'M'],
  ['Pavão de Vidro', 'Costa Esquecida', 'CNH', 'NM'],
  ['Escaravelho Solar', 'Forja Rubra', 'JAP', 'NM'],
  ['Gato Sombra', 'Noites de Jade', 'BR', 'SP', 'Umbreon'],
  ['Tartaruga Ancestral', 'Marés Antigas', 'JAP', 'NM', 'Blastoise'],
  ['Falcão Relâmpago', 'Céu Partido', 'BR', 'NM', 'Jolteon'],
  ['Polvo Arcano', 'Cavernas Vivas', 'ING', 'SP'],
  ['Lince Boreal', 'Bosque Alto', 'JAP', 'M', 'Glaceon'],
]

export async function seedDemo({ db, setUser, sha256 }: Ctx) {
  const q = async <T,>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows
  const call = async <T,>(fn: string, ...args: unknown[]) => {
    const ph = args.map((_, i) => `$${i + 1}`).join(', ')
    const v = args.map((a) => (a !== null && typeof a === 'object' && !Array.isArray(a) ? JSON.stringify(a) : a))
    return (await q<{ r: T }>(`select public.${fn}(${ph}) as r`, v))[0]?.r as T
  }

  // ---- people ---------------------------------------------------------
  const mkUser = async (name: string, email: string, phone: string, label?: string, description?: string, password?: string) => {
    const [u] = await q<{ id: string }>(
      `insert into auth.users (email, raw_user_meta_data, demo_label, demo_description, demo_password_hash) values ($1, $2, $3, $4, $5) returning id`,
      [email, JSON.stringify({ full_name: name, whatsapp: phone }), label ?? null, description ?? null, password ? await sha256(password) : null])
    return u.id
  }
  const root = await mkUser('Equipe Gimmy', 'admin@demo.gimmy', '41999990001', 'Administrador principal', 'Acesso completo, inclusive permissões')
  const ops = await mkUser('Nina Operações', 'operacao@demo.gimmy', '41999990002', 'Administrador comum', 'Operação do dia a dia, sem gerenciar admins')
  const lia = await mkUser('Lia Moraes', 'lia@demo.gimmy', '41988880001', 'Participante · Lia', 'Tem lances ativos e um pedido a pagar')
  const rafa = await mkUser('Rafael Tanaka', 'rafael@demo.gimmy', '41988880002', 'Participante · Rafael', 'Tem cartas pagas e armazenadas')
  const bruna = await mkUser('Bruna Kowalski', 'bruna@demo.gimmy', '41988880003', 'Participante · Bruna', 'Pedido vencido, para testar inadimplência')
  const diego = await mkUser('Diego Santos', 'diego@demo.gimmy', '41988880004')
  const yuki = await mkUser('Yuki Hara', 'yuki@demo.gimmy', '41988880005')
  const caua = await mkUser('Cauã Ribeiro', 'caua@demo.gimmy', '41988880006')
  await setUser(null)
  await q(`update public.profiles set role = 'super_admin' where id = $1`, [root])
  await q(`update public.profiles set role = 'admin' where id = $1`, [ops])

  // ---- cards ------------------------------------------------------------
  await setUser(root)
  const back = demoCardBack()
  const cardIds: string[] = []
  const titleOf = new Map<string, string>()
  // Lia loves Dragonite and Ninetales: she gets highlighted alerts when they are published
  for (const name of ['Dragonite', 'Ninetales', 'Umbreon']) {
    await setUser(lia)
    const [pk] = await q<{ id: number }>('select id from public.pokemon where name = $1', [name])
    await call('add_favorite_pokemon', pk.id)
  }
  await setUser(root)
  for (const [title, collection, language, condition, pokemonName] of CARDS) {
    const cid = await call<string>('admin_save_card', {
        title, collection, language, condition,
        front_path: demoCardFront(title, collection, language), back_path: back,
        notes: 'Carta de demonstração.',
    })
    cardIds.push(cid)
    if (pokemonName) {
      const [pk] = await q<{ id: number }>('select id from public.pokemon where name = $1', [pokemonName])
      if (pk) await call('admin_set_card_pokemon', cid, [pk.id])
    }
    titleOf.set(cid, title)
  }
  let ci = 0
  const take = (n: number) => Array.from({ length: n }, () => cardIds[ci++ % cardIds.length])

  type LotSeed = { title: string; kind?: 'single' | 'combo'; cards: number; start: number; inc: number; buyout?: number | null; description?: string }
  const createAuction = async (title: string, description: string, starts: Date, ends: Date, lots: LotSeed[]) => {
    await setUser(root)
    const id = await call<string>('admin_save_auction', { title, description, starts_at: starts.toISOString(), ends_at: ends.toISOString() })
    const lotIds: string[] = []
    for (const l of lots) {
      const ids = take(l.cards)
      lotIds.push(
        await call<string>('admin_save_lot', {
          auction_id: id, kind: l.kind ?? 'single', title: (l.kind ?? 'single') === 'single' ? titleOf.get(ids[0])! : l.title, description: l.description ?? '',
          starting_price: l.start, increment: l.inc, buyout_price: l.buyout ?? null, card_ids: ids,
        }),
      )
    }
    return { id, lotIds }
  }
  const bid = async (user: string, lot: string, amount: number) => {
    await setUser(user)
    await call('place_bid', lot, amount, crypto.randomUUID())
  }
  const internal = async (on: boolean) => q(`select set_config('gimmy.internal', $1, false)`, [on ? 'on' : ''])
  const now = new Date()

  // ---- 1) closed auction from last week (orders, payments, default) ------
  const past = await createAuction('Leilão de Sexta · semana passada', 'Encerrado. Usado para testar pagamentos e inadimplência.',
    new Date(now.getTime() - 3600_000), new Date(now.getTime() + 23 * 3600_000), [
      { title: 'Dragão do Lago Sereno', cards: 1, start: 40, inc: 5, buyout: 220 },
      { title: 'Raposa de Nove Luas', cards: 1, start: 60, inc: 5, buyout: 300 },
      { title: 'Guardiã do Farol', cards: 1, start: 20, inc: 2, buyout: null },
      { title: 'Combo Forja Rubra', kind: 'combo', cards: 3, start: 50, inc: 5, buyout: 180, description: 'Três cartas da coleção Forja Rubra.' },
      { title: 'Coruja Astral', cards: 1, start: 15, inc: 1, buyout: null },
    ])
  await call('admin_publish_auction', past.id)
  const [p1, p2, p3, p4, p5] = past.lotIds
  await bid(rafa, p1, 40); await bid(lia, p1, 45); await bid(rafa, p1, 60); await bid(diego, p1, 60)
  await bid(bruna, p2, 60); await bid(yuki, p2, 70); await bid(bruna, p2, 85); await bid(lia, p2, 85); await bid(caua, p2, 80)
  await bid(lia, p3, 20); await bid(rafa, p3, 24)
  await setUser(rafa); await call('buy_now', p4, crypto.randomUUID())
  await bid(lia, p5, 15); await bid(caua, p5, 15)
  // move it to last Friday 19:00 -> Saturday 19:00 window
  {
    // latest official slot that ended at least two days ago
    const slots = nextAuctionSlots(new Date(now.getTime() - 16 * 86_400_000), 10).filter((s) => s.ends.getTime() < now.getTime() - 2 * 86_400_000)
    const slot = slots[slots.length - 1]
    const start = slot.starts
    const end = slot.ends
    await setUser(null); await internal(true)
    await q(`update public.lots set ends_at = $2 where auction_id = $1 and status = 'open'`, [past.id, end.toISOString()])
    await q(`update public.lots set ends_at = $2, closed_at = $3 where auction_id = $1 and status <> 'open'`, [past.id, end.toISOString(), new Date(start.getTime() + 5 * 3600_000).toISOString()])
    await q(`update public.auctions set starts_at = $2, ends_at = $3, published_at = $2 where id = $1`, [past.id, start.toISOString(), end.toISOString()])
    await q(`update public.bids set created_at = $2::timestamptz + (id % 50) * interval '7 minutes' where lot_id in (select id from public.lots where auction_id = $1)`, [past.id, start.toISOString()])
    await internal(false)
    await q(`select public.close_due_lots()`)
  }
  // Rafael paid (proof + confirmation) -> stored cards
  const orders = await q<{ id: string; user_id: string }>(`select id, user_id from public.orders where auction_id = $1`, [past.id])
  const orderOf = (u: string) => orders.find((o) => o.user_id === u)?.id
  const rafaOrder = orderOf(rafa)
  if (rafaOrder) {
    await setUser(rafa)
    const path = `${rafa}/${rafaOrder}/${crypto.randomUUID()}.svg`
    await q(`insert into public.demo_files (path, data) values ($1, $2)`, [path, demoCardBack()])
    await call('submit_payment_proof', rafaOrder, path)
    await setUser(ops)
    await call('admin_review_payment', rafaOrder, true, 'PIX conferido (demo).')
  }
  // Lia: still within an extended deadline
  const liaOrder = orderOf(lia)
  if (liaOrder) {
    await setUser(root)
    await call('admin_set_order_due', liaOrder, new Date(now.getTime() + 4 * 86_400_000).toISOString())
  }
  // Bruna: overdue -> admin can test the default flow
  const brunaOrder = orderOf(bruna)
  if (brunaOrder) {
    await setUser(null)
    await q(`update public.orders set due_at = now() - interval '2 hours' where id = $1`, [brunaOrder])
  }

  // ---- 2) live auction (official slot when possible) --------------------
  const slotsBack = nextAuctionSlots(new Date(now.getTime() - 24 * 3600_000), 3)
  const liveSlot = slotsBack.find((s) => s.starts <= now && s.ends > now)
  const liveStart = liveSlot?.starts ?? new Date(now.getTime() - 2 * 3600_000)
  const liveEnd = liveSlot?.ends ?? new Date(now.getTime() + 22 * 3600_000)
  const live = await createAuction(
    liveSlot ? `Leilão de ${new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' }).format(liveStart).replace(/-feira/, '').replace(/^./, (c) => c.toUpperCase())}` : 'Leilão da semana',
    'Lotes individuais e combos. Encerramento às 19h (Brasília), sem prorrogação.',
    new Date(now.getTime() - 3600_000), liveEnd, [
      { title: 'Serpente de Cristal', cards: 1, start: 30, inc: 5, buyout: 150 },
      { title: 'Cervo da Aurora', cards: 1, start: 20, inc: 2, buyout: 90 },
      { title: 'Combo Bosque Alto', kind: 'combo', cards: 2, start: 25, inc: 5, buyout: null, description: 'Golem de Musgo + Fênix Menor.' },
      { title: 'Lontra Mareira', cards: 1, start: 12, inc: 1, buyout: 45 },
      { title: 'Arauto da Tempestade', cards: 1, start: 10, inc: 1, buyout: null },
      { title: 'Combo Noites de Jade — 8 cartas', kind: 'combo', cards: 8, start: 120, inc: 10, buyout: 480, description: 'Coleção quase completa. Fotos de frente e verso de cada carta.' },
      { title: 'Kirin Dourado', cards: 1, start: 80, inc: 10, buyout: null },
    ])
  await setUser(root)
  await call('admin_publish_auction', live.id)
  {
    await setUser(null); await internal(true)
    await q(`update public.auctions set starts_at = $2 where id = $1`, [live.id, liveStart.toISOString()])
    await internal(false)
  }
  const [l1, l2, l3, l4, l5, l6] = live.lotIds
  await bid(diego, l1, 30); await bid(lia, l1, 40); await bid(yuki, l1, 40); await bid(caua, l1, 35)
  await bid(rafa, l2, 20); await bid(lia, l2, 26)
  await bid(yuki, l3, 25); await bid(diego, l3, 30)
  await bid(caua, l4, 12)
  await bid(bruna, l6, 120); await bid(lia, l6, 150); await bid(diego, l6, 160)
  void l5

  // ---- 3) upcoming auction (next official slot) ---------------------------
  const next = nextAuctionSlots(new Date(Math.max(now.getTime(), liveEnd.getTime() - 1)), 1)[0]
  const up = await createAuction('Leilão de Quinta', 'Abre às 19h. Prepare sua lista!', next.starts, next.ends, [
    { title: 'Baleia Celeste', cards: 1, start: 50, inc: 5, buyout: 250 },
    { title: 'Combo Cavernas Vivas', kind: 'combo', cards: 3, start: 30, inc: 5, buyout: null },
    { title: 'Grifo de Bronze', cards: 1, start: 25, inc: 5, buyout: 110 },
    { title: 'Carpa Imperial', cards: 1, start: 18, inc: 2, buyout: null },
  ])
  await setUser(root)
  await call('admin_publish_auction', up.id)

  // ---- 4) a draft, to show the admin flow -----------------------------
  await createAuction('Rascunho · Especial de fim de mês', 'Ainda não publicado.', new Date(next.starts.getTime() + 7 * 86_400_000), new Date(next.ends.getTime() + 7 * 86_400_000), [
    { title: 'Morcego Prisma', cards: 1, start: 15, inc: 1, buyout: null },
  ])

  await setUser(null)
}
