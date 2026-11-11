import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Plus, Timer } from 'lucide-react'
import { Badge, Button, ButtonLink, EmptyState, ErrorState, LiveBadge, Skeleton } from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { api } from '@/lib/api'
import { dateTime } from '@/lib/format'
import type { Auction } from '@/lib/types'
import { AdminHeader, FilterTabs } from './AdminLayout'
import { DuplicateModal } from './AuctionEdit'

export function auctionPhase(a: Auction, now = Date.now()) {
  if (a.status === 'draft') return 'draft'
  if (a.status === 'cancelled') return 'cancelled'
  if (a.status === 'closed') return 'closed'
  if (new Date(a.starts_at).getTime() > now) return 'scheduled'
  if (new Date(a.ends_at).getTime() > now) return 'live'
  return 'closing'
}
export function AuctionBadge({ a }: { a: Auction }) {
  const p = auctionPhase(a)
  const m = {
    draft: <Badge>Rascunho</Badge>,
    scheduled: <Badge tone="mint">Agendado</Badge>,
    live: <LiveBadge size="sm" />,
    closing: <Badge tone="warning">Encerrando</Badge>,
    closed: <Badge tone="success">Encerrado</Badge>,
    cancelled: <Badge tone="danger">Cancelado</Badge>,
  }
  return m[p]
}

export default function AdminAuctions() {
  const q = useQuery('admin:auctions', api.admin.auctions, { live: { topic: 'lots' } })
  const [tab, setTab] = useState<'all' | 'live' | 'scheduled' | 'draft' | 'closed'>('all')
  const [dup, setDup] = useState<Auction | null>(null)
  const list = useMemo(() => (q.data ?? []).filter((a) => tab === 'all' || auctionPhase(a) === tab || (tab === 'closed' && ['closed', 'closing', 'cancelled'].includes(auctionPhase(a)))), [q.data, tab])
  const count = (t: string) => (q.data ?? []).filter((a) => auctionPhase(a) === t).length
  return (
    <>
      <AdminHeader title="Leilões" action={<ButtonLink to="/admin/leiloes/novo" icon={<Plus className="size-4" />}>Novo leilão</ButtonLink>}>
        Crie, agende e acompanhe. Leilões oficiais: terça e quinta às 19h, 24 horas.
      </AdminHeader>
      <FilterTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'all', label: 'Todos', count: q.data?.length },
          { value: 'live', label: 'Ao vivo', count: count('live') },
          { value: 'scheduled', label: 'Agendados', count: count('scheduled') },
          { value: 'draft', label: 'Rascunhos', count: count('draft') },
          { value: 'closed', label: 'Encerrados' },
        ]}
      />
      {q.error && <ErrorState message={q.error} onRetry={q.reload} />}
      {q.loading ? (
        <Skeleton className="h-80" />
      ) : list.length === 0 ? (
        <EmptyState icon={<Timer className="size-6" />} title="Nenhum leilão aqui" action={<ButtonLink to="/admin/leiloes/novo">Criar leilão</ButtonLink>} />
      ) : (
        <div className="bg-surface/85 overflow-hidden rounded-[1.75rem] border border-line-strong">
          <table className="w-full text-left text-[15px]">
            <caption className="sr-only">Leilões</caption>
            <thead className="hidden bg-surface-2/60 text-[13px] text-subtle md:table-header-group">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Leilão</th>
                <th scope="col" className="px-5 py-3 font-medium">Status</th>
                <th scope="col" className="px-5 py-3 font-medium">Início</th>
                <th scope="col" className="px-5 py-3 font-medium">Encerramento</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Lotes</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Lances</th>
                <th scope="col" className="px-5 py-3"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-t border-line p-4 first:border-t-0 md:table-row md:p-0">
                  <td className="md:px-5 md:py-4">
                    <Link to={`/admin/leiloes/${a.id}`} className="font-semibold hover:text-accent-text">{a.title}</Link>
                  </td>
                  <td className="md:px-5 md:py-4"><AuctionBadge a={a} /></td>
                  <td className="tabular text-[14px] text-muted md:px-5 md:py-4"><span className="md:hidden">Início </span>{dateTime(a.starts_at)}</td>
                  <td className="tabular text-[14px] text-muted md:px-5 md:py-4"><span className="md:hidden">Fim </span>{dateTime(a.ends_at)}</td>
                  <td className="tabular text-[14px] md:px-5 md:py-4 md:text-right"><span className="md:hidden text-subtle">Lotes </span>{a.lot_count}</td>
                  <td className="tabular text-[14px] md:px-5 md:py-4 md:text-right"><span className="md:hidden text-subtle">Lances </span>{a.bid_count}</td>
                  <td className="col-span-2 md:px-5 md:py-4 md:text-right">
                    <Button size="sm" variant="ghost" onClick={() => setDup(a)} icon={<Copy className="size-4" />}>Duplicar</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <DuplicateModal auction={dup} onClose={() => setDup(null)} />
    </>
  )
}
