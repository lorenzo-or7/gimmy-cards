import { describe, expect, it } from 'vitest'
import { buildPaymentMessage, checkBid, leadingMinimum, nextAuctionSlots, paymentDueFor, rankStandings } from './domain'
import type { Order } from './types'

const lot = { starting_price: 20, increment: 5, buyout_price: 100, current_price: null as number | null, my_amount: null as number | null }

describe('bid pre-validation (mirrors place_bid)', () => {
  it('first bid must reach the minimum', () => {
    expect(checkBid(lot, 19.99)).toEqual({ ok: false, code: 'BELOW_MINIMUM' })
    expect(checkBid(lot, 20)).toEqual({ ok: true, kind: 'opening' })
    expect(leadingMinimum(lot)).toBe(20)
  })
  it('going above the top bid respects the increment', () => {
    const l = { ...lot, current_price: 40 }
    expect(leadingMinimum(l)).toBe(45)
    expect(checkBid(l, 44)).toEqual({ ok: false, code: 'BELOW_INCREMENT' })
    expect(checkBid(l, 45)).toEqual({ ok: true, kind: 'leading' })
  })
  it('repeating the top value is a tie; lower values are secondary', () => {
    const l = { ...lot, current_price: 40 }
    expect(checkBid(l, 40)).toEqual({ ok: true, kind: 'tie' })
    expect(checkBid(l, 30)).toEqual({ ok: true, kind: 'secondary' })
  })
  it('never lets a normal bid reach the buyout ceiling', () => {
    expect(checkBid({ ...lot, current_price: 90 }, 100)).toEqual({ ok: false, code: 'USE_BUYOUT' })
  })
  it('a participant cannot bid at or below their own best', () => {
    expect(checkBid({ ...lot, current_price: 40, my_amount: 40 }, 40)).toEqual({ ok: false, code: 'NOT_ABOVE_OWN_BID' })
  })
  it('rejects invalid amounts', () => {
    expect(checkBid(lot, Number.NaN)).toEqual({ ok: false, code: 'INVALID_AMOUNT' })
    expect(checkBid(lot, 20.001)).toEqual({ ok: false, code: 'INVALID_AMOUNT' })
  })
})

describe('ranking order', () => {
  it('official example: João 100 (first), Maria 100, Pedro 95', () => {
    const r = rankStandings([
      { key: 'pedro', amount: 95, bid_id: 1 },
      { key: 'joao', amount: 100, bid_id: 2 },
      { key: 'maria', amount: 100, bid_id: 3 },
    ])
    expect(r.map((x) => x.key)).toEqual(['joao', 'maria', 'pedro'])
  })
  it('uses each participant’s best bid', () => {
    const r = rankStandings([
      { key: 'a', amount: 50, bid_id: 1 },
      { key: 'b', amount: 60, bid_id: 2 },
      { key: 'a', amount: 70, bid_id: 3 },
    ])
    expect(r.map((x) => [x.key, x.amount])).toEqual([['a', 70], ['b', 60]])
  })
})

describe('calendar (America/Sao_Paulo)', () => {
  it('payment is due the Monday after closing at 18:00', () => {
    // Wednesday 11/11/2026 19:00 BRT
    expect(paymentDueFor(new Date('2026-11-11T22:00:00Z')).toISOString()).toBe('2026-11-16T21:00:00.000Z')
    // Friday 13/11/2026 19:00 BRT -> same Monday
    expect(paymentDueFor(new Date('2026-11-13T22:00:00Z')).toISOString()).toBe('2026-11-16T21:00:00.000Z')
  })
  it('official slots are Tuesday and Thursday 19:00, lasting 24h', () => {
    const slots = nextAuctionSlots(new Date('2026-11-10T12:00:00Z'), 3) // Tuesday morning BRT
    expect(slots.map((s) => s.starts.toISOString())).toEqual(['2026-11-10T22:00:00.000Z', '2026-11-12T22:00:00.000Z', '2026-11-17T22:00:00.000Z'])
    expect(slots[0].ends.getTime() - slots[0].starts.getTime()).toBe(24 * 3600_000)
  })
  it('skips a slot that already started', () => {
    const slots = nextAuctionSlots(new Date('2026-11-10T23:00:00Z'), 1)
    expect(slots[0].starts.toISOString()).toBe('2026-11-12T22:00:00.000Z')
  })
})

describe('payment summary message', () => {
  const order = {
    id: 'o', code: 'AB12CD34', auction_id: 'a', auction_title: 'Leilão de Terça', source: 'auction', status: 'awaiting_payment',
    total: 130, due_at: '2026-11-16T21:00:00.000Z', paid_at: null, created_at: '', admin_note: '', overdue: false,
    user: { id: 'u', full_name: 'Maria Souza', whatsapp: '41999990000' }, proofs: [],
    items: [
      { id: 'i1', amount: 100, status: 'active', lot: { kind: 'single', title: 'Dragão', card_count: 1, cards: [{ title: 'Dragão', condition: 'NM', language: 'JAP' }] } },
      { id: 'i2', amount: 30, status: 'active', lot: { kind: 'combo', title: 'Combo Mar', card_count: 2, cards: [{ title: 'A', condition: 'SP', language: 'BR' }, { title: 'B', condition: 'M', language: 'ING' }] } },
      { id: 'i3', amount: 999, status: 'void', lot: { kind: 'single', title: 'Anulado', card_count: 1, cards: [] } },
    ],
  } as unknown as Order
  const msg = buildPaymentMessage(order, { pix_key: 'lojagimmycards@gmail.com', card_link: 'https://mpago.la/2QfsRQH' })
  it('greets, lists items with condition/language and totals', () => {
    expect(msg).toMatch(/^Oi, Maria!/)
    expect(msg).toContain('Dragão — Near Mint · JAP')
    expect(msg).toContain('Combo Mar (combo, 2 cartas)')
    expect(msg).toContain('A — SP · BR')
    expect(msg).toMatch(/Total: R\$\s?130,00/)
    expect(msg).not.toContain('Anulado')
  })
  it('includes deadline, PIX, card link and thanks', () => {
    expect(msg).toContain('segunda-feira')
    expect(msg).toContain('lojagimmycards@gmail.com')
    expect(msg).toContain('https://mpago.la/2QfsRQH')
    expect(msg).toContain('Obrigado por participar da Gimmy Cards')
  })
})
