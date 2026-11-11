import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView, useReducedMotion, useTransform, type MotionValue } from 'motion/react'
import { ArrowDown, ArrowRight, CalendarClock, Gavel } from 'lucide-react'
import { ButtonLink, Countdown, LiveBadge } from '@/components/ui'
import { BrandBack, Card3D } from '@/components/cards/Card3D'
import { useNow } from '@/hooks/useNow'
import { usePointer, useWidth } from '@/hooks/usePointer'
import { nextAuctionSlots } from '@/lib/domain'
import { timeOnly, weekdayTime } from '@/lib/format'
import type { Auction } from '@/lib/types'

export const scrollToTutorial = (e?: React.MouseEvent) => {
  e?.preventDefault()
  const el = document.getElementById('como-participar')
  if (!el) return
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  history.replaceState(null, '', '#como-participar')
}

const EASE = [0.2, 0.8, 0.2, 1] as const

export function Hero({ liveAuction, nextAuction }: { liveAuction?: Auction; nextAuction?: Auction }) {
  const reduce = useReducedMotion()
  const now = useNow(false)
  const slot = nextAuctionSlots(new Date(now), 1)[0]
  const enter = (d: number) => (reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay: d, ease: EASE } })
  return (
    <section className="relative isolate overflow-x-clip pt-20 lg:pt-24">
      <Atmosphere />
      <div className="shell grid items-center gap-y-6 lg:min-h-[min(760px,calc(100svh-6rem))] lg:grid-cols-12 lg:gap-x-10">
        {/* art first on phones: the brand moment is the first thing seen */}
        <div className="order-first lg:order-none lg:col-span-6 lg:col-start-7 lg:row-start-1">
          <HeroStage />
        </div>
        <div className="relative z-10 pb-12 lg:col-span-6 lg:row-start-1 lg:pb-16">
          <motion.div {...enter(0)}>
            <AuctionTicket liveAuction={liveAuction} nextAuction={nextAuction} slotIso={slot.starts.toISOString()} />
          </motion.div>
          <h1 className="t-display mt-7">
            <motion.span className="block sm:whitespace-nowrap" {...enter(0.08)}>Sua próxima carta.</motion.span>
            <motion.span className="block sm:whitespace-nowrap" {...enter(0.16)}>
              Seu{' '}
              <span className="relative inline-block text-accent-text">
                próximo lance.
                <svg aria-hidden viewBox="0 0 300 12" preserveAspectRatio="none" className="absolute -bottom-2.5 left-0 h-3 w-full text-accent/55">
                  <path d="M2 8c60-6 140-8 296-3" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </span>
            </motion.span>
          </h1>
          <motion.p {...enter(0.26)} className="t-lead mt-7 max-w-[30rem]">
            Os leilões da comunidade Gimmy Cards, sem enquetes. Fotos de frente e verso, lances registrados em ordem pelo servidor e seu pedido acompanhado até chegar em casa.
          </motion.p>
          <motion.div {...enter(0.34)} className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/leiloes"
              className="group inline-flex h-[52px] items-center justify-center gap-2.5 rounded-[14px] bg-accent pr-2 pl-6 text-base font-semibold text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/.35),0_1px_2px_rgb(0_0_0/.25)] transition-[background-color,transform] hover:bg-accent-strong focus-visible:outline-offset-4 active:scale-[.98]"
            >
              Explorar leilões
              <span className="grid size-9 place-items-center rounded-[10px] bg-accent-ink/10 transition-transform group-hover:translate-x-0.5">
                <ArrowRight aria-hidden className="size-4" />
              </span>
            </Link>
            <ButtonLink to="/regras" size="lg" variant="outline">Como funciona</ButtonLink>
          </motion.div>
          <motion.a {...enter(0.42)} href="#como-participar" onClick={scrollToTutorial} className="group mt-5 inline-flex items-center gap-2 text-[15px] font-semibold text-muted transition-colors hover:text-ink">
            <span className="grid size-7 place-items-center rounded-full border border-line-strong transition-colors group-hover:border-accent group-hover:text-accent-text">
              <ArrowDown aria-hidden className="size-3.5 transition-transform group-hover:translate-y-0.5" />
            </span>
            Como participar?
          </motion.a>
          <motion.dl {...enter(0.5)} className="mt-10 grid max-w-[32rem] grid-cols-3 divide-x divide-line border-t border-line pt-5">
            {[
              ['Ter. e qui.', 'às 19h'],
              ['24 horas', 'sem prorrogação'],
              ['Empate?', 'vale quem registrou antes'],
            ].map(([a, b]) => (
              <div key={a} className="px-3 first:pl-0">
                <dt className="text-[15px] font-semibold">{a}</dt>
                <dd className="text-[13px] leading-snug text-subtle">{b}</dd>
              </div>
            ))}
          </motion.dl>
        </div>
      </div>
    </section>
  )
}

/**
 * Atmosphere: the owner's fluid gradient, used as a static, masked light
 * source behind the art (no animated blur, no blend modes). The brand palette
 * stays in charge: the layer is low-opacity and fades into the background.
 */
function Atmosphere() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className="absolute top-[-10%] right-[-12%] h-[120%] w-[78%] bg-cover bg-center opacity-[0.42] [mask-image:radial-gradient(60%_55%_at_55%_45%,black,transparent_75%)] dark:opacity-[0.5] max-lg:top-[-6%] max-lg:right-[-30%] max-lg:h-[62%] max-lg:w-[160%]"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}brand/atmosfera.webp)` }}
      />
      <div className="dot-grid absolute inset-0 opacity-30 [mask-image:radial-gradient(55%_50%_at_70%_40%,black,transparent)]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-bg" />
    </div>
  )
}

/** Live/next auction ticket. Preserves the real countdown and access to the lots. */
function AuctionTicket({ liveAuction, nextAuction, slotIso }: { liveAuction?: Auction; nextAuction?: Auction; slotIso: string }) {
  if (liveAuction)
    return (
      <Link
        to={`/leiloes/${liveAuction.id}`}
        className="group inline-flex max-w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-live/35 bg-live-soft py-2 pr-2 pl-2.5 transition-colors hover:border-live/60"
      >
        <LiveBadge />
        <span className="min-w-0 truncate text-[14px] font-semibold">{liveAuction.title}</span>
        <span className="inline-flex items-center gap-2 rounded-xl bg-bg/70 px-2.5 py-1 text-[13px] text-muted">
          encerra em <Countdown to={liveAuction.ends_at} compact />
        </span>
        <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-live-text">
          <Gavel aria-hidden className="size-3.5" /> {liveAuction.lot_count} lotes <ArrowRight aria-hidden className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    )
  const iso = nextAuction?.starts_at ?? slotIso
  return (
    <Link
      to={nextAuction ? `/leiloes/${nextAuction.id}` : '/leiloes/proximos'}
      className="group inline-flex max-w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-line-strong bg-surface/70 py-2 pr-3 pl-2.5 backdrop-blur"
    >
      <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 text-[12px] font-bold tracking-[0.06em] text-accent-text uppercase">
        <CalendarClock aria-hidden className="size-3.5" /> Próximo leilão
      </span>
      <span className="text-[14px] font-semibold capitalize">{weekdayTime(iso)}</span>
      <span className="inline-flex items-center gap-2 text-[13px] text-muted">
        começa em <Countdown to={iso} compact label="Começa em" />
      </span>
      {nextAuction && <span className="text-[13px] text-subtle">· {timeOnly(nextAuction.starts_at)}</span>}
    </Link>
  )
}

// ---------------------------------------------------------------------
// Stage: designed at 600×560 and scaled to its column, so nothing is ever
// cropped. Mascot leaps over a hand of holographic cards.
// ---------------------------------------------------------------------
const W = 600
const H = 560

const HAND = [
  { x: -150, y: 248, r: -18, ry: 22, hue: 0, z: -60, d: 0.15 },
  { x: 0, y: 214, r: -2, ry: 0, hue: 150, z: -20, d: 0.25 },
  { x: 150, y: 248, r: 16, ry: -22, hue: 290, z: -60, d: 0.35 },
]

function HeroStage() {
  const ref = useRef<HTMLDivElement>(null)
  const w = useWidth(ref)
  const scale = w ? Math.min(1, w / W) : 1
  const inView = useInView(ref)
  const reduce = useReducedMotion()
  const { sx, sy } = usePointer()
  const mx = useTransform(sx, (v) => v * 22)
  const my = useTransform(sy, (v) => v * 14)
  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[600px]" style={{ height: H * scale }}>
      <div className="absolute top-0 left-1/2 origin-top [perspective:1400px]" style={{ width: W, height: H, transform: `translateX(-50%) scale(${scale})` }}>
        {/* portal rings: static, drawn once */}
        <svg aria-hidden viewBox="0 0 600 560" className="absolute inset-0">
          <defs>
            <radialGradient id="hero-core" cx="50%" cy="56%" r="48%">
              <stop offset="0" stopColor="#40D9D0" stopOpacity=".22" />
              <stop offset="1" stopColor="#40D9D0" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="300" cy="316" rx="270" ry="230" fill="url(#hero-core)" />
          <ellipse cx="300" cy="316" rx="232" ry="196" fill="none" stroke="currentColor" className="text-accent/25" strokeWidth="1.5" />
          <ellipse cx="300" cy="316" rx="268" ry="226" fill="none" stroke="currentColor" className="text-accent/12" strokeWidth="1" strokeDasharray="2 10" />
          <ellipse cx="300" cy="520" rx="200" ry="22" fill="#000" opacity=".28" />
        </svg>

        {/* hand of cards */}
        <motion.div className="absolute inset-0 [transform-style:preserve-3d]" style={{ x: useTransform(sx, (v) => v * -10), y: useTransform(sy, (v) => v * -6) }}>
          {HAND.map((c, i) => (
            <motion.div
              key={i}
              className="absolute top-0 left-1/2 -ml-[95px] w-[190px]"
              style={{ rotateZ: c.r, rotateY: c.ry, z: c.z, transformStyle: 'preserve-3d', transformOrigin: '50% 110%' }}
              initial={reduce ? { x: c.x, y: c.y } : { opacity: 0, x: 0, y: c.y + 70, rotateZ: 0 }}
              animate={{ opacity: 1, x: c.x, y: c.y, rotateZ: c.r }}
              transition={{ duration: 1, delay: c.d, ease: EASE }}
            >
              <Card3D depth={5} edge="#b8a785" className="relative aspect-[5/7]">
                <div className="aspect-[5/7]">
                  <BrandBack hue={c.hue} id={`hand${i}`} />
                </div>
              </Card3D>
            </motion.div>
          ))}
        </motion.div>

        {/* the mascot leaps over the hand */}
        <motion.div
          className="absolute top-[18px] left-[96px] w-[420px]"
          style={{ x: mx, y: my }}
          initial={reduce ? false : { opacity: 0, x: -60, y: 70, rotate: -10, scale: 0.92 }}
          animate={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
          transition={{ duration: 1.1, delay: 0.45, ease: EASE }}
        >
          <div className="float-y" data-paused={!inView || !!reduce}>
            <img
              src={`${import.meta.env.BASE_URL}mascot/saltando.webp`}
              alt="Gimmy, o dragão da Gimmy Cards, saltando animado sobre as cartas"
              width={900}
              height={595}
              fetchPriority="high"
              decoding="async"
              draggable={false}
              className="h-auto w-full select-none drop-shadow-[0_24px_28px_rgb(0_0_0/.35)]"
            />
          </div>
        </motion.div>

        <Sparkle x={70} y={150} s={22} d={0.9} />
        <Sparkle x={520} y={96} s={28} d={1.05} />
        <Sparkle x={540} y={300} s={16} d={1.2} />
      </div>
    </div>
  )
}

function Sparkle({ x, y, s, d }: { x: number; y: number; s: number; d: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.svg
      aria-hidden
      viewBox="0 0 24 24"
      className="absolute text-gold"
      style={{ left: x, top: y, width: s, height: s }}
      initial={reduce ? false : { opacity: 0, scale: 0.4, rotate: -30 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ duration: 0.6, delay: d, ease: EASE }}
    >
      <path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z" fill="currentColor" />
    </motion.svg>
  )
}

export type { MotionValue }
