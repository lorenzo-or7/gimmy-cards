import { useState } from 'react'
import { Link } from 'react-router-dom'
import { History as HistoryIcon, Zap } from 'lucide-react'
import { Page, PageHeader, Tabs } from '@/components/layout/Page'
import { Badge, Button, EmptyState, ErrorState, Skeleton } from '@/components/ui'
import { CardImage } from '@/components/cards/CardVisuals'
import { useQuery } from '@/hooks/useQuery'
import { api } from '@/lib/api'
import { dateTime, LOT_STATUS, money } from '@/lib/format'
import type { Lot } from '@/lib/types'

export default function HistoryPage() {
  const q = useQuery('history', () => api.history(30))
  const [extra, setExtra] = useState<Lot[]>([])
  const [busy, setBusy] = useState(false)
  const items = [...(q.data?.items ?? []), ...extra]
  return (
    <Page>
      <PageHeader mascot="animado" eyebrow="Resultados" title="Histórico de leilões">
        Resultados públicos de cada lote. Os nomes aparecem abreviados para proteger os participantes.
      </PageHeader>
      <Tabs label="Tipo de leilão" items={[{ to: '/leiloes', label: 'Ao vivo', end: true }, { to: '/leiloes/proximos', label: 'Próximos' }, { to: '/historico', label: 'Encerrados' }]} />
      {q.error && <ErrorState message={q.error} onRetry={q.reload} />}
      {q.loading ? (
        <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={<HistoryIcon className="size-6" />} title="Nenhum resultado ainda">Os lotes aparecem aqui assim que encerram.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-[1.75rem] border border-line">
          <table className="w-full text-left">
            <caption className="sr-only">Lotes encerrados</caption>
            <thead className="hidden bg-surface-2 text-sm text-subtle md:table-header-group">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Lote</th>
                <th scope="col" className="px-5 py-3 font-medium">Leilão</th>
                <th scope="col" className="px-5 py-3 font-medium">Resultado</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Valor final</th>
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <tr key={l.id} className="grid grid-cols-[4rem_1fr_auto] items-center gap-x-4 border-t border-line px-4 py-4 first:border-t-0 md:table-row md:px-0 md:first:border-t">
                  <td className="row-span-2 md:px-5 md:py-4">
                    <Link to={`/lote/${l.id}`} className="flex items-center gap-4">
                      <CardImage path={l.cards[0]?.front_path ?? null} alt="" className="aspect-[5/7] w-14 shrink-0 rounded-lg" />
                      <span className="hidden font-semibold hover:text-accent-text md:block">{l.title}</span>
                    </Link>
                  </td>
                  <td className="min-w-0 md:px-5 md:py-4">
                    <Link to={`/lote/${l.id}`} className="block truncate font-semibold md:hidden">{l.title}</Link>
                    <span className="block truncate text-[14px] text-subtle md:text-[15px] md:text-muted">{l.auction_title}</span>
                    <span className="block text-[13px] text-subtle">{dateTime(l.closed_at)}</span>
                  </td>
                  <td className="col-start-2 md:px-5 md:py-4">
                    {l.status === 'sold' ? (
                      <Badge tone="gold"><Zap aria-hidden className="size-3.5" /> {l.winner_alias}</Badge>
                    ) : l.winner_alias ? (
                      <Badge tone="success">{l.winner_alias}</Badge>
                    ) : (
                      <Badge>{LOT_STATUS[l.status]}</Badge>
                    )}
                  </td>
                  <td className="tabular col-start-3 row-start-1 text-right text-lg font-bold md:px-5 md:py-4">{l.winning_amount ? money(l.winning_amount) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {items.length < (q.data?.total ?? 0) && (
        <div className="mt-8 flex justify-center">
          <Button
            variant="outline"
            loading={busy}
            onClick={async () => {
              setBusy(true)
              try {
                const r = await api.history(30, items.length)
                setExtra((x) => [...x, ...r.items])
              } finally {
                setBusy(false)
              }
            }}
          >
            Carregar mais
          </Button>
        </div>
      )}
    </Page>
  )
}
