import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock } from 'lucide-react'
import { Page, PageHeader, Tabs } from '@/components/layout/Page'
import { LotGridSkeleton, LotTile } from '@/components/auction/LotTile'
import { Badge, Countdown, EmptyState, ErrorState, LiveBadge } from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { api } from '@/lib/api'
import { dateLong, timeOnly } from '@/lib/format'
import { nextAuctionSlots } from '@/lib/domain'

export default function Auctions({ scope }: { scope: 'live' | 'upcoming' }) {
  const q = useQuery(`auctions:${scope}`, () => api.auctions(scope, 12), { live: { topic: 'lots' }, poll: scope === 'live' ? 30_000 : undefined })
  const slots = nextAuctionSlots(new Date(), 2)
  return (
    <Page>
      <PageHeader mascot="leiloeiro" eyebrow="Leilões" title={scope === 'live' ? 'Leilões ativos' : 'Próximos leilões'}>
        {scope === 'live'
          ? 'Lances abertos agora. Cada lote encerra no horário marcado, sem prorrogação.'
          : 'Confira os lotes antes de abrir e chegue preparado.'}
      </PageHeader>
      <Tabs label="Tipo de leilão" items={[{ to: '/leiloes', label: 'Ao vivo', end: true }, { to: '/leiloes/proximos', label: 'Próximos' }, { to: '/historico', label: 'Encerrados' }]} />
      {q.error && <ErrorState message={q.error} onRetry={q.reload} />}
      {q.loading && <LotGridSkeleton n={8} />}
      {!q.loading && q.data?.length === 0 && (
        <EmptyState
          icon={<CalendarClock className="size-6" />}
          title={scope === 'live' ? 'Nenhum leilão aberto agora' : 'Nenhum leilão agendado ainda'}
          action={scope === 'live' ? <Link to="/leiloes/proximos" className="font-semibold text-accent-text hover:underline">Ver próximos leilões</Link> : undefined}
        >
          Os próximos horários oficiais são {slots.map((s) => dateLong(s.starts.toISOString())).join(' e ')}.
        </EmptyState>
      )}
      <div className="space-y-20">
        {q.data?.map((a) => (
          <section key={a.id} aria-labelledby={`a-${a.id}`}>
            <div className="mb-7 flex flex-col gap-4 border-b border-line pb-6 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {scope === 'live' ? <LiveBadge /> : <Badge>Abre {dateLong(a.starts_at)}</Badge>}
                  <Badge>{a.lot_count} lotes</Badge>
                </div>
                <h2 id={`a-${a.id}`} className="text-3xl">
                  <Link to={`/leiloes/${a.id}`} className="hover:text-accent-text">{a.title}</Link>
                </h2>
                {a.description && <p className="mt-1 max-w-2xl text-muted">{a.description}</p>}
              </div>
              <div className="flex items-end gap-6">
                <div>
                  <p className="text-sm text-subtle">{scope === 'live' ? `Encerra às ${timeOnly(a.ends_at)}` : 'Começa em'}</p>
                  <Countdown to={scope === 'live' ? a.ends_at : a.starts_at} />
                </div>
                <Link to={`/leiloes/${a.id}`} className="hidden items-center gap-1.5 font-semibold text-accent-text hover:underline md:inline-flex">
                  Todos os lotes <ArrowRight aria-hidden className="size-4" />
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 lg:grid-cols-4">
              {(a.lots ?? []).map((l, i) => (
                <LotTile key={l.id} lot={l} startsAt={a.starts_at} index={i} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </Page>
  )
}
