import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { Crown, Gavel, Layers, Users, Zap } from 'lucide-react'
import { Badge, Countdown, cx, LiveBadge } from '@/components/ui'
import { CardImage, ConditionTag, LanguageTag, useTilt } from '@/components/cards/CardVisuals'
import { LOT_STATUS, money } from '@/lib/format'
import type { Lot } from '@/lib/types'
import { useNowAt } from '@/hooks/useNow'

export function lotPhase(lot: Lot, startsAt: string | undefined, now: number) {
  if (lot.status !== 'open') return 'ended' as const
  if (startsAt && new Date(startsAt).getTime() > now) return 'upcoming' as const
  if (new Date(lot.ends_at).getTime() <= now) return 'ended' as const
  return 'live' as const
}

export function LotStatusBadge({ lot, startsAt }: { lot: Lot; startsAt?: string }) {
  const now = useNowAt([startsAt, lot.ends_at])
  const phase = lotPhase(lot, startsAt, now)
  if (phase === 'live') return <LiveBadge size="sm" />
  if (phase === 'upcoming') return <Badge tone="neutral">Em breve</Badge>
  if (lot.status === 'sold') return <Badge tone="gold"><Zap aria-hidden className="size-3.5" /> Arrematado</Badge>
  if (lot.status === 'open') return <Badge tone="neutral">Encerrando…</Badge>
  return <Badge tone={lot.status === 'closed' ? 'success' : 'neutral'}>{LOT_STATUS[lot.status]}</Badge>
}

/**
 * Lot tile. Same skeleton for every lot: status row → artwork frame →
 * two-line title → meta row → highlighted price block. The frame is a bit
 * shorter than a card (6:7) and the card is shown whole inside it, so tiles
 * stay compact without cropping the art. Combos change only the frame content.
 */
export function LotTile({ lot, startsAt, index = 0 }: { lot: Lot; startsAt?: string; index?: number }) {
  const tilt = useTilt<HTMLDivElement>(5)
  const reduce = useReducedMotion()
  const now = useNowAt([startsAt, lot.ends_at])
  const phase = lotPhase(lot, startsAt, now)
  const cover = lot.cards[0]
  const price = lot.current_price ?? lot.starting_price
  const shownPrice = phase === 'ended' && lot.winning_amount ? lot.winning_amount : price
  const collections = [...new Set(lot.cards.map((c) => c.collection).filter(Boolean))]
  const priceLabel = phase === 'ended' ? (lot.winning_amount ? 'Valor final' : 'Lance inicial') : lot.current_price ? 'Maior lance' : 'Lance inicial'
  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ duration: 0.45, delay: Math.min(index, 6) * 0.05, ease: [0.2, 0.8, 0.2, 1] }}
      className="group relative h-full"
    >
      <Link
        to={`/lote/${lot.id}`}
        className="block h-full rounded-[1.25rem] focus-visible:outline-offset-4"
        aria-label={`${lot.title}${lot.kind === 'combo' ? `, combo com ${lot.card_count} cartas` : ''}, ${priceLabel.toLowerCase()} ${money(shownPrice)}`}
      >
        <div
          ref={tilt}
          style={{ ['--holo-opacity' as string]: 0 }}
          className="flex h-full flex-col rounded-[1.25rem] border border-line bg-surface p-2.5 shadow-soft transition-[transform,border-color,box-shadow] duration-300 ease-out group-hover:border-accent/40 group-hover:shadow-pop"
        >
          {/* status row: reserved space, never on top of the art */}
          <div className="mb-2 flex h-7 items-center justify-between gap-2 px-0.5">
            <LotStatusBadge lot={lot} startsAt={startsAt} />
            {lot.kind === 'combo' ? (
              <Badge tone="mint"><Layers aria-hidden className="size-3.5" /> {lot.card_count} cartas</Badge>
            ) : lot.is_winner ? (
              <Badge tone="gold"><Crown aria-hidden className="size-3.5" /> Seu</Badge>
            ) : null}
          </div>

          <div className="relative aspect-[6/7] overflow-hidden rounded-[0.9rem] bg-surface-2 bg-[radial-gradient(90%_70%_at_50%_100%,var(--accent-soft),transparent_70%)]">
            {lot.kind === 'combo' ? (
              <ComboStack lot={lot} />
            ) : (
              <div className="holo holo-hover absolute top-1/2 left-1/2 aspect-[5/7] h-[88%] -translate-x-1/2 -translate-y-1/2 rounded-[0.6rem] shadow-[0_14px_30px_-14px_rgb(0_0_0/.65)] transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:-translate-y-[53%]">
                <CardImage path={cover?.front_path ?? null} alt={cover ? `${cover.title}, frente` : lot.title} className="size-full rounded-[0.6rem]" />
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col px-1 pt-3">
            <h3 className="line-clamp-2 min-h-[2.6em] text-[16px] leading-[1.3] font-semibold" title={lot.title}>{lot.title}</h3>
            <div className="mt-1.5 flex min-h-7 flex-wrap items-center gap-1.5">
              {lot.kind === 'single' && cover ? (
                <>
                  <LanguageTag value={cover.language} />
                  <ConditionTag value={cover.condition} />
                </>
              ) : (
                <p className="line-clamp-1 text-[13px] text-subtle">{collections.length ? collections.join(' · ') : `${lot.card_count} cartas no conjunto`}</p>
              )}
            </div>

            <div className="mt-auto pt-2.5">
              <div className="flex items-end justify-between gap-3 rounded-xl bg-bg/60 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold tracking-[0.08em] text-subtle uppercase">{priceLabel}</p>
                  <p className={cx('tabular text-[22px] leading-tight font-bold', phase === 'live' && lot.current_price && 'text-accent-text')}>{money(shownPrice)}</p>
                </div>
                <div className="shrink-0 text-right text-[13px] leading-snug text-subtle">
                  {phase === 'live' ? (
                    <>
                      <p className="flex items-center justify-end gap-1" title={`${lot.bid_count} lances de ${lot.bidder_count} participantes`}>
                        <Gavel aria-hidden className="size-3.5" /> {lot.bid_count}
                        <Users aria-hidden className="ml-1 size-3.5" /> {lot.bidder_count}
                      </p>
                      <Countdown to={lot.ends_at} compact />
                    </>
                  ) : phase === 'ended' && lot.winner_alias ? (
                    <p>
                      <span className="block">Vencedor</span>
                      <span className="font-semibold text-ink">{lot.winner_alias}</span>
                    </p>
                  ) : lot.buyout_price ? (
                    <p>
                      <span className="block">Arremate</span>
                      <span className="tabular font-semibold text-ink">{money(lot.buyout_price)}</span>
                    </p>
                  ) : null}
                </div>
              </div>
              {phase !== 'ended' && lot.my_rank != null && (
                <p className={cx('mt-2 rounded-xl px-3 py-1.5 text-[13px] font-semibold', lot.my_rank === 1 ? 'bg-accent-soft text-accent-text' : 'bg-warning-soft text-warning')}>
                  {lot.my_rank === 1 ? 'Você lidera este lote' : `Você está em ${lot.my_rank}º lugar`}
                </p>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.article>
  )
}

/** Combo artwork: up to four cards fanned inside the same frame. */
function ComboStack({ lot }: { lot: Lot }) {
  const cards = lot.cards.slice(0, 4)
  const n = cards.length
  return (
    <div className="absolute inset-0">
      {cards.map((c, i) => {
        const mid = (n - 1) / 2
        return (
          <div
            key={c.id}
            className="absolute top-[8%] left-1/2 aspect-[5/7] h-[78%] transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:-translate-y-[3%]"
            style={{ transform: `translateX(calc(-50% + ${(i - mid) * 22}%)) rotate(${(i - mid) * 8}deg)`, transformOrigin: '50% 120%', zIndex: i }}
          >
            <CardImage path={c.front_path} alt="" className="size-full rounded-lg shadow-[0_12px_28px_-10px_rgb(0_0_0/.6)] ring-1 ring-white/15" />
          </div>
        )
      })}
      {lot.card_count > n && (
        <span className="absolute right-2.5 bottom-2.5 z-10 rounded-full bg-black/65 px-2.5 py-1 text-[12px] font-semibold text-white backdrop-blur">+{lot.card_count - n}</span>
      )}
    </div>
  )
}

export function LotGridSkeleton({ n = 4 }: { n?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="rounded-[1.25rem] border border-line bg-surface p-2.5">
          <div className="skeleton mb-2 h-7 w-24 rounded-full" />
          <div className="skeleton aspect-[6/7] rounded-[0.9rem]" />
          <div className="skeleton mt-3 h-5 w-3/4 rounded-lg" />
          <div className="skeleton mt-3 h-12 rounded-xl" />
        </div>
      ))}
    </div>
  )
}
