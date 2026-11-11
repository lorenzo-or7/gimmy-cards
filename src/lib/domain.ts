/**
 * Client-side mirrors of the official rules. They only power hints and
 * pre-validation in the UI — the database functions are authoritative.
 */
import { conditionLabel, dateLong, languageMeta, money } from './format'
import type { Lot, Order, Settings } from './types'

const round2 = (n: number) => Math.round(n * 100) / 100

export interface BidContext {
  starting_price: number
  increment: number
  buyout_price: number | null
  current_price: number | null
  my_amount?: number | null
}

/** Smallest amount that takes the lead (or opens the lot). */
export function leadingMinimum(l: BidContext) {
  if (l.current_price === null || l.current_price === undefined) return round2(Number(l.starting_price))
  return round2(Number(l.current_price) + Number(l.increment))
}

export type BidCheck =
  | { ok: true; kind: 'opening' | 'leading' | 'tie' | 'secondary' }
  | { ok: false; code: string }

export function checkBid(l: BidContext, amount: number): BidCheck {
  if (!Number.isFinite(amount) || amount <= 0 || round2(amount) !== amount) return { ok: false, code: 'INVALID_AMOUNT' }
  if (l.buyout_price !== null && amount >= Number(l.buyout_price)) return { ok: false, code: 'USE_BUYOUT' }
  if (amount < Number(l.starting_price)) return { ok: false, code: 'BELOW_MINIMUM' }
  if (l.my_amount !== null && l.my_amount !== undefined && amount <= Number(l.my_amount)) return { ok: false, code: 'NOT_ABOVE_OWN_BID' }
  const max = l.current_price === null || l.current_price === undefined ? null : Number(l.current_price)
  if (max === null) return { ok: true, kind: 'opening' }
  if (amount > max) {
    if (amount < round2(max + Number(l.increment))) return { ok: false, code: 'BELOW_INCREMENT' }
    return { ok: true, kind: 'leading' }
  }
  if (amount === max) return { ok: true, kind: 'tie' }
  return { ok: true, kind: 'secondary' }
}

/** Ranking used for display: best bid per person, amount desc, registration order asc. */
export function rankStandings<T extends { amount: number; bid_id: number; key: string }>(bids: T[]) {
  const best = new Map<string, T>()
  for (const b of bids) {
    const cur = best.get(b.key)
    if (!cur || b.amount > cur.amount || (b.amount === cur.amount && b.bid_id < cur.bid_id)) best.set(b.key, b)
  }
  return [...best.values()].sort((a, b) => b.amount - a.amount || a.bid_id - b.bid_id)
}

// ---------------------------------------------------------------------
// Calendar (America/Sao_Paulo is fixed UTC-3 since 2019)
// ---------------------------------------------------------------------
const SP_OFFSET_MS = -3 * 3600_000

function spParts(d: Date) {
  const s = new Date(d.getTime() + SP_OFFSET_MS)
  return { y: s.getUTCFullYear(), m: s.getUTCMonth(), d: s.getUTCDate(), dow: s.getUTCDay() }
}
function spDate(y: number, m: number, d: number, hh: number, mm: number, ss = 0) {
  return new Date(Date.UTC(y, m, d, hh, mm, ss) - SP_OFFSET_MS)
}

/** Monday after the end date, 18:00 in Brasília (official rule since V3). */
export function paymentDueFor(endsAt: Date) {
  const p = spParts(endsAt)
  const isoDow = p.dow === 0 ? 7 : p.dow
  return spDate(p.y, p.m, p.d + (8 - isoDow), 18, 0, 0)
}

/** Next official slots: Tuesdays and Thursdays 19:00, 24h long. */
export function nextAuctionSlots(from: Date, count = 4) {
  const out: { starts: Date; ends: Date }[] = []
  const p = spParts(from)
  for (let i = 0; out.length < count && i < 30; i++) {
    const day = spDate(p.y, p.m, p.d + i, 19, 0)
    const dow = spParts(day).dow
    if ((dow === 2 || dow === 4) && day.getTime() > from.getTime()) {
      out.push({ starts: day, ends: new Date(day.getTime() + 24 * 3600_000) })
    }
  }
  return out
}

// ---------------------------------------------------------------------
// Payment summary message (copy / WhatsApp)
// ---------------------------------------------------------------------
function lotLine(l: Lot, amount: number) {
  if (l.kind === 'single' && l.cards[0]) {
    const c = l.cards[0]
    return `• ${l.title} — ${conditionLabel(c.condition)} · ${languageMeta(c.language).label} — ${money(amount)}`
  }
  const lines = [`• ${l.title} (combo, ${l.card_count} cartas) — ${money(amount)}`]
  for (const c of l.cards) lines.push(`   ◦ ${c.title} — ${c.condition} · ${languageMeta(c.language).label}`)
  if (l.card_count > l.cards.length) lines.push(`   ◦ + ${l.card_count - l.cards.length} carta(s)`)
  return lines.join('\n')
}

export function buildPaymentMessage(order: Order, settings: Pick<Settings, 'pix_key' | 'card_link'>) {
  const first = order.user.full_name.split(/\s+/)[0] || 'tudo bem'
  const items = order.items.filter((i) => i.status === 'active')
  return [
    `Oi, ${first}! 💙`,
    ``,
    `Aqui está o resumo do seu pedido ${order.code} no leilão “${order.auction_title}”:`,
    ``,
    ...items.map((i) => lotLine(i.lot, Number(i.amount))),
    ``,
    `Total: ${money(order.total)}`,
    `Prazo para pagamento: ${dateLong(order.due_at)} (horário de Brasília)`,
    ``,
    `Formas de pagamento:`,
    `PIX (e-mail): ${settings.pix_key}`,
    `Cartão: ${settings.card_link}`,
    ``,
    `Depois de pagar, envie o comprovante na página do pedido em “Meus pedidos”. A confirmação é feita pela equipe.`,
    `Você pode receber por envio (Correios/transportadora), retirar em Curitiba/PR ou deixar suas cartas guardadas com a gente sem custo.`,
    ``,
    `Obrigado por participar da Gimmy Cards! ✨`,
  ].join('\n')
}
