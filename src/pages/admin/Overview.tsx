import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CreditCard, Gavel, Layers, Package, Plus, RefreshCw, Timer, Truck, Users, Warehouse } from 'lucide-react'
import { ButtonLink, Countdown, cx, ErrorState, LiveBadge, Skeleton } from '@/components/ui'
import { Mascot } from '@/components/brand/Mascot'
import { useAuth } from '@/app/providers'
import { useQuery } from '@/hooks/useQuery'
import { useNowAt } from '@/hooks/useNow'
import { api } from '@/lib/api'
import { dateLong, dateTime, money, relative } from '@/lib/format'
import type { Auction, Overview as OverviewData } from '@/lib/types'
import { AdminHeader, Panel } from './AdminLayout'

export default function Overview() {
  const { profile } = useAuth()
  const o = useQuery('admin:overview', api.admin.overview, { live: { topic: 'any' }, poll: 60_000 })
  const auctions = useQuery('admin:auctions', api.admin.auctions, { live: { topic: 'lots' } })
  const audit = useQuery('admin:audit:recent', () => api.admin.audit(8))
  const d = o.data
  const list = auctions.data ?? []
  const now = useNowAt(list.flatMap((a) => [a.starts_at, a.ends_at]))
  const live = list.filter((a) => a.status === 'published' && new Date(a.starts_at).getTime() <= now && new Date(a.ends_at).getTime() > now)
  const next = list.filter((a) => a.status === 'published' && new Date(a.starts_at).getTime() > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const hour = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(new Date()))
  const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <>
      <AdminHeader
        title={`${greet}, ${profile?.full_name.split(' ')[0]}`}
        action={
          <>
            <ButtonLink to="/admin/cartas" variant="secondary" icon={<Layers className="size-4" />}>Nova carta</ButtonLink>
            <ButtonLink to="/admin/leiloes/novo" icon={<Plus className="size-4" />}>Novo leilão</ButtonLink>
          </>
        }
      >
        Resumo da operação com dados do banco, atualizado em tempo real.
      </AdminHeader>
      {o.error && <ErrorState message={o.error} onRetry={o.reload} />}

      <div className="grid gap-5 lg:grid-cols-12">
        <LivePanel live={live[0]} next={next[0]} loading={auctions.loading} className="lg:col-span-7" />
        <FinancePanel d={d} className="lg:col-span-5" />

        <KpiStrip d={d} className="lg:col-span-12" />

        <Panel title="Lances por dia" action={<span className="text-[13px] text-subtle">últimos 14 dias · horário de Brasília</span>} className="lg:col-span-8">
          {d ? <BarChart data={d.bids_by_day} /> : <Skeleton className="h-60" />}
        </Panel>
        <AlertsPanel d={d} className="lg:col-span-4" />

        <Panel title="Atividade recente" action={<Link to="/admin/notificacoes" className="text-[13px] font-semibold text-accent-text hover:underline">Auditoria completa</Link>} className="lg:col-span-7">
          {audit.loading ? (
            <Skeleton className="h-56" />
          ) : (audit.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-[15px] text-muted">Nenhuma ação registrada ainda.</p>
          ) : (
            <ol className="relative space-y-0.5 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-line-strong">
              {audit.data!.map((a) => (
                <li key={a.id} className="relative flex gap-3 rounded-xl py-2 pr-2">
                  <span aria-hidden className="relative z-10 mt-1 grid size-[31px] shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-accent-text">
                    <ActionIcon action={a.action} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium">{ACTION_LABEL[a.action] ?? a.action}<span className="font-normal text-subtle"> · {ENTITY_LABEL[a.entity] ?? a.entity}</span></p>
                    <p className="text-[13px] text-subtle">por {a.actor ?? 'sistema'}</p>
                  </div>
                  <time className="shrink-0 pt-0.5 text-[12px] text-subtle" dateTime={a.created_at} title={dateTime(a.created_at)}>{relative(a.created_at)}</time>
                </li>
              ))}
            </ol>
          )}
        </Panel>
        <div className="grid gap-5 lg:col-span-5">
          <Panel title="Próximos leilões" action={<Link to="/admin/leiloes" className="text-[13px] font-semibold text-accent-text hover:underline">Todos</Link>}>
            <ul className="space-y-1">
              {next.slice(0, 3).map((a) => (
                <li key={a.id}>
                  <Link to={`/admin/leiloes/${a.id}`} className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-surface-2">
                    <DateChip iso={a.starts_at} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{a.title}</span>
                      <span className="block text-[13px] text-subtle">{a.lot_count} lotes · {dateLong(a.starts_at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
              {!auctions.loading && next.length === 0 && (
                <li className="rounded-xl bg-surface-2/60 p-4 text-[14px] text-muted">
                  Nada agendado. <Link to="/admin/leiloes/novo" className="font-semibold text-accent-text">Criar leilão</Link>
                </li>
              )}
            </ul>
          </Panel>
          <Panel title="Ações rápidas">
            <div className="grid grid-cols-2 gap-2">
              {[
                ['/admin/leiloes/novo', Timer, 'Criar leilão'],
                ['/admin/cartas', Layers, 'Cadastrar carta'],
                ['/admin/pagamentos', CreditCard, 'Conferir pagamentos'],
                ['/admin/armazenamento', Truck, 'Entregas'],
              ].map(([to, I, l]) => {
                const Icon = I as typeof Timer
                return (
                  <Link key={to as string} to={to as string} className="group flex items-center gap-2.5 rounded-xl border border-line px-3 py-3 text-[14px] font-medium transition-colors hover:border-accent/50">
                    <Icon aria-hidden className="size-4 text-accent-text" />
                    <span className="flex-1">{l as string}</span>
                    <ArrowRight aria-hidden className="size-3.5 text-subtle transition-transform group-hover:translate-x-0.5" />
                  </Link>
                )
              })}
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}

function LivePanel({ live, next, loading, className }: { live?: Auction; next?: Auction; loading: boolean; className?: string }) {
  const now = useNowAt([live?.ends_at])
  if (loading) return <Skeleton className={cx('h-64 rounded-[22px]', className)} />
  if (!live)
    return (
      <section className={cx('relative overflow-hidden rounded-[22px] border border-line bg-surface/85 p-6 shadow-soft', className)}>
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="t-eyebrow">Operação</p>
            <h2 className="mt-2 text-2xl font-bold">Nenhum leilão ao vivo</h2>
            <p className="mt-1.5 text-[15px] text-muted">{next ? <>Próximo: <strong className="text-ink">{next.title}</strong>, {dateLong(next.starts_at)}.</> : 'Não há leilões agendados.'}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {next ? <ButtonLink to={`/admin/leiloes/${next.id}`} variant="secondary">Revisar próximo</ButtonLink> : <ButtonLink to="/admin/leiloes/novo">Criar leilão</ButtonLink>}
            </div>
          </div>
          <Mascot pose="dormindo" width={120} className="hidden sm:block" />
        </div>
      </section>
    )
  const total = new Date(live.ends_at).getTime() - new Date(live.starts_at).getTime()
  const pct = Math.min(100, Math.max(0, ((now - new Date(live.starts_at).getTime()) / total) * 100))
  return (
    <section className={cx('relative overflow-hidden rounded-[22px] border border-live/30 bg-surface/85 p-6 shadow-soft', className)}>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_90%_at_100%_0%,var(--live-soft),transparent_70%)]" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <LiveBadge />
            <span className="text-[13px] text-subtle">até {dateTime(live.ends_at)}</span>
          </div>
          <h2 className="mt-3 truncate text-2xl font-bold">{live.title}</h2>
          <div className="mt-4">
            <p className="text-[12px] font-semibold tracking-[0.08em] text-subtle uppercase">Encerra em</p>
            <Countdown to={live.ends_at} />
          </div>
        </div>
        <Mascot pose="leiloeiro" width={118} className="-mr-1 hidden shrink-0 sm:block" />
      </div>
      <div className="relative mt-5">
        <div className="h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label="Tempo decorrido do leilão" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
          <div className="h-full rounded-full bg-live" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <dl className="flex gap-6 text-[14px]">
            <div><dt className="text-subtle">Lotes</dt><dd className="tabular text-lg font-bold">{live.lot_count}</dd></div>
            <div><dt className="text-subtle">Lances</dt><dd className="tabular text-lg font-bold">{live.bid_count}</dd></div>
          </dl>
          <div className="flex gap-2">
            <ButtonLink to="/admin/lances" size="sm" variant="secondary">Ver lances</ButtonLink>
            <ButtonLink to={`/admin/leiloes/${live.id}`} size="sm">Abrir leilão</ButtonLink>
          </div>
        </div>
      </div>
    </section>
  )
}

function FinancePanel({ d, className }: { d?: OverviewData; className?: string }) {
  if (!d) return <Skeleton className={cx('h-64 rounded-[22px]', className)} />
  const paid = d.revenue_paid
  const open = d.revenue_open
  const total = paid + open
  const share = total ? paid / total : 0
  const C = 2 * Math.PI * 42
  return (
    <section className={cx('rounded-[22px] border border-line bg-surface/85 p-6 shadow-soft', className)}>
      <div className="flex items-center justify-between">
        <p className="t-eyebrow">Financeiro</p>
        <Link to="/admin/pedidos" className="text-[13px] font-semibold text-accent-text hover:underline">Pedidos</Link>
      </div>
      <div className="mt-4 flex items-center gap-6">
        <svg viewBox="0 0 100 100" className="size-28 shrink-0 -rotate-90" role="img" aria-label={`${Math.round(share * 100)}% do valor dos pedidos já confirmado`}>
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--surface-3)" strokeWidth="12" />
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--accent)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${C * share} ${C}`} />
        </svg>
        <dl className="min-w-0 space-y-3">
          <div>
            <dt className="flex items-center gap-2 text-[13px] text-subtle"><span aria-hidden className="size-2 rounded-full bg-accent" /> Confirmado</dt>
            <dd className="tabular text-2xl font-bold">{money(paid)}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-2 text-[13px] text-subtle"><span aria-hidden className="size-2 rounded-full bg-surface-3 ring-1 ring-line-strong" /> Em aberto</dt>
            <dd className="tabular text-lg font-semibold">{money(open)}</dd>
          </div>
        </dl>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        {[
          ['Aguardando', d.orders_awaiting, '/admin/pedidos'],
          ['Comprovantes', d.proofs_pending, '/admin/pagamentos'],
          ['Pagos', d.orders_paid, '/admin/pedidos'],
        ].map(([l, v, to]) => (
          <Link key={l as string} to={to as string} className="rounded-xl bg-bg/50 px-2 py-2.5 transition-colors hover:bg-surface-2">
            <span className="tabular block text-lg font-bold">{v as number}</span>
            <span className="block text-[12px] text-subtle">{l as string}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

function KpiStrip({ d, className }: { d?: OverviewData; className?: string }) {
  const series = d?.bids_by_day.map((x) => x.count) ?? []
  const items = [
    { icon: Gavel, l: 'Lances registrados', v: d?.bids_total, h: d ? `${d.bids_24h} nas últimas 24h` : '', spark: true, to: '/admin/lances' },
    { icon: Layers, l: 'Lotes publicados', v: d?.published_lots, h: d ? `${d.open_lots} abertos agora` : '', to: '/admin/leiloes' },
    { icon: Users, l: 'Participantes', v: d?.participants, h: 'contas cadastradas', to: '/admin/participantes' },
    { icon: Warehouse, l: 'Cartas guardadas', v: d?.stored_items, h: d ? `${d.shipments_open} entregas em aberto` : '', to: '/admin/armazenamento' },
  ]
  return (
    <div className={cx('grid overflow-hidden rounded-[22px] border border-line bg-surface/85 shadow-soft sm:grid-cols-2 xl:grid-cols-4', className)}>
      {items.map((k, i) => (
        <Link key={k.l} to={k.to} className={cx('group flex items-end justify-between gap-3 p-5 transition-colors hover:bg-surface-2/50', i > 0 && 'border-t border-line sm:border-t-0', i % 2 === 1 && 'sm:border-l', i >= 2 && 'sm:border-t xl:border-t-0', i > 0 && 'xl:border-l')}>
          <div>
            <p className="flex items-center gap-2 text-[13px] text-subtle"><k.icon aria-hidden className="size-4 text-accent-text" /> {k.l}</p>
            {k.v === undefined ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="tabular mt-1 text-[28px] leading-tight font-bold">{k.v}</p>}
            <p className="text-[12px] text-subtle">{k.h}</p>
          </div>
          {k.spark && series.length > 1 && <Sparkline values={series} />}
        </Link>
      ))}
    </div>
  )
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values)
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 96 + 2},${38 - (v / max) * 34}`).join(' ')
  return (
    <svg viewBox="0 0 100 40" className="h-10 w-24 shrink-0" aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function AlertsPanel({ d, className }: { d?: OverviewData; className?: string }) {
  const rows = d
    ? [
        { n: d.proofs_pending, icon: CreditCard, t: 'Comprovantes para conferir', to: '/admin/pagamentos', tone: 'accent' },
        { n: d.overdue, icon: AlertTriangle, t: 'Pedidos com prazo vencido', to: '/admin/pedidos', tone: 'danger' },
        { n: d.transfers_active, icon: RefreshCw, t: 'Ofertas de inadimplência ativas', to: '/admin/pedidos', tone: 'warning' },
        { n: d.shipments_open, icon: Package, t: 'Entregas e retiradas em aberto', to: '/admin/armazenamento', tone: 'neutral' },
      ]
    : []
  const pending = rows.filter((r) => r.n > 0)
  return (
    <Panel title="Prioridades" className={className}>
      {!d ? (
        <Skeleton className="h-48" />
      ) : pending.length === 0 ? (
        <div className="flex flex-col items-center py-4 text-center">
          <Mascot pose="animado" width={84} />
          <p className="mt-3 font-semibold">Tudo em dia</p>
          <p className="text-[14px] text-muted">Nenhuma pendência no momento.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {pending.map((r) => (
            <li key={r.t}>
              <Link to={r.to} className="group flex items-center gap-3 rounded-xl border border-line px-3 py-3 transition-colors hover:border-accent/50">
                <span className={cx('grid size-9 shrink-0 place-items-center rounded-lg', r.tone === 'danger' ? 'bg-danger-soft text-danger' : r.tone === 'warning' ? 'bg-warning-soft text-warning' : r.tone === 'accent' ? 'bg-accent-soft text-accent-text' : 'bg-surface-2 text-muted')}>
                  <r.icon aria-hidden className="size-4" />
                </span>
                <span className="min-w-0 flex-1 text-[14px] font-medium">{r.t}</span>
                <span className="tabular rounded-full bg-surface-2 px-2 py-0.5 text-[13px] font-bold">{r.n}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function BarChart({ data }: { data: { day: string; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...data.map((x) => x.count))
  const total = data.reduce((s, x) => s + x.count, 0)
  if (total === 0) return <p className="grid h-60 place-items-center text-[15px] text-muted">Nenhum lance nos últimos 14 dias.</p>
  const top = Math.max(4, Math.ceil(max / 4) * 4)
  const ticks = [0, top / 4, top / 2, (3 * top) / 4, top]
  const label = (iso: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(iso + 'T12:00:00'))
  return (
    <figure>
      <figcaption className="sr-only">Lances por dia nos últimos 14 dias, total {total}.</figcaption>
      <div className="grid grid-cols-[2rem_1fr] gap-2">
        <div className="relative h-56">
          {ticks.map((t) => (
            <span key={t} className="tabular absolute right-0 -translate-y-1/2 text-[11px] text-subtle" style={{ bottom: `${(t / top) * 100}%`, transform: 'translateY(50%)' }}>{t}</span>
          ))}
        </div>
        <div className="relative h-56">
          {ticks.map((t) => (
            <div key={t} aria-hidden className="absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${(t / top) * 100}%` }} />
          ))}
          <ul className="absolute inset-0 flex items-end gap-1.5 sm:gap-2">
            {data.map((x, i) => (
              <li key={x.day} className="relative flex h-full flex-1 items-end">
                <button
                  type="button"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  aria-label={`${label(x.day)}: ${x.count} lances`}
                  className={cx('w-full rounded-t-md transition-[background-color,height] duration-500 ease-[cubic-bezier(.2,.8,.2,1)]', i === data.length - 1 ? 'bg-accent' : hover === i ? 'bg-accent/80' : 'bg-accent/35')}
                  style={{ height: `${Math.max((x.count / top) * 100, x.count ? 3 : 1)}%` }}
                />
                {hover === i && (
                  <span role="tooltip" className="tabular pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-[12px] font-semibold whitespace-nowrap text-bg shadow-pop" style={{ bottom: `${(x.count / top) * 100}%` }}>
                    {label(x.day)} · {x.count} {x.count === 1 ? 'lance' : 'lances'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-2 ml-10 flex gap-1.5 sm:gap-2">
        {data.map((x, i) => (
          <span key={x.day} className="tabular flex-1 text-center text-[11px] text-subtle">{i % 2 === 0 || i === data.length - 1 ? label(x.day).slice(0, 2) : ''}</span>
        ))}
      </div>
    </figure>
  )
}

function DateChip({ iso }: { iso: string }) {
  const d = new Date(iso)
  const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', timeZone: 'America/Sao_Paulo' }).format(d)
  const wd = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'America/Sao_Paulo' }).format(d).replace('.', '')
  return (
    <span className="grid w-12 shrink-0 place-items-center rounded-xl bg-accent-soft py-1 text-accent-text">
      <span className="text-[10px] font-semibold tracking-[0.12em] uppercase">{wd}</span>
      <span className="tabular text-lg leading-none font-bold">{day}</span>
    </span>
  )
}

const ACTION_LABEL: Record<string, string> = {
  insert: 'Criou', update: 'Editou', delete: 'Excluiu', buy_now: 'Arremate imediato', payment_approved: 'Pagamento confirmado',
  payment_rejected: 'Comprovante recusado', order_due_changed: 'Prazo alterado', order_defaulted: 'Inadimplência registrada',
  transfer_offered: 'Oferta ao próximo colocado', transfer_accepted: 'Oferta aceita', transfer_declined: 'Oferta recusada',
  transfer_cancelled: 'Oferta cancelada', auction_published: 'Leilão publicado', auction_unpublished: 'Leilão despublicado',
  auction_cancelled: 'Leilão cancelado', lot_cancelled: 'Lote cancelado', lot_ended_early: 'Lote encerrado antes', role_changed: 'Permissão alterada',
  settings_changed: 'Configurações alteradas', pokemon_added: 'Pokémon adicionado',
}
const ENTITY_LABEL: Record<string, string> = { cards: 'carta', auctions: 'leilão', lots: 'lote', orders: 'pedido', default_transfers: 'transferência', profiles: 'perfil', app_settings: 'configurações', pokemon: 'catálogo' }

function ActionIcon({ action }: { action: string }) {
  const I = action.startsWith('payment') ? CreditCard : action.startsWith('transfer') || action.includes('default') ? RefreshCw : action.startsWith('auction') ? Timer : action === 'buy_now' ? Gavel : Layers
  return <I className="size-3.5" />
}
