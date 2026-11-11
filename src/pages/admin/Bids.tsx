import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, ErrorState, Skeleton } from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { api } from '@/lib/api'
import { dateTime, money } from '@/lib/format'
import { AdminHeader, Pager, usePaged } from './AdminLayout'
import { RankingModal } from './Ranking'

export default function Bids() {
  const q = useQuery('admin:bids', () => api.admin.bids(null, 300), { live: { topic: 'lots' }, poll: 30_000 })
  const [lot, setLot] = useState<string | null>(null)
  const paged = usePaged(q.data ?? [], 30)
  return (
    <>
      <AdminHeader title="Lances">Últimos 300 lances, em ordem de registro no servidor (mais recentes primeiro).</AdminHeader>
      {q.error && <ErrorState message={q.error} onRetry={q.reload} />}
      {q.loading ? <Skeleton className="h-96" /> : (
        <div className="bg-surface/85 overflow-x-auto rounded-[1.75rem] border border-line-strong">
          <table className="w-full min-w-[760px] text-left text-[15px]">
            <caption className="sr-only">Lances</caption>
            <thead className="bg-surface-2/60 text-[13px] text-subtle">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Registro</th>
                <th scope="col" className="px-5 py-3 font-medium">Participante</th>
                <th scope="col" className="px-5 py-3 font-medium">Lote</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Valor</th>
                <th scope="col" className="px-5 py-3 font-medium">Posição</th>
                <th scope="col" className="px-5 py-3 font-medium">Horário</th>
              </tr>
            </thead>
            <tbody>
              {paged.slice.map((b) => (
                <tr key={b.id} className="border-t border-line">
                  <td className="tabular px-5 py-3 text-subtle">#{b.id}</td>
                  <td className="px-5 py-3 font-medium">{b.user_name}</td>
                  <td className="px-5 py-3">
                    <button type="button" onClick={() => setLot(b.lot_id)} className="text-left font-medium hover:text-accent-text">{b.lot_title}</button>
                    <span className="block text-[13px] text-subtle">{b.auction_title}</span>
                  </td>
                  <td className="tabular px-5 py-3 text-right font-semibold">{money(b.amount)}</td>
                  <td className="px-5 py-3">{b.is_buyout ? <Badge tone="gold">Arremate</Badge> : b.rank ? <Badge tone={b.rank === 1 ? 'accent' : 'neutral'}>{b.rank}º</Badge> : <span className="text-[13px] text-subtle">superado</span>}</td>
                  <td className="tabular px-5 py-3 text-[14px] text-muted">{dateTime(b.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager {...paged} />
          {(q.data ?? []).length === 0 && <p className="p-8 text-center text-muted">Nenhum lance ainda. <Link to="/admin/leiloes" className="text-accent-text">Ver leilões</Link></p>}
        </div>
      )}
      <RankingModal lotId={lot} onClose={() => setLot(null)} />
    </>
  )
}
