import { useEffect, useRef, useState } from 'react'
import { useInView } from 'motion/react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { cx } from '@/components/ui'
import { CardImage, LanguageTag } from '@/components/cards/CardVisuals'
import { money } from '@/lib/format'
import type { Lot } from '@/lib/types'

/**
 * Horizontal strip of single-card lots. Vertical wheel/trackpad scrolling
 * always reaches the page: the track is overflow-y:hidden (so it never
 * becomes a vertical scroller), no wheel/touch listener calls
 * preventDefault, and drag-to-scroll uses pointer events for mice only.
 */
export function Featured({ lots, loading }: { lots: Lot[]; loading: boolean }) {
  const track = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const visible = useInView(sectionRef)
  const [edges, setEdges] = useState({ start: true, end: false })
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null)

  const update = () => {
    const el = track.current
    if (!el) return
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 })
  }
  useEffect(update, [lots.length])

  if (!loading && lots.length === 0) return null
  const page = (dir: 1 | -1) => {
    const el = track.current
    if (!el) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <section ref={sectionRef} aria-labelledby="feat-title" className="relative overflow-x-clip py-16 lg:py-24">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-end justify-between gap-4 px-5 sm:px-8">
        <div>
          <p className="mb-2.5 text-[13px] font-semibold tracking-[0.14em] text-accent-text uppercase">Destaques</p>
          <h2 id="feat-title" className="text-[clamp(2rem,calc(1.3rem_+_2.4vw),3.1rem)] leading-[1.05]">Cartas em destaque</h2>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/catalogo" className="mr-2 inline-flex items-center gap-1.5 text-[15px] font-semibold text-accent-text hover:underline">
            Ver catálogo <ArrowRight aria-hidden className="size-4" />
          </Link>
          <button type="button" onClick={() => page(-1)} disabled={edges.start} aria-label="Cartas anteriores" aria-controls="featured-track" className="grid size-10 place-items-center rounded-full border border-line-strong transition-colors hover:border-accent disabled:opacity-35">
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" onClick={() => page(1)} disabled={edges.end} aria-label="Próximas cartas" aria-controls="featured-track" className="grid size-10 place-items-center rounded-full border border-line-strong transition-colors hover:border-accent disabled:opacity-35">
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>
      <div aria-hidden className="pointer-events-none mt-8 overflow-hidden whitespace-nowrap select-none">
        <div style={{ animationPlayState: visible ? 'running' : 'paused' }} className="inline-flex animate-[marquee_60s_linear_infinite] text-[clamp(3.5rem,10vw,8.5rem)] leading-none font-bold tracking-[-0.03em] text-line-strong">
          <span data-text="Lance · Arremate · Coleção · Comunidade ·" className="pr-[0.4em] before:content-[attr(data-text)]" />
          <span data-text="Lance · Arremate · Coleção · Comunidade ·" className="pr-[0.4em] before:content-[attr(data-text)]" />
        </div>
      </div>
      <div
        ref={track}
        id="featured-track"
        role="region"
        aria-label="Cartas em destaque, role horizontalmente"
        tabIndex={0}
        onScroll={update}
        onPointerDown={(e) => {
          if (e.pointerType !== 'mouse' || e.button !== 0) return
          drag.current = { x: e.clientX, left: track.current!.scrollLeft, moved: false }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) return
          const dx = e.clientX - d.x
          if (Math.abs(dx) > 5) d.moved = true
          if (d.moved) track.current!.scrollLeft = d.left - dx
        }}
        onPointerUp={() => setTimeout(() => (drag.current = null), 0)}
        onPointerLeave={() => (drag.current = null)}
        onClickCapture={(e) => {
          if (drag.current?.moved) e.preventDefault()
        }}
        className={cx(
          'relative -mt-[clamp(1.5rem,4vw,3.25rem)] overflow-x-auto overflow-y-hidden overscroll-x-contain pt-5 pb-6 [scrollbar-width:none] focus-visible:outline-offset-[-4px] [&::-webkit-scrollbar]:hidden',
          'snap-x snap-proximity cursor-grab active:cursor-grabbing',
        )}
      >
        <ul className="flex w-max gap-5 px-5 sm:px-8">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <li key={i} className="skeleton aspect-[5/7] w-44 rounded-2xl sm:w-52" />)
            : lots.map((l, i) => (
                <li key={l.id} className="w-44 shrink-0 snap-start sm:w-52">
                  <Link
                    to={`/lote/${l.id}`}
                    draggable={false}
                    className="group block rounded-2xl pb-1 transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] [perspective:900px] hover:-translate-y-1.5"
                  >
                    <div
                      className="holo holo-hover overflow-hidden rounded-2xl shadow-pop ring-1 ring-line transition-transform duration-500 group-hover:![transform:rotateY(0deg)]"
                      style={{ transform: `rotateY(${i % 2 ? -6 : 6}deg)`, ['--holo-opacity' as string]: 0.12 }}
                    >
                      <CardImage path={l.cards[0]?.front_path ?? null} alt={l.title} className="aspect-[5/7]" />
                    </div>
                    <p className="mt-3 line-clamp-2 min-h-[2.6em] text-[15px] leading-snug font-semibold">{l.title}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      {l.cards[0] && <LanguageTag value={l.cards[0].language} className="h-6 text-[12px]" />}
                      <span className="tabular text-[15px] font-bold">{money(l.current_price ?? l.starting_price)}</span>
                    </div>
                  </Link>
                </li>
              ))}
        </ul>
      </div>
    </section>
  )
}
