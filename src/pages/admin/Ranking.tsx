import { useEffect, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { Badge, Button, ConfirmDialog, Field, Input, Modal, Skeleton, Textarea } from '@/components/ui'
import { useToast } from '@/app/providers'
import { useQuery } from '@/hooks/useQuery'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { dateTime, formatPhone, fromLocalInput, money, ORDER_STATUS, toLocalInput, TRANSFER_STATUS, whatsappLink } from '@/lib/format'

/** Ranking + default (inadimplência) handling for one lot. */
export function RankingModal({ lotId, onClose, onChanged }: { lotId: string | null; onClose(): void; onChanged?(): void }) {
  const q = useQuery(`admin:ranking:${lotId}`, () => api.admin.ranking(lotId!), { enabled: !!lotId })
  const toast = useToast()
  const [offerOpen, setOfferOpen] = useState(false)
  const [reason, setReason] = useState('Inadimplência do colocado anterior')
  const [due, setDue] = useState('')
  const [hours, setHours] = useState('24')
  const [busy, setBusy] = useState(false)
  const [cancelId, setCancelId] = useState<string | null>(null)
  useEffect(() => {
    if (offerOpen) setDue(toLocalInput(new Date(Date.now() + 72 * 3600_000).toISOString()))
  }, [offerOpen])
  const r = q.data
  const active = r?.transfers.find((t) => t.status === 'offered')
  const hasActiveOrder = r?.orders.some((o) => o.item_status === 'active')
  const offered = new Set(r?.transfers.map((t) => t.offered_to))
  const ordered = new Set(r?.orders.map((o) => o.user))
  const next = r?.ranking.find((x) => x.rank > 1 && !offered.has(x.full_name) && !ordered.has(x.full_name))

  const offer = async () => {
    setBusy(true)
    try {
      const res = await api.admin.offerNext(lotId!, reason, due ? fromLocalInput(due) : null, Number(hours) || 24)
      toast({ kind: 'success', title: `Oferta enviada ao ${res.rank}º colocado`, body: `Valor ${money(res.amount)} · responde até ${dateTime(res.expires_at)}` })
      setOfferOpen(false)
      void q.reload()
      onChanged?.()
    } catch (e) {
      toast({ kind: 'error', title: 'Não foi possível ofertar', body: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={!!lotId} onClose={onClose} title="Classificação do lote" description={r?.lot.title} size="xl">
      {q.loading || !r ? (
        <Skeleton className="mb-4 h-64" />
      ) : (
        <div className="space-y-6 pb-4">
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[520px] text-left text-[15px]">
              <caption className="sr-only">Classificação</caption>
              <thead className="bg-surface-2 text-[13px] text-subtle">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">#</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Participante</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Lance</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Registro</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Contato</th>
                </tr>
              </thead>
              <tbody>
                {r.ranking.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">Sem lances.</td></tr>}
                {r.ranking.map((x) => (
                  <tr key={x.rank} className="border-t border-line">
                    <td className="tabular px-4 py-3 font-bold">{x.rank}º</td>
                    <td className="px-4 py-3 font-medium">{x.full_name}</td>
                    <td className="tabular px-4 py-3 text-right font-semibold">{money(x.amount)}</td>
                    <td className="tabular px-4 py-3 text-[13px] text-subtle">#{x.bid_id}</td>
                    <td className="px-4 py-3">
                      {x.whatsapp && (
                        <a href={whatsappLink(x.whatsapp, `Oi, ${x.full_name.split(' ')[0]}! Aqui é da Gimmy Cards, sobre o lote “${r.lot.title}”.`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[14px] font-medium text-accent-text hover:underline">
                          <MessageCircle aria-hidden className="size-4" /> {formatPhone(x.whatsapp)}
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {r.orders.length > 0 && (
            <div>
              <h3 className="mb-2 font-semibold">Pedidos deste lote</h3>
              <ul className="space-y-1.5 text-[14px]">
                {r.orders.map((o) => (
                  <li key={o.order_id} className="flex flex-wrap items-center gap-2">
                    <span className="tabular font-medium">#{o.code}</span> {o.user} · {money(o.amount)}
                    <Badge tone={o.status === 'paid' ? 'success' : o.status === 'defaulted' ? 'danger' : 'warning'}>{ORDER_STATUS[o.status]}</Badge>
                    {o.item_status === 'void' && <Badge>item anulado</Badge>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="mb-2 font-semibold">Transferências por inadimplência</h3>
            {r.transfers.length === 0 ? (
              <p className="text-[14px] text-muted">Nenhuma até agora.</p>
            ) : (
              <ol className="space-y-2">
                {r.transfers.map((t) => (
                  <li key={t.id} className="rounded-2xl border border-line p-3 text-[14px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{t.rank}º · {t.offered_to}</span>
                      <span className="tabular">{money(t.amount)}</span>
                      <Badge tone={t.status === 'accepted' ? 'success' : t.status === 'offered' ? 'accent' : 'neutral'}>{TRANSFER_STATUS[t.status]}</Badge>
                      {t.status === 'offered' && <Button size="sm" variant="ghost" onClick={() => setCancelId(t.id)}>Cancelar oferta</Button>}
                    </div>
                    <p className="mt-1 text-subtle">
                      Ofertado {dateTime(t.offered_at)} por {t.admin} · expira {dateTime(t.expires_at)}{t.responded_at && ` · respondeu ${dateTime(t.responded_at)}`} · pagamento até {dateTime(t.payment_due_at)}
                    </p>
                    {t.reason && <p className="text-subtle">Motivo: {t.reason}</p>}
                  </li>
                ))}
              </ol>
            )}
          </div>

          {['closed', 'sold'].includes(r.lot.status) && (
            <div className="rounded-2xl border border-line-strong bg-surface p-4">
              {hasActiveOrder ? (
                <p className="text-[14px] text-muted">O lote está em um pedido ativo. Para ofertar ao próximo, registre antes a inadimplência do pedido (após o prazo) em Pedidos.</p>
              ) : active ? (
                <p className="text-[14px] text-muted">Há uma oferta ativa. Aguarde a resposta ou cancele para seguir.</p>
              ) : next ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[15px]">Próximo elegível: <strong>{next.rank}º · {next.full_name}</strong> por <strong className="tabular">{money(next.amount)}</strong></p>
                  <Button onClick={() => setOfferOpen(true)} icon={<Send className="size-4" />}>Ofertar</Button>
                </div>
              ) : (
                <p className="text-[14px] text-muted">Não há mais participantes elegíveis na classificação.</p>
              )}
            </div>
          )}
        </div>
      )}
      <Modal
        open={offerOpen}
        onClose={() => setOfferOpen(false)}
        title="Ofertar ao próximo colocado"
        description="A oferta não equivale a pagamento. O participante tem o prazo abaixo para aceitar."
        size="sm"
        footer={<><Button variant="ghost" onClick={() => setOfferOpen(false)}>Voltar</Button><Button loading={busy} onClick={offer}>Enviar oferta</Button></>}
      >
        <div className="space-y-4 pb-4">
          <Field label="Motivo">{(p) => <Textarea id={p.id} value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-20" />}</Field>
          <Field label="Prazo para aceitar (horas)" hint="Padrão: 24 horas.">{(p) => <Input id={p.id} type="number" min={1} max={168} value={hours} onChange={(e) => setHours(e.target.value)} aria-describedby={p.describedBy} />}</Field>
          <Field label="Prazo de pagamento se aceitar" hint="Horário de Brasília.">{(p) => <Input id={p.id} type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} aria-describedby={p.describedBy} />}</Field>
        </div>
      </Modal>
      <ConfirmDialog
        open={!!cancelId}
        onClose={() => setCancelId(null)}
        requireReason
        tone="danger"
        title="Cancelar oferta ativa?"
        confirmLabel="Cancelar oferta"
        loading={busy}
        onConfirm={async (why) => {
          setBusy(true)
          try {
            await api.admin.cancelTransfer(cancelId!, why)
            setCancelId(null)
            void q.reload()
          } catch (e) {
            toast({ kind: 'error', title: 'Erro', body: errorMessage(e) })
          } finally {
            setBusy(false)
          }
        }}
      />
    </Modal>
  )
}
