import { useEffect, useMemo, useState } from 'react'
import { MapPin, MessageCircle, Truck, Warehouse } from 'lucide-react'
import { Badge, Button, EmptyState, ErrorState, Field, Input, Modal, Select, Skeleton, Textarea } from '@/components/ui'
import { useToast } from '@/app/providers'
import { useQuery } from '@/hooks/useQuery'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { dateOnly, dateTime, formatPhone, money, SHIPMENT_STATUS, STORED_STATUS, whatsappLink } from '@/lib/format'
import type { AdminStored, Shipment, ShipmentStatus } from '@/lib/types'
import { AdminHeader, FilterTabs, Panel } from './AdminLayout'

export default function Storage() {
  const [tab, setTab] = useState<'shipments' | 'stored'>('shipments')
  const ships = useQuery('admin:shipments', () => api.admin.shipments(null), { live: { topic: 'any' } })
  const stored = useQuery('admin:stored', api.admin.stored)
  const [edit, setEdit] = useState<Shipment | null>(null)
  const open = (ships.data ?? []).filter((s) => !['delivered', 'picked_up', 'cancelled'].includes(s.status))
  const groups = useMemo(() => {
    const m = new Map<string, { name: string; whatsapp: string; items: AdminStored[] }>()
    for (const s of stored.data ?? []) {
      const g = m.get(s.user.id) ?? { name: s.user.full_name, whatsapp: s.user.whatsapp, items: [] }
      g.items.push(s)
      m.set(s.user.id, g)
    }
    return [...m.values()]
  }, [stored.data])
  return (
    <>
      <AdminHeader title="Armazenamento e entregas">Itens pagos ficam vinculados ao dono até serem enviados ou retirados.</AdminHeader>
      <FilterTabs value={tab} onChange={setTab} options={[{ value: 'shipments', label: 'Solicitações', count: open.length }, { value: 'stored', label: 'Itens guardados', count: stored.data?.length }]} />
      {tab === 'shipments' ? (
        ships.error ? <ErrorState message={ships.error} onRetry={ships.reload} /> : ships.loading ? <Skeleton className="h-64" /> : (ships.data ?? []).length === 0 ? (
          <EmptyState icon={<Truck className="size-6" />} title="Nenhuma solicitação de envio ou retirada" />
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {ships.data!.map((s) => (
              <li key={s.id} className="bg-surface/85 rounded-[1.5rem] border border-line-strong p-5 shadow-soft">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-semibold">{s.method === 'shipping' ? <Truck className="size-4" /> : <MapPin className="size-4" />}{s.method === 'shipping' ? 'Envio' : 'Retirada'} · {s.user.full_name}</span>
                  <Badge tone={['delivered', 'picked_up'].includes(s.status) ? 'success' : s.status === 'cancelled' ? 'neutral' : 'accent'}>{SHIPMENT_STATUS[s.status]}</Badge>
                </div>
                <p className="mt-1 text-[13px] text-subtle">Solicitado {dateTime(s.created_at)}</p>
                <ul className="mt-3 text-[15px]">{s.items.map((i) => <li key={i.id}>• {i.lot_title}</li>)}</ul>
                {s.method === 'shipping' && (
                  <address className="mt-3 rounded-xl bg-surface-2 p-3 text-[14px] not-italic text-muted">
                    {s.recipient_name}<br />{s.address.street}{s.address.complement && `, ${s.address.complement}`}<br />{s.address.district && `${s.address.district} · `}{s.address.city}/{s.address.state} · CEP {s.postal_code}
                  </address>
                )}
                <p className="mt-2 text-[14px] text-subtle">{s.shipping_fee != null && `Frete ${money(s.shipping_fee)} · `}{s.tracking_code && `Rastreio ${s.tracking_code}`}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {!['delivered', 'picked_up', 'cancelled'].includes(s.status) && <Button size="sm" onClick={() => setEdit(s)}>Atualizar</Button>}
                  {s.user.whatsapp && <a href={whatsappLink(s.user.whatsapp, `Oi, ${s.user.full_name.split(' ')[0]}! Sobre a sua ${s.method === 'shipping' ? 'entrega' : 'retirada'} na Gimmy Cards:`)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line-strong px-3 text-sm font-semibold hover:border-accent"><MessageCircle className="size-4" /> {formatPhone(s.user.whatsapp)}</a>}
                </div>
              </li>
            ))}
          </ul>
        )
      ) : stored.loading ? <Skeleton className="h-64" /> : groups.length === 0 ? (
        <EmptyState icon={<Warehouse className="size-6" />} title="Nenhum item guardado" />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <Panel key={g.name} title={`${g.name} · ${g.items.length} item(ns)`} action={g.whatsapp ? <span className="text-[13px] text-subtle">{formatPhone(g.whatsapp)}</span> : undefined}>
              <ul className="divide-y divide-line text-[15px]">
                {g.items.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span>{i.lot_title} <span className="text-[13px] text-subtle">· {i.auction_title} · #{i.order_code}</span></span>
                    <span className="flex items-center gap-2 text-[13px] text-subtle">desde {dateOnly(i.stored_at)} <Badge tone={i.status === 'stored' ? 'neutral' : 'accent'}>{STORED_STATUS[i.status]}</Badge></span>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
      <ShipmentEditor s={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void ships.reload(); void stored.reload() }} />
    </>
  )
}

function ShipmentEditor({ s, onClose, onSaved }: { s: Shipment | null; onClose(): void; onSaved(): void }) {
  const toast = useToast()
  const [status, setStatus] = useState<ShipmentStatus>('preparing')
  const [fee, setFee] = useState('')
  const [tracking, setTracking] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const key = s?.id
  useEffect(() => {
    if (!s) return
    setStatus(s.status === 'requested' ? 'preparing' : s.status)
    setFee(s.shipping_fee != null ? String(s.shipping_fee) : '')
    setTracking(s.tracking_code)
    setNotes(s.admin_notes)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const options: ShipmentStatus[] = s?.method === 'pickup' ? ['preparing', 'ready_for_pickup', 'picked_up', 'cancelled'] : ['preparing', 'shipped', 'delivered', 'cancelled']
  return (
    <Modal
      open={!!s}
      onClose={onClose}
      title="Atualizar entrega"
      description="O participante é notificado a cada mudança."
      size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Voltar</Button><Button loading={busy} onClick={async () => {
        setBusy(true)
        try {
          await api.admin.updateShipment(s!.id, status, fee ? Number(fee.replace(',', '.')) : null, tracking || null, notes || null)
          toast({ kind: 'success', title: 'Entrega atualizada' })
          onSaved()
        } catch (e) {
          toast({ kind: 'error', title: 'Não foi possível atualizar', body: errorMessage(e) })
        } finally {
          setBusy(false)
        }
      }}>Salvar</Button></>}
    >
      <div className="space-y-4 pb-4">
        <Field label="Status">{(p) => <Select id={p.id} value={status} onChange={(e) => setStatus(e.target.value as ShipmentStatus)}>{options.map((o) => <option key={o} value={o}>{SHIPMENT_STATUS[o]}</option>)}</Select>}</Field>
        {s?.method === 'shipping' && <Field label="Valor do frete" optional>{(p) => <Input id={p.id} inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0,00" />}</Field>}
        {s?.method === 'shipping' && <Field label="Código de rastreio" optional>{(p) => <Input id={p.id} value={tracking} onChange={(e) => setTracking(e.target.value)} />}</Field>}
        <Field label="Instruções para o participante" optional>{(p) => <Textarea id={p.id} value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-20" />}</Field>
      </div>
    </Modal>
  )
}
