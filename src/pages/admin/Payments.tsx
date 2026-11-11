import { useEffect, useState } from 'react'
import { CreditCard, ExternalLink } from 'lucide-react'
import { Badge, Button, EmptyState, ErrorState, Field, Modal, Skeleton, Textarea } from '@/components/ui'
import { useBackend, useToast } from '@/app/providers'
import { useQuery } from '@/hooks/useQuery'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { dateTime, money } from '@/lib/format'
import type { Order } from '@/lib/types'
import { AdminHeader } from './AdminLayout'

export default function Payments() {
  const q = useQuery('admin:payments', () => api.admin.orders('proof_submitted'), { live: { topic: 'any' } })
  const [sel, setSel] = useState<Order | null>(null)
  return (
    <>
      <AdminHeader title="Pagamentos">Comprovantes enviados aguardando conferência. Enviar comprovante não confirma o pagamento.</AdminHeader>
      {q.error && <ErrorState message={q.error} onRetry={q.reload} />}
      {q.loading ? <Skeleton className="h-64" /> : (q.data ?? []).length === 0 ? (
        <EmptyState icon={<CreditCard className="size-6" />} title="Nenhum comprovante para conferir" />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {q.data!.map((o) => (
            <li key={o.id} className="bg-surface/85 flex flex-col rounded-[1.5rem] border border-line-strong p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <span className="tabular font-semibold">#{o.code}</span>
                <Badge tone={o.overdue ? 'danger' : 'accent'}>{o.overdue ? 'Prazo vencido' : 'Em análise'}</Badge>
              </div>
              <p className="mt-3 font-medium">{o.user.full_name}</p>
              <p className="text-[14px] text-subtle">{o.auction_title} · {o.items.length} item(ns)</p>
              <p className="tabular mt-3 text-3xl font-bold">{money(o.total)}</p>
              <p className="text-[13px] text-subtle">Último envio {dateTime(o.proofs[0]?.created_at)}</p>
              <Button className="mt-4" onClick={() => setSel(o)}>Conferir</Button>
            </li>
          ))}
        </ul>
      )}
      <ProofViewer order={sel} onClose={() => setSel(null)} onChanged={q.reload} />
    </>
  )
}

/** Shows private proofs through short-lived signed URLs; approve or reject. */
export function ProofViewer({ order, onClose, onChanged }: { order: Order | null; onClose(): void; onChanged(): void }) {
  const backend = useBackend()
  const toast = useToast()
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<null | 'ok' | 'no'>(null)
  useEffect(() => {
    if (!order) return
    setNote('')
    setUrls({})
    order.proofs.forEach((p) => void backend.storage.proofUrl(p.file_path).then((u) => setUrls((x) => ({ ...x, [p.id]: u }))).catch(() => {}))
  }, [order, backend])
  const review = async (approve: boolean) => {
    if (!order) return
    if (!approve && note.trim().length < 3) return toast({ kind: 'error', title: 'Explique o motivo da recusa' })
    setBusy(approve ? 'ok' : 'no')
    try {
      await api.admin.reviewPayment(order.id, approve, note)
      toast({ kind: 'success', title: approve ? 'Pagamento confirmado' : 'Comprovante recusado' })
      onChanged()
      onClose()
    } catch (e) {
      toast({ kind: 'error', title: 'Não foi possível concluir', body: errorMessage(e) })
    } finally {
      setBusy(null)
    }
  }
  const payable = order && (order.status === 'awaiting_payment' || order.status === 'proof_submitted')
  return (
    <Modal
      open={!!order}
      onClose={onClose}
      title={order ? `Pedido #${order.code} · ${money(order.total)}` : ''}
      description={order?.user.full_name}
      size="xl"
      footer={payable ? <><Button variant="danger" loading={busy === 'no'} onClick={() => review(false)}>Recusar comprovante</Button><Button loading={busy === 'ok'} onClick={() => review(true)}>Confirmar pagamento</Button></> : undefined}
    >
      {order && (
        <div className="grid gap-6 pb-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            {order.proofs.map((p) => {
              const u = urls[p.id]
              const pdf = p.file_path.endsWith('.pdf') || u?.startsWith('data:application/pdf')
              return (
                <figure key={p.id} className="overflow-hidden rounded-2xl border border-line">
                  {!u ? <Skeleton className="h-72 rounded-none" /> : pdf ? (
                    <iframe src={u} title="Comprovante em PDF" className="h-[28rem] w-full bg-white" />
                  ) : (
                    <img src={u} alt="Comprovante de pagamento" className="max-h-[32rem] w-full bg-surface-2 object-contain" />
                  )}
                  <figcaption className="flex items-center justify-between gap-2 p-3 text-[13px] text-subtle">
                    Enviado {dateTime(p.created_at)} · {p.status === 'pending' ? 'pendente' : p.status === 'approved' ? 'aprovado' : 'recusado'}
                    {u && <a href={u} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent-text">Abrir <ExternalLink className="size-3.5" /></a>}
                  </figcaption>
                </figure>
              )
            })}
            {order.proofs.length === 0 && <p className="text-muted">Nenhum comprovante enviado.</p>}
          </div>
          <div>
            <h3 className="mb-2 font-semibold">Itens</h3>
            <ul className="divide-y divide-line rounded-2xl border border-line text-[15px]">
              {order.items.map((it) => <li key={it.id} className="flex justify-between gap-3 p-3"><span>{it.lot.title}</span><span className="tabular font-semibold">{money(it.amount)}</span></li>)}
              <li className="flex justify-between p-3 font-bold"><span>Total</span><span className="tabular">{money(order.total)}</span></li>
            </ul>
            <p className="mt-3 text-[14px] text-subtle">Prazo: {dateTime(order.due_at)}</p>
            {payable && <Field label="Observação" optional hint="Obrigatória ao recusar; o participante vê este texto." className="mt-5">{(p) => <Textarea id={p.id} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-24" aria-describedby={p.describedBy} />}</Field>}
          </div>
        </div>
      )}
    </Modal>
  )
}
