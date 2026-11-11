import { useState } from 'react'
import { MapPin, Truck, Warehouse } from 'lucide-react'
import { ACCOUNT_TABS, Page, PageHeader, Tabs } from '@/components/layout/Page'
import { Badge, Button, ChipGroup, cx, EmptyState, ErrorState, Field, Input, Modal, Skeleton } from '@/components/ui'
import { CardImage } from '@/components/cards/CardVisuals'
import { useAuth, useSettings, useToast } from '@/app/providers'
import { useQuery } from '@/hooks/useQuery'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { dateOnly, money, onlyDigits, SHIPMENT_STATUS, STORED_STATUS } from '@/lib/format'
import type { ShipmentMethod, StoredItem } from '@/lib/types'

export default function Stored() {
  const q = useQuery('my-stored', api.myStored, { live: { topic: 'notifications' } })
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  const items = q.data ?? []
  const stored = items.filter((i) => i.status === 'stored')
  const others = items.filter((i) => i.status !== 'stored')
  const toggle = (id: string) => setSel((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })
  return (
    <Page>
      <PageHeader eyebrow="Minha conta" title="Minhas cartas armazenadas">
        Cartas pagas ficam guardadas sem prazo e sem taxa. Junte itens de vários leilões e peça um envio só.
      </PageHeader>
      <Tabs label="Seções da conta" items={ACCOUNT_TABS} />
      {q.error && <ErrorState message={q.error} onRetry={q.reload} />}
      {q.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-72" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Warehouse className="size-6" />} title="Nenhuma carta guardada">
          Assim que um pagamento for confirmado, as cartas aparecem aqui.
        </EmptyState>
      ) : (
        <>
          {stored.length > 0 && (
            <section aria-labelledby="st">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 id="st" className="text-xl">Guardadas ({stored.length})</h2>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setSel(sel.size === stored.length ? new Set() : new Set(stored.map((s) => s.id)))}>
                    {sel.size === stored.length ? 'Limpar seleção' : 'Selecionar todas'}
                  </Button>
                </div>
              </div>
              <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {stored.map((it) => <StoredCard key={it.id} it={it} selected={sel.has(it.id)} onToggle={() => toggle(it.id)} />)}
              </ul>
            </section>
          )}
          {others.length > 0 && (
            <section className="mt-12">
              <h2 className="mb-4 text-xl">Envios e retiradas</h2>
              <ul className="divide-y divide-line rounded-3xl border border-line bg-surface">
                {others.map((it) => (
                  <li key={it.id} className="flex flex-wrap items-center gap-4 p-4">
                    <CardImage path={it.lot.cards[0]?.front_path ?? null} alt="" className="aspect-[5/7] w-12 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{it.lot.title}</p>
                      <p className="text-[14px] text-subtle">
                        {it.shipment?.method === 'pickup' ? 'Retirada' : 'Envio'} · {it.shipment ? SHIPMENT_STATUS[it.shipment.status] : STORED_STATUS[it.status]}
                        {it.shipment?.tracking_code && ` · rastreio ${it.shipment.tracking_code}`}
                        {it.shipment?.shipping_fee != null && ` · frete ${money(it.shipment.shipping_fee)}`}
                      </p>
                      {it.shipment?.admin_notes && <p className="text-[14px] text-muted">{it.shipment.admin_notes}</p>}
                    </div>
                    <Badge tone={it.status === 'delivered' ? 'success' : 'accent'}>{STORED_STATUS[it.status]}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {sel.size > 0 && (
        <div className="glass fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-3xl border border-line-strong p-3 pl-5 shadow-pop lg:bottom-6">
          <span className="font-semibold">{sel.size} selecionada(s)</span>
          <Button onClick={() => setOpen(true)} icon={<Truck className="size-4" />}>Solicitar envio</Button>
        </div>
      )}
      <ShipmentModal open={open} onClose={() => setOpen(false)} ids={[...sel]} onDone={() => { setSel(new Set()); setOpen(false); void q.reload() }} />
    </Page>
  )
}

function StoredCard({ it, selected, onToggle }: { it: StoredItem; selected: boolean; onToggle(): void }) {
  return (
    <li>
      <label className={cx('block cursor-pointer rounded-3xl border bg-surface p-2.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring', selected ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-accent/40')}>
        <input type="checkbox" checked={selected} onChange={onToggle} className="sr-only" aria-label={`Selecionar ${it.lot.title}`} />
        <div className="relative">
          <CardImage path={it.lot.cards[0]?.front_path ?? null} alt="" className="aspect-[5/7] rounded-2xl" />
          <span aria-hidden className={cx('absolute top-2 right-2 grid size-7 place-items-center rounded-full border-2 text-accent-ink transition-colors', selected ? 'border-accent bg-accent' : 'border-white/70 bg-black/30')}>
            {selected && <svg viewBox="0 0 16 16" className="size-4"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>}
          </span>
        </div>
        <div className="px-1 pt-2.5 pb-1">
          <p className="line-clamp-1 font-semibold">{it.lot.title}</p>
          <p className="line-clamp-1 text-[13px] text-subtle">{it.auction_title}</p>
          <p className="text-[13px] text-subtle">Pago em {dateOnly(it.paid_at)}</p>
        </div>
      </label>
    </li>
  )
}

export function validateShipment(method: ShipmentMethod, f: { name: string; cep: string; street: string; number: string; city: string; state: string }) {
  const e: Record<string, string> = {}
  if (method === 'pickup') return e
  if (f.name.trim().length < 3) e.name = 'Informe o nome completo.'
  if (onlyDigits(f.cep).length !== 8) e.cep = 'CEP com 8 dígitos.'
  if (!f.street.trim()) e.street = 'Informe a rua.'
  if (!f.number.trim()) e.number = 'Informe o número.'
  if (!f.city.trim()) e.city = 'Informe a cidade.'
  if (!/^[A-Za-z]{2}$/.test(f.state.trim())) e.state = 'UF com 2 letras.'
  return e
}

function ShipmentModal({ open, onClose, ids, onDone }: { open: boolean; onClose(): void; ids: string[]; onDone(): void }) {
  const { profile } = useAuth()
  const settings = useSettings()
  const toast = useToast()
  const [method, setMethod] = useState<ShipmentMethod>('shipping')
  const [f, setF] = useState({ name: profile?.full_name ?? '', cep: '', street: '', number: '', complement: '', district: '', city: '', state: 'PR' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const submit = async () => {
    const errs = validateShipment(method, f)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      await api.requestShipment(ids, method, f.name, method === 'shipping' ? { street: `${f.street}, ${f.number}`, complement: f.complement, district: f.district, city: f.city, state: f.state.toUpperCase() } : {}, f.cep)
      toast({ kind: 'success', title: method === 'shipping' ? 'Envio solicitado' : 'Retirada solicitada', body: 'A equipe vai informar valores e instruções.' })
      onDone()
    } catch (e) {
      toast({ kind: 'error', title: 'Não foi possível solicitar', body: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Receber ${ids.length} carta(s)`}
      description="O frete não é calculado automaticamente: a equipe informa o valor depois."
      size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button loading={busy} onClick={submit}>Confirmar solicitação</Button></>}
    >
      <ChipGroup
        label="Como você quer receber?"
        value={method}
        onChange={(v) => v && setMethod(v)}
        options={[
          { value: 'shipping', label: <><Truck aria-hidden className="size-4" /> Envio</> },
          { value: 'pickup', label: <><MapPin aria-hidden className="size-4" /> Retirada em Curitiba</> },
        ]}
      />
      {method === 'pickup' ? (
        <p className="mt-5 rounded-2xl bg-surface-2 p-4 text-[15px] text-muted">{settings?.pickup_info} A equipe combina dia e local pelo WhatsApp.</p>
      ) : (
        <div className="mt-5 grid gap-4 pb-4 sm:grid-cols-6">
          <Field label="Nome completo do destinatário" error={errors.name} className="sm:col-span-6">{(p) => <Input id={p.id} value={f.name} onChange={set('name')} autoComplete="name" invalid={p.invalid} aria-describedby={p.describedBy} />}</Field>
          <Field label="CEP" error={errors.cep} className="sm:col-span-2">{(p) => <Input id={p.id} value={f.cep} onChange={set('cep')} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" invalid={p.invalid} aria-describedby={p.describedBy} />}</Field>
          <Field label="Rua" error={errors.street} className="sm:col-span-4">{(p) => <Input id={p.id} value={f.street} onChange={set('street')} autoComplete="address-line1" invalid={p.invalid} aria-describedby={p.describedBy} />}</Field>
          <Field label="Número" error={errors.number} className="sm:col-span-2">{(p) => <Input id={p.id} value={f.number} onChange={set('number')} invalid={p.invalid} aria-describedby={p.describedBy} />}</Field>
          <Field label="Complemento" optional className="sm:col-span-4">{(p) => <Input id={p.id} value={f.complement} onChange={set('complement')} autoComplete="address-line2" />}</Field>
          <Field label="Bairro" optional className="sm:col-span-2">{(p) => <Input id={p.id} value={f.district} onChange={set('district')} />}</Field>
          <Field label="Cidade" error={errors.city} className="sm:col-span-3">{(p) => <Input id={p.id} value={f.city} onChange={set('city')} autoComplete="address-level2" invalid={p.invalid} aria-describedby={p.describedBy} />}</Field>
          <Field label="UF" error={errors.state} className="sm:col-span-1">{(p) => <Input id={p.id} value={f.state} onChange={set('state')} maxLength={2} autoComplete="address-level1" invalid={p.invalid} aria-describedby={p.describedBy} />}</Field>
        </div>
      )}
    </Modal>
  )
}
