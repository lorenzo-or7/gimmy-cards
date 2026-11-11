import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Clock, Gift, Trophy } from 'lucide-react'
import { ACCOUNT_TABS, Page, PageHeader, Tabs } from '@/components/layout/Page'
import { Badge, Button, ButtonLink, ConfirmDialog, Countdown, EmptyState, ErrorState, Skeleton } from '@/components/ui'
import { CardImage } from '@/components/cards/CardVisuals'
import { useToast } from '@/app/providers'
import { useQuery } from '@/hooks/useQuery'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { dateTime, money, ORDER_STATUS, TRANSFER_STATUS } from '@/lib/format'
import type { TransferOffer } from '@/lib/types'

export default function MyWins() {
  const q = useQuery('my-wins', api.myWins, { live: { topic: 'notifications' } })
  const offers = q.data?.offers ?? []
  const active = offers.filter((o) => o.status === 'offered')
  const pastOffers = offers.filter((o) => o.status !== 'offered')
  const wins = q.data?.wins ?? []
  return (
    <Page>
      <PageHeader eyebrow="Minha conta" title="Meus arremates" />
      <Tabs label="Seções da conta" items={ACCOUNT_TABS} />
      {q.error && <ErrorState message={q.error} onRetry={q.reload} />}
      {q.loading ? (
        <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <div className="space-y-12">
          {active.length > 0 && (
            <section aria-labelledby="offers">
              <h2 id="offers" className="mb-4 flex items-center gap-2 text-xl"><Gift aria-hidden className="size-5 text-gold-text" /> Ofertas para você</h2>
              <ul className="space-y-4">
                {active.map((o) => <OfferCard key={o.id} offer={o} onDone={q.reload} />)}
              </ul>
            </section>
          )}
          <section aria-labelledby="wins">
            <h2 id="wins" className="mb-4 text-xl">Lotes vencidos</h2>
            {wins.length === 0 ? (
              <EmptyState icon={<Trophy className="size-6" />} title="Nenhum arremate ainda" action={<ButtonLink to="/leiloes">Ver leilões ao vivo</ButtonLink>}>
                Quando você vencer um lote, ele aparece aqui.
              </EmptyState>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {wins.map((l) => (
                  <li key={l.id} className="flex gap-4 rounded-3xl border border-line bg-surface p-3">
                    <CardImage path={l.cards[0]?.front_path ?? null} alt="" className="aspect-[5/7] w-20 shrink-0 rounded-xl" />
                    <div className="min-w-0 py-1">
                      <Link to={`/lote/${l.id}`} className="line-clamp-2 font-semibold hover:text-accent-text">{l.title}</Link>
                      <p className="text-[14px] text-subtle">{l.auction_title}</p>
                      <p className="tabular mt-1 text-lg font-bold">{money(l.winning_amount)}</p>
                      {l.order_id ? (
                        <Link to={`/conta/pedidos/${l.order_id}`} className="mt-1 inline-block text-[14px] font-semibold text-accent-text hover:underline">
                          {ORDER_STATUS[l.order_status!]} →
                        </Link>
                      ) : (
                        <p className="mt-1 text-[14px] text-subtle">Pedido gerado ao fim do leilão</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {pastOffers.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl">Ofertas anteriores</h2>
              <ul className="divide-y divide-line rounded-3xl border border-line">
                {pastOffers.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <span className="font-medium">{o.lot.title}</span>
                    <span className="flex items-center gap-3 text-[14px] text-subtle">
                      {money(o.amount)} <Badge tone={o.status === 'accepted' ? 'success' : 'neutral'}>{TRANSFER_STATUS[o.status]}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Page>
  )
}

function OfferCard({ offer, onDone }: { offer: TransferOffer; onDone(): void }) {
  const toast = useToast()
  const nav = useNavigate()
  const [dialog, setDialog] = useState<'accept' | 'decline' | null>(null)
  const [busy, setBusy] = useState(false)
  const respond = async (accept: boolean) => {
    setBusy(true)
    try {
      const r = await api.respondTransfer(offer.id, accept)
      setDialog(null)
      if (r.status === 'expired') toast({ kind: 'error', title: 'A oferta expirou', body: 'O prazo de 24 horas terminou.' })
      else if (accept) {
        toast({ kind: 'success', title: 'Oferta aceita!', body: 'Seu pedido foi criado. Confira o prazo de pagamento.' })
        if (r.order_id) nav(`/conta/pedidos/${r.order_id}`)
      } else toast({ kind: 'info', title: 'Oferta recusada' })
      onDone()
    } catch (e) {
      toast({ kind: 'error', title: 'Não foi possível responder', body: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }
  return (
    <li className="grid gap-5 rounded-[1.75rem] border border-gold/40 bg-gold-soft p-5 sm:grid-cols-[6rem_1fr_auto] sm:items-center">
      <CardImage path={offer.lot.cards[0]?.front_path ?? null} alt="" className="aspect-[5/7] w-24 rounded-xl" />
      <div>
        <p className="text-[14px] font-semibold text-gold-text">Você ficou em {offer.rank}º e a carta voltou a ficar disponível</p>
        <p className="mt-1 text-xl font-semibold">{offer.lot.title}</p>
        <p className="mt-1 text-[15px] text-muted">
          Pelo valor do seu lance: <strong className="tabular text-ink">{money(offer.amount)}</strong>. Se aceitar, o pagamento vence em {dateTime(offer.payment_due_at)}.
        </p>
        <p className="mt-2 flex items-center gap-2 text-[14px]"><Clock aria-hidden className="size-4" /> Responda em <Countdown to={offer.expires_at} compact /></p>
      </div>
      <div className="flex gap-2 sm:flex-col">
        <Button variant="gold" onClick={() => setDialog('accept')}>Aceitar</Button>
        <Button variant="ghost" onClick={() => setDialog('decline')}>Recusar</Button>
      </div>
      <ConfirmDialog
        open={dialog === 'accept'}
        onClose={() => setDialog(null)}
        onConfirm={() => void respond(true)}
        loading={busy}
        tone="gold"
        title="Aceitar a oferta?"
        description={`Você compra “${offer.lot.title}” por ${money(offer.amount)}. Um pedido será criado com prazo de pagamento próprio.`}
        confirmLabel="Aceitar e criar pedido"
      />
      <ConfirmDialog
        open={dialog === 'decline'}
        onClose={() => setDialog(null)}
        onConfirm={() => void respond(false)}
        loading={busy}
        tone="danger"
        title="Recusar a oferta?"
        description="A carta poderá ser oferecida ao próximo colocado. Essa decisão não pode ser desfeita."
        confirmLabel="Recusar"
      />
    </li>
  )
}
