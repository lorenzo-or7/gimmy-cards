import { Link } from 'react-router-dom'
import { Gavel } from 'lucide-react'
import { ACCOUNT_TABS, Page, PageHeader, Tabs } from '@/components/layout/Page'
import { Badge, ButtonLink, Countdown, cx, EmptyState, ErrorState, Skeleton } from '@/components/ui'
import { CardImage } from '@/components/cards/CardVisuals'
import { lotPhase } from '@/components/auction/LotTile'
import { useQuery } from '@/hooks/useQuery'
import { useNowAt } from '@/hooks/useNow'
import { api } from '@/lib/api'
import { LOT_STATUS, money, relative } from '@/lib/format'

export default function MyBids() {
  const q = useQuery('my-bids', api.myBids, { live: { topic: 'lots' }, poll: 30_000 })
  const items = q.data ?? []
  const now = useNowAt(items.map((l) => l.ends_at))
  const live = items.filter((l) => lotPhase(l, undefined, now) === 'live')
  const done = items.filter((l) => lotPhase(l, undefined, now) !== 'live')
  return (
    <Page>
      <PageHeader eyebrow="Minha conta" title="Meus lances">Sua posição atualiza em tempo real.</PageHeader>
      <Tabs label="Seções da conta" items={ACCOUNT_TABS} />
      {q.error && <ErrorState message={q.error} onRetry={q.reload} />}
      {q.loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Gavel className="size-6" />} title="Você ainda não deu lances" action={<ButtonLink to="/leiloes">Ver leilões</ButtonLink>}>
          Quando você der um lance, ele aparece aqui com sua posição.
        </EmptyState>
      ) : (
        <div className="space-y-12">
          {live.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl">Em andamento</h2>
              <ul className="space-y-3">
                {live.map((l) => (
                  <Row key={l.id} id={l.id} img={l.cards[0]?.front_path ?? null} title={l.title} sub={l.auction_title ?? ''}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={l.my_rank === 1 ? 'accent' : 'warning'}>{l.my_rank === 1 ? 'Liderando' : `${l.my_rank}º lugar`}</Badge>
                      <span className="text-[14px] text-subtle">seu lance {money(l.my_amount)} · maior {money(l.current_price)}</span>
                    </div>
                    <div className="text-right text-[14px]">
                      <Countdown to={l.ends_at} compact />
                    </div>
                  </Row>
                ))}
              </ul>
            </section>
          )}
          {done.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl">Encerrados</h2>
              <ul className="space-y-3">
                {done.map((l) => (
                  <Row key={l.id} id={l.id} img={l.cards[0]?.front_path ?? null} title={l.title} sub={l.auction_title ?? ''}>
                    <div className="flex flex-wrap items-center gap-2">
                      {l.is_winner ? <Badge tone="gold">Você venceu</Badge> : <Badge>{l.my_rank ? `Terminou em ${l.my_rank}º` : LOT_STATUS[l.status]}</Badge>}
                      <span className="text-[14px] text-subtle">seu lance {money(l.my_amount)}</span>
                    </div>
                    <span className="text-[14px] text-subtle">{l.last_bid_at && relative(l.last_bid_at)}</span>
                  </Row>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Page>
  )
}

function Row({ id, img, title, sub, children }: { id: string; img: string | null; title: string; sub: string; children: React.ReactNode }) {
  return (
    <li>
      <Link to={`/lote/${id}`} className={cx('grid grid-cols-[3.5rem_1fr] items-center gap-4 rounded-3xl border border-line bg-surface p-3 transition-colors hover:border-accent/50 sm:grid-cols-[3.5rem_1fr_auto]')}>
        <CardImage path={img} alt="" className="row-span-2 aspect-[5/7] w-14 rounded-xl sm:row-span-1" />
        <div className="min-w-0">
          <p className="truncate font-semibold">{title}</p>
          <p className="truncate text-[14px] text-subtle">{sub}</p>
        </div>
        <div className="col-start-2 flex flex-wrap items-center justify-between gap-2 sm:col-start-3 sm:flex-col sm:items-end">{children}</div>
      </Link>
    </li>
  )
}
