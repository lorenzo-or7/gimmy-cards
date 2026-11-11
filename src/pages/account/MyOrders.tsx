import { Link } from 'react-router-dom'
import { ChevronRight, Package } from 'lucide-react'
import { ACCOUNT_TABS, Page, PageHeader, Tabs } from '@/components/layout/Page'
import { Badge, ButtonLink, EmptyState, ErrorState, Skeleton } from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { api } from '@/lib/api'
import { dateTime, money, ORDER_STATUS } from '@/lib/format'
import type { Order } from '@/lib/types'

export function OrderBadge({ o }: { o: Pick<Order, 'status' | 'overdue'> }) {
  if (o.overdue) return <Badge tone="danger">Prazo vencido</Badge>
  const tone = { awaiting_payment: 'warning', proof_submitted: 'accent', paid: 'success', defaulted: 'danger', cancelled: 'neutral' } as const
  return <Badge tone={tone[o.status]}>{ORDER_STATUS[o.status]}</Badge>
}

export default function MyOrders() {
  const q = useQuery('my-orders', api.myOrders, { live: { topic: 'notifications' } })
  return (
    <Page>
      <PageHeader eyebrow="Minha conta" title="Meus pedidos">Cada leilão gera um pedido próprio, pago separadamente.</PageHeader>
      <Tabs label="Seções da conta" items={ACCOUNT_TABS} />
      {q.error && <ErrorState message={q.error} onRetry={q.reload} />}
      {q.loading ? (
        <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState icon={<Package className="size-6" />} title="Nenhum pedido ainda" action={<ButtonLink to="/leiloes">Ver leilões</ButtonLink>}>
          Os pedidos são criados automaticamente quando um leilão em que você venceu termina.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {q.data!.map((o) => (
            <li key={o.id}>
              <Link to={`/conta/pedidos/${o.id}`} className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-3xl border border-line bg-surface p-5 transition-colors hover:border-accent/50">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tabular font-semibold">#{o.code}</span>
                    <OrderBadge o={o} />
                    {o.source === 'transfer' && <Badge tone="gold">Oferta aceita</Badge>}
                  </div>
                  <p className="mt-1 truncate text-[15px] text-muted">{o.auction_title} · {o.items.filter((i) => i.status === 'active').length} item(ns)</p>
                  {['awaiting_payment', 'proof_submitted'].includes(o.status) && <p className="mt-0.5 text-[14px] text-subtle">Vence {dateTime(o.due_at)}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular text-xl font-bold">{money(o.total)}</span>
                  <ChevronRight aria-hidden className="size-5 text-subtle" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}
