import type { CardCondition, CardLanguage, LotStatus, OrderStatus, ShipmentStatus, StoredStatus, TransferStatus } from './types'

export const TZ = 'America/Sao_Paulo'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const money = (v: number | string | null | undefined) => (v === null || v === undefined || v === '' ? '—' : brl.format(Number(v)))

const dtf = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, ...o })
const fDateTime = dtf({ day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const fDateLong = dtf({ weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })
const fDate = dtf({ day: '2-digit', month: '2-digit', year: 'numeric' })
const fWeekdayTime = dtf({ weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const fTime = dtf({ hour: '2-digit', minute: '2-digit' })

export const dateTime = (iso?: string | null) => (iso ? fDateTime.format(new Date(iso)).replace(',', ' às') : '—')
export const dateLong = (iso?: string | null) => (iso ? fDateLong.format(new Date(iso)) : '—')
export const dateOnly = (iso?: string | null) => (iso ? fDate.format(new Date(iso)) : '—')
export const weekdayTime = (iso?: string | null) => (iso ? fWeekdayTime.format(new Date(iso)).replace(',', '') : '—')
export const timeOnly = (iso?: string | null) => (iso ? fTime.format(new Date(iso)) : '—')

export function relative(iso: string, now = Date.now()) {
  const diff = new Date(iso).getTime() - now
  const abs = Math.abs(diff)
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
  if (abs < 60_000) return rtf.format(Math.round(diff / 1000), 'second')
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), 'minute')
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), 'hour')
  return rtf.format(Math.round(diff / 86_400_000), 'day')
}

export function splitDuration(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000))
  return { d: Math.floor(t / 86400), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 }
}

export const CONDITIONS: { value: CardCondition; label: string; short: string; hint: string }[] = [
  { value: 'M', short: 'M', label: 'Mint', hint: 'Perfeita, sem marcas' },
  { value: 'NM', short: 'NM', label: 'Near Mint', hint: 'Quase perfeita' },
  { value: 'SP', short: 'SP', label: 'Slightly Played', hint: 'Leves sinais de uso' },
  { value: 'MP', short: 'MP', label: 'Moderately Played', hint: 'Uso visível' },
  { value: 'HP', short: 'HP', label: 'Heavily Played', hint: 'Bastante desgaste' },
  { value: 'DM', short: 'DM', label: 'Damaged', hint: 'Danificada' },
]
export const LANGUAGES: { value: CardLanguage; label: string; flag: string; name: string }[] = [
  { value: 'BR', label: 'BR', flag: '🇧🇷', name: 'Português' },
  { value: 'ING', label: 'ING', flag: '🇺🇸', name: 'Inglês' },
  { value: 'JAP', label: 'JAP', flag: '🇯🇵', name: 'Japonês' },
  { value: 'CNH', label: 'CNH', flag: '🇨🇳', name: 'Chinês' },
]
export const conditionLabel = (c: CardCondition) => CONDITIONS.find((x) => x.value === c)?.label ?? c
export const languageMeta = (l: CardLanguage) => LANGUAGES.find((x) => x.value === l) ?? LANGUAGES[0]

export const LOT_STATUS: Record<LotStatus, string> = {
  open: 'Aberto',
  sold: 'Arrematado',
  closed: 'Encerrado',
  unsold: 'Sem lances',
  cancelled: 'Cancelado',
}
export const ORDER_STATUS: Record<OrderStatus, string> = {
  awaiting_payment: 'Aguardando pagamento',
  proof_submitted: 'Comprovante em análise',
  paid: 'Pago',
  defaulted: 'Inadimplente',
  cancelled: 'Cancelado',
}
export const TRANSFER_STATUS: Record<TransferStatus, string> = {
  offered: 'Aguardando resposta',
  accepted: 'Aceita',
  declined: 'Recusada',
  expired: 'Expirada',
  cancelled: 'Cancelada',
}
export const STORED_STATUS: Record<StoredStatus, string> = {
  stored: 'Armazenada',
  requested: 'Envio solicitado',
  shipped: 'Enviada',
  delivered: 'Entregue',
}
export const SHIPMENT_STATUS: Record<ShipmentStatus, string> = {
  requested: 'Solicitado',
  preparing: 'Em separação',
  shipped: 'Enviado',
  delivered: 'Entregue',
  ready_for_pickup: 'Pronto para retirada',
  picked_up: 'Retirado',
  cancelled: 'Cancelado',
}

export const onlyDigits = (s: string) => s.replace(/\D/g, '')
export function formatPhone(s: string) {
  const d = onlyDigits(s).replace(/^55(?=\d{10,11}$)/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return s
}
export function whatsappLink(phone: string, text: string) {
  let d = onlyDigits(phone)
  if (d && d.length <= 11) d = '55' + d
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`
}
export const whatsappShare = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`

/** ISO -> value for <input type="datetime-local"> in São Paulo time */
export function toLocalInput(iso: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso))
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}`
}
/** <input type="datetime-local"> value (São Paulo wall clock) -> ISO */
export function fromLocalInput(v: string) {
  // São Paulo has no DST since 2019: fixed UTC-3
  return new Date(`${v}:00-03:00`).toISOString()
}
