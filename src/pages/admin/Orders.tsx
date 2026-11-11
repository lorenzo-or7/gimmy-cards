import { useState } from 'react'
import { CalendarClock, ChevronDown, ListOrdered, MessageCircle, ShieldAlert } from 'lucide-react'
import { Badge, Button, ConfirmDialog, cx, EmptyState, ErrorState, Field, Input, Modal, Skeleton } from '@/components/ui'
import { useSettings, useToast } from '@/app/providers'
import { useQuery } from '@/hooks/useQuery'
import { api } from '@/lib/api'
import { buildPaymentMessage } from '@/lib/domain'
import { errorMessage } from '@/lib/errors'
import { dateTime, formatPhone, fromLocalInput, money, toLocalInput, whatsappLink } from '@/lib/format'
import type { Order } from '@/lib/types'
import { OrderBadge } from '../account/MyOrders'
import { AdminHeader, FilterTabs } from './AdminLayout'
import { RankingModal } from './Ranking'
import { ProofViewer } from './Payments'

type Tab = 'all' | 'awaiting_payment' | 'proof_submitted' | 'overdue' | 'paid' | 'defaulted'

export default function Orders() {
  const q = useQuery('admin:orders', () => api.admin.orders(null), { live: { topic: 'any' } })
  const [tab, setTab] = useState<Tab>('all')
  const [open, setOpen] = useState<string | null>(null)
  const all = q.data ?? []
  const list = all.filter((o) => tab === 'all' || (tab === 'overdue' ? o.overdue : o.status === tab))
  const count = (t: Tab) => all.filter((o) => (t === 'overdue' ? o.overdue : o.status === t)).length
  return (
    <>
      <AdminHeader title="Pedidos">Um pedido por participante e leilão. Inadimplência só pode ser registrada após o prazo.</AdminHeader>
      <FilterTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'all', label: 'Todos', count: all.length },
          { value: 'awaiting_payment', label: 'Aguardando', count: count('awaiting_payment') },
          { value: 'proof_submitted', label: 'Comprovante', count: count('proof_submitted') },
          { value: 'overdue', label: 'Vencidos', count: count('overdue') },
          { value: 'paid', label: 'Pagos', count: count('paid') },
          { value: 'defaulted', label: 'Inadimplentes', count: count('defaulted') },
        ]}
      />
      {q.error && <ErrorState message={q.error} onRetry={q.reload} />}
      {q.loading ? <Skeleton className="h-80" /> : list.length === 0 ? <EmptyState mascot="confused" title="Nenhum pedido neste filtro" /> : (
        <ul className="space-y-3">
          {list.map((o) => <OrderRow key={o.id} o={o} open={open === o.id} onToggle={() => setOpen(open === o.id ? null : o.id)} onChanged={q.reload} />)}
        </ul>
      )}
    </>
  )
}

function OrderRow({ o, open, onToggle, onChanged }: { o: Order; open: boolean; onToggle(): void; onChanged(): void }) {
  const settings = useSettings()
  const toast = useToast()
  const [dlg, setDlg] = useState<null | 'paid' | 'default' | 'due'>(null)
  const [due, setDue] = useState(toLocalInput(o.due_at))
  const [busy, setBusy] = useState(false)
  const [ranking, setRanking] = useState<string | null>(null)
  const [proofs, setProofs] = useState(false)
  const payable = o.status === 'awaiting_payment' || o.status === 'proof_submitted'
  const msg = buildPaymentMessage(o, { pix_key: settings?.pix_key ?? '', card_link: settings?.card_link ?? '' })
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try {
      await fn()
      toast({ kind: 'success', title: ok })
      setDlg(null)
      onChanged()
    } catch (e) {
      toast({ kind: 'error', title: 'Não foi possível concluir', body: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }
  return (
    <li className={cx('bg-surface/85 rounded-[1.5rem] border shadow-soft', o.overdue ? 'border-danger/40' : 'border-line-strong')}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="grid w-full grid-cols-[1fr_auto] items-center gap-3 p-4 text-left sm:grid-cols-[auto_1fr_auto_auto] sm:p-5">
        <span className="tabular font-semibold">#{o.code}</span>
        <span className="col-span-2 min-w-0 sm:col-span-1">
          <span className="block truncate font-medium">{o.user.full_name}</span>
          <span className="block truncate text-[13px] text-subtle">{o.auction_title} · vence {dateTime(o.due_at)}</span>
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <OrderBadge o={o} />
          {o.source === 'transfer' && <Badge tone="gold">Transferência</Badge>}
        </span>
        <span className="flex items-center gap-3">
          <span className="tabular text-lg font-bold">{money(o.total)}</span>
          <ChevronDown aria-hidden className={cx('size-5 text-subtle transition-transform', open && 'rotate-180')} />
        </span>
      </button>
      {open && (
        <div className="border-t border-line p-4 sm:p-5">
          <ul className="mb-4 space-y-2">
            {o.items.map((it) => (
              <li key={it.id} className="flex flex-wrap items-center justify-between gap-2 text-[15px]">
                <span className={cx(it.status === 'void' && 'text-subtle line-through')}>{it.lot.title}</span>
                <span className="flex items-center gap-2">
                  <span className="tabular font-semibold">{money(it.amount)}</span>
                  <Button size="sm" variant="ghost" onClick={() => setRanking(it.lot.id)} icon={<ListOrdered className="size-4" />}>Classificação</Button>
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {o.user.whatsapp && (
              <a href={whatsappLink(o.user.whatsapp, msg)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line-strong px-3.5 text-sm font-semibold hover:border-accent">
                <MessageCircle className="size-4" /> Enviar resumo · {formatPhone(o.user.whatsapp)}
              </a>
            )}
            {o.proofs.length > 0 && <Button size="sm" variant="secondary" onClick={() => setProofs(true)}>Ver comprovantes ({o.proofs.length})</Button>}
            {payable && <Button size="sm" onClick={() => setDlg('paid')}>Confirmar pagamento</Button>}
            {payable && <Button size="sm" variant="secondary" onClick={() => setDlg('due')} icon={<CalendarClock className="size-4" />}>Alterar prazo</Button>}
            {payable && o.overdue && <Button size="sm" variant="danger" onClick={() => setDlg('default')} icon={<ShieldAlert className="size-4" />}>Registrar inadimplência</Button>}
          </div>
          {o.admin_note && <p className="mt-3 text-[14px] text-subtle">Nota: {o.admin_note}</p>}
        </div>
      )}
      <ConfirmDialog open={dlg === 'paid'} onClose={() => setDlg(null)} loading={busy} title="Confirmar pagamento?" description={`Pedido #${o.code} · ${money(o.total)}. As cartas vão para o armazenamento do participante.`} confirmLabel="Confirmar pagamento" onConfirm={() => run(() => api.admin.reviewPayment(o.id, true, 'Confirmado manualmente'), 'Pagamento confirmado')} />
      <ConfirmDialog open={dlg === 'default'} onClose={() => setDlg(null)} loading={busy} tone="danger" requireReason title="Registrar inadimplência?" description="O pedido é encerrado e os itens ficam disponíveis para oferta ao próximo colocado (pela Classificação). Fica registrado na auditoria." confirmLabel="Registrar" onConfirm={(r) => run(() => api.admin.markDefault(o.id, r), 'Inadimplência registrada')} />
      <Modal open={dlg === 'due'} onClose={() => setDlg(null)} title="Novo prazo de pagamento" size="sm" footer={<><Button variant="ghost" onClick={() => setDlg(null)}>Voltar</Button><Button loading={busy} onClick={() => run(() => api.admin.setOrderDue(o.id, fromLocalInput(due)), 'Prazo atualizado')}>Salvar prazo</Button></>}>
        <Field label="Prazo (Brasília)" className="pb-4">{(p) => <Input id={p.id} type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />}</Field>
      </Modal>
      <RankingModal lotId={ranking} onClose={() => setRanking(null)} onChanged={onChanged} />
      <ProofViewer order={proofs ? o : null} onClose={() => setProofs(false)} onChanged={onChanged} />
    </li>
  )
}
