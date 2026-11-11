import { Link } from 'react-router-dom'
import { useRef } from 'react'
import { motion, useInView, useReducedMotion, useTransform, type MotionValue } from 'motion/react'
import { ArrowRight, Sparkles, UserPlus } from 'lucide-react'
import { ButtonLink, Countdown, LiveBadge } from '@/components/ui'
import { LotGridSkeleton, LotTile } from '@/components/auction/LotTile'
import { BrandBack, Card3D } from '@/components/cards/Card3D'
import { useQuery } from '@/hooks/useQuery'
import { useNow } from '@/hooks/useNow'
import { usePointer } from '@/hooks/usePointer'
import { api } from '@/lib/api'
import { dateLong, timeOnly } from '@/lib/format'
import { nextAuctionSlots } from '@/lib/domain'
import type { Auction, Lot } from '@/lib/types'
import { Hero } from './home/Hero'
import { Tutorial } from './home/Tutorial'
import { Featured } from './home/Featured'
import { Community } from './home/Community'
import { Raffles } from './home/Raffles'

export default function Home() {
  const live = useQuery('home:live', () => api.auctions('live', 4), { live: { topic: 'lots' }, poll: 30_000 })
  const upcoming = useQuery('home:upcoming', () => api.auctions('upcoming', 3))
  const featured = useQuery('home:featured', () => api.featured(14))
  const liveLots = (live.data ?? []).flatMap((a) => (a.lots ?? []).map((l) => ({ lot: l, a })))
  const liveAuction = live.data?.[0]
  const nextAuction = upcoming.data?.[0]
  return (
    <>
      <Hero liveAuction={liveAuction} nextAuction={nextAuction} />
      <LiveNow loading={live.loading} items={liveLots} auction={liveAuction} next={nextAuction} nextLoading={upcoming.loading} />
      <Tutorial />
      <Featured lots={featured.data ?? []} loading={featured.loading} />
      <Community />
      <Raffles />
      <FinalCta />
    </>
  )
}

// =====================================================================
// LIVE NOW + compact agenda
// =====================================================================
function LiveNow({ loading, items, auction, next, nextLoading }: { loading: boolean; items: { lot: Lot; a: Auction }[]; auction?: Auction; next?: Auction; nextLoading: boolean }) {
  return (
    <section aria-labelledby="live-title" className="relative mx-auto max-w-[1320px] px-5 py-16 sm:px-8 lg:py-20">
      <div className="mb-9 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="mb-2.5 inline-flex items-center gap-2 text-[13px] font-semibold tracking-[0.14em] text-accent-text uppercase">
            <LiveBadge size="sm" label="Acontecendo agora" />
          </p>
          <h2 id="live-title" className="text-[clamp(1.9rem,calc(1.3rem_+_2vw),2.75rem)] leading-[1.08]">
            {auction ? auction.title : 'Nenhum leilão aberto agora'}
          </h2>
          {auction && <p className="mt-2 text-[17px] text-muted">Encerra {dateLong(auction.ends_at)}. Sem prorrogação: o horário vale para todos.</p>}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {auction && (
            <div className="flex items-center justify-between gap-5 rounded-2xl border border-line bg-surface/70 px-5 py-3.5">
              <div>
                <p className="text-[12px] text-subtle">Encerra em</p>
                <Countdown to={auction.ends_at} compact />
              </div>
              <Link to={`/leiloes/${auction.id}`} className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-accent-text hover:underline">
                {auction.lot_count} lotes <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
          )}
          <AgendaChip next={next} loading={nextLoading} />
        </div>
      </div>
      {loading ? (
        <LotGridSkeleton />
      ) : items.length ? (
        <div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 lg:grid-cols-4">
          {items.slice(0, 4).map(({ lot, a }, i) => (
            <LotTile key={lot.id} lot={lot} startsAt={a.starts_at} index={i} />
          ))}
        </div>
      ) : (
        <div className="rounded-[1.75rem] border border-dashed border-line-strong p-10 text-center">
          <p className="text-lg font-semibold">Os próximos lotes aparecem aqui quando o leilão abrir.</p>
          <p className="mt-1 text-muted">Leilões oficiais começam às terças e quintas, às 19h.</p>
        </div>
      )}
    </section>
  )
}

/** Compact replacement for the old "Próximos leilões" section. */
function AgendaChip({ next, loading }: { next?: Auction; loading: boolean }) {
  const now = useNow(false)
  const slot = nextAuctionSlots(new Date(now), 1)[0]
  const iso = next?.starts_at ?? slot.starts.toISOString()
  const d = new Date(iso)
  const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', timeZone: 'America/Sao_Paulo' }).format(d)
  const wd = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'America/Sao_Paulo' }).format(d).replace('.', '')
  return (
    <Link to="/leiloes/proximos" className="group flex items-center gap-4 rounded-2xl border border-line bg-surface/70 py-2.5 pr-4 pl-2.5 transition-colors hover:border-accent/50">
      <span className="grid w-14 place-items-center rounded-xl bg-accent-soft py-1.5 text-accent-text">
        <span className="text-[11px] font-semibold tracking-[0.12em] uppercase">{wd}</span>
        <span className="tabular text-2xl leading-none font-bold">{day}</span>
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] text-subtle">Próximo leilão</span>
        {loading ? (
          <span className="skeleton mt-1 block h-4 w-28 rounded" />
        ) : (
          <span className="block text-[15px] font-semibold">
            {timeOnly(iso)} · {next ? `${next.lot_count} lotes` : 'horário oficial'}
          </span>
        )}
        <span className="block text-[13px] font-medium text-accent-text group-hover:underline">Ver agenda completa</span>
      </span>
    </Link>
  )
}

// =====================================================================
// FINAL CTA
// =====================================================================
const CTA_CARDS = [
  { x: '-4%', y: '16%', r: -18, ry: 24, hue: 0 },
  { x: '80%', y: '6%', r: 14, ry: -26, hue: 160 },
  { x: '86%', y: '56%', r: 24, ry: -18, hue: 290 },
]

function FinalCta() {
  const reduce = useReducedMotion()
  const { sx, sy } = usePointer()
  const ctaRef = useRef<HTMLElement>(null)
  const ctaInView = useInView(ctaRef)
  return (
    <section ref={ctaRef} className="mx-auto max-w-[1320px] px-5 pt-10 sm:px-8">
      <div className="relative isolate overflow-hidden rounded-[2rem] border border-accent/25 bg-[radial-gradient(120%_120%_at_50%_0%,rgb(64_217_208/.16),transparent_60%),linear-gradient(180deg,var(--surface),var(--bg-elevated))] px-6 py-16 sm:px-12 sm:py-20 [perspective:1400px]">
        <div aria-hidden className="dot-grid absolute inset-0 -z-10 opacity-30 [mask-image:radial-gradient(60%_70%_at_50%_50%,black,transparent)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
          {CTA_CARDS.map((c, i) => (
            <FloatingCard key={i} c={c} i={i} sx={sx} sy={sy} reduce={!!reduce} active={ctaInView} />
          ))}
        </div>
        <div className="relative z-10 mx-auto max-w-2xl text-center">
          <Sparkles aria-hidden className="mx-auto size-7 text-accent-text" />
          <h2 className="mt-4 text-[clamp(2rem,calc(1.2rem_+_2.8vw),3.4rem)] leading-[1.04]">A próxima carta da sua coleção está a um lance.</h2>
          <p className="mx-auto mt-4 max-w-lg text-[17px] text-muted">Crie sua conta em um minuto e receba o aviso quando o próximo leilão abrir ou quando seu Pokémon favorito aparecer.</p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 min-[460px]:flex-row">
            <Link
              to="/cadastro"
              className="group relative inline-flex h-14 items-center gap-2.5 overflow-hidden rounded-[14px] bg-ink px-7 text-[17px] font-semibold text-bg shadow-[0_1px_0_rgb(255_255_255/.12)_inset,0_10px_30px_-14px_rgb(0_0_0/.6)] transition-[transform,background-color] duration-200 hover:-translate-y-0.5 focus-visible:outline-offset-4 active:translate-y-0 active:scale-[.98]"
            >
              <span aria-hidden className="absolute inset-0 -translate-x-full bg-[linear-gradient(100deg,transparent,rgb(64_217_208/.35),transparent)] transition-transform duration-700 group-hover:translate-x-full" />
              <UserPlus aria-hidden className="relative size-5" />
              <span className="relative">Criar minha conta</span>
            </Link>
            <ButtonLink to="/leiloes" size="lg" variant="ghost">Ver leilões</ButtonLink>
          </div>
        </div>
      </div>
    </section>
  )
}

function FloatingCard({ c, i, sx, sy, reduce, active }: { c: (typeof CTA_CARDS)[number]; i: number; sx: MotionValue<number>; sy: MotionValue<number>; reduce: boolean; active: boolean }) {
  const ry = useTransform(sx, (v) => c.ry + v * 14)
  const rx = useTransform(sy, (v) => 8 - v * 10)
  return (
    <motion.div
      className="absolute w-[140px] lg:w-[164px]"
      style={{ left: c.x, top: c.y, rotateY: ry, rotateX: rx, rotateZ: c.r, transformStyle: 'preserve-3d' }}
      animate={reduce || !active ? undefined : { y: [0, -8, 0] }}
      transition={{ duration: 6 + i, repeat: Infinity, ease: 'easeInOut' }}
    >
      <Card3D depth={4} edge="#b8a785" className="relative aspect-[5/7] opacity-90">
        <div className="aspect-[5/7]">
          <BrandBack hue={c.hue} id={`cta${i}`} />
        </div>
      </Card3D>
    </motion.div>
  )
}
