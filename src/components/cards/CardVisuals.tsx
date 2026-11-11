import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Expand, Layers, RotateCcw, Sparkles, X, ZoomIn } from 'lucide-react'
import { cx, Tooltip } from '@/components/ui'
import { useImage } from '@/app/providers'
import { conditionLabel, CONDITIONS, languageMeta } from '@/lib/format'
import type { Card } from '@/lib/types'
import { Flag } from './Flag'

/** Pointer-driven tilt + holographic sheen. No-ops on touch and reduced motion. */
export function useTilt<T extends HTMLElement>(max = 10) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!fine || reduce) return
    let raf = 0
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width
      const y = (e.clientY - r.top) / r.height
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--mx', `${x * 100}%`)
        el.style.setProperty('--my', `${y * 100}%`)
        el.style.setProperty('--hue', `${(x - 0.5) * 60}deg`)
        el.style.setProperty('--holo-opacity', '0.38')
        el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * max}deg) rotateY(${(x - 0.5) * max}deg)`
      })
    }
    const leave = () => {
      cancelAnimationFrame(raf)
      el.style.transform = ''
      el.style.setProperty('--holo-opacity', el.dataset.holoRest ?? '0')
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
      cancelAnimationFrame(raf)
    }
  }, [max])
  return ref
}

export function CardImage({ path, alt, variant = 'thumb', className, eager }: { path: string | null; alt: string; variant?: 'thumb' | 'full'; className?: string; eager?: boolean }) {
  const img = useImage()
  const src = img(path, variant)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  if (!src || failed)
    return (
      <div className={cx('grid place-items-center bg-surface-2 text-subtle', className)} role="img" aria-label={`${alt} (sem foto)`}>
        <Layers aria-hidden className="size-8 opacity-50" />
      </div>
    )
  return (
    <div className={cx('relative overflow-hidden bg-surface-2', className)}>
      {!loaded && <div aria-hidden className="skeleton absolute inset-0" />}
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cx('size-full object-cover transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0')}
      />
    </div>
  )
}

export function LanguageTag({ value, className }: { value: Card['language']; className?: string }) {
  const m = languageMeta(value)
  return (
    <span className={cx('inline-flex h-7 items-center gap-1 rounded-full border border-line bg-surface-2 px-2.5 text-[13px] font-medium', className)} title={m.name}>
      <Flag lang={value} />
      <span>{m.label}</span>
      <span className="sr-only">({m.name})</span>
    </span>
  )
}

const condTone: Record<Card['condition'], string> = {
  M: 'text-success border-success/30 bg-success-soft',
  NM: 'text-accent-text border-accent/30 bg-accent-soft',
  SP: 'text-ink border-line-strong bg-surface-2',
  MP: 'text-warning border-warning/30 bg-warning-soft',
  HP: 'text-warning border-warning/30 bg-warning-soft',
  DM: 'text-danger border-danger/30 bg-danger-soft',
}
export function ConditionTag({ value, long }: { value: Card['condition']; long?: boolean }) {
  const hint = CONDITIONS.find((c) => c.value === value)?.hint ?? ''
  return (
    <Tooltip label={`${conditionLabel(value)} · ${hint}`}>
      <span tabIndex={0} className={cx('inline-flex h-7 items-center rounded-full border px-2.5 text-[13px] font-semibold', condTone[value])}>
        {long ? `${conditionLabel(value)} (${value})` : value}
      </span>
    </Tooltip>
  )
}

/** Front/back 3D flip with holo sheen. Button-operated (keyboard + touch friendly). */
export function FlipCard({ card, eager, className }: { card: Card; eager?: boolean; className?: string }) {
  const [flipped, setFlipped] = useState(false)
  const tilt = useTilt<HTMLDivElement>(8)
  return (
    <div className={cx('flip-scene', className)}>
      <div ref={tilt} data-holo-rest="0.16" className="holo rounded-[1.1rem] transition-transform duration-300 ease-out will-change-transform" style={{ ['--holo-opacity' as string]: 0.16 }}>
        <div className="flip-card relative aspect-[5/7] w-full" data-flipped={flipped}>
          <div className="flip-face absolute inset-0 overflow-hidden rounded-[1.1rem] border border-line shadow-soft">
            <CardImage path={card.front_path} alt={`${card.title}, frente`} variant="full" eager={eager} className="size-full" />
          </div>
          <div className="flip-face flip-back absolute inset-0 overflow-hidden rounded-[1.1rem] border border-line shadow-soft">
            <CardImage path={card.back_path} alt={`${card.title}, verso`} variant="full" className="size-full" />
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-pressed={flipped}
        className="mx-auto mt-3 flex h-10 items-center gap-2 rounded-full border border-line-strong px-4 text-sm font-semibold text-muted transition-colors hover:border-accent hover:text-accent-text"
      >
        <RotateCcw aria-hidden className={cx('size-4 transition-transform duration-500', flipped && '-rotate-180')} />
        {flipped ? 'Ver frente' : 'Ver verso'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------
// Lightbox for enlarged photos (front/back of every card in a lot)
// ---------------------------------------------------------------------
export interface Photo {
  path: string | null
  alt: string
  caption: ReactNode
}

export function Lightbox({ photos, index, onClose, onIndex }: { photos: Photo[]; index: number | null; onClose(): void; onIndex(i: number): void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const open = index !== null
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  const go = useCallback((dir: 1 | -1) => index !== null && onIndex((index + dir + photos.length) % photos.length), [index, onIndex, photos.length])
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, go])
  const p = index !== null ? photos[index] : null
  return (
    <dialog ref={ref} onCancel={(e) => (e.preventDefault(), onClose())} aria-label="Foto ampliada" className="m-0 size-full max-h-none max-w-none bg-transparent p-0 backdrop:bg-black/90">
      {p && (
        <div className="flex size-full flex-col text-white" onClick={(e) => e.target === e.currentTarget && onClose()}>
          <div className="flex items-center justify-between gap-4 p-4">
            <p className="text-sm text-white/80 tabular">
              {index! + 1} / {photos.length}
            </p>
            <button type="button" onClick={onClose} aria-label="Fechar foto ampliada" className="rounded-full bg-white/10 p-2.5 hover:bg-white/20">
              <X className="size-5" />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <AnimatePresence mode="wait">
              <motion.div key={index} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="h-full max-h-[78dvh] aspect-[5/7] max-w-full">
                <CardImage path={p.path} alt={p.alt} variant="full" eager className="size-full rounded-2xl" />
              </motion.div>
            </AnimatePresence>
            {photos.length > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="Foto anterior" className="absolute left-2 rounded-full bg-white/10 p-3 hover:bg-white/20 sm:left-6">
                  <ChevronLeft className="size-6" />
                </button>
                <button type="button" onClick={() => go(1)} aria-label="Próxima foto" className="absolute right-2 rounded-full bg-white/10 p-3 hover:bg-white/20 sm:right-6">
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}
          </div>
          <div className="p-5 text-center text-[15px] text-white/90">{p.caption}</div>
        </div>
      )}
    </dialog>
  )
}

/** Pokémon linked to a card (standardised catalogue). */
export function PokemonChips({ card }: { card: Card }) {
  if (!card.pokemon?.length) return null
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Pokémon da carta">
      {card.pokemon.map((p) => (
        <li key={p.id} className="inline-flex h-7 items-center gap-1 rounded-full border border-gold/40 bg-gold-soft px-2.5 text-[13px] font-medium">
          <Sparkles aria-hidden className="size-3 text-gold-text" /> {p.name}
        </li>
      ))}
    </ul>
  )
}

/**
 * Combo gallery. Layout adapts to the number of cards: few cards get large
 * tiles, big combos get a denser grid with progressive loading. Each card
 * keeps its own front/back toggle, zoom and data.
 */
export function ComboGallery({ cards }: { cards: Card[] }) {
  const n = cards.length
  const PAGE = n > 12 ? 12 : n
  const [shown, setShown] = useState(PAGE)
  const [lb, setLb] = useState<number | null>(null)
  const photos: Photo[] = cards.flatMap((c) => [
    { path: c.front_path, alt: `${c.title}, frente`, caption: `${c.title} · frente` },
    { path: c.back_path, alt: `${c.title}, verso`, caption: `${c.title} · verso` },
  ])
  const cols = n <= 2 ? 'grid-cols-2' : n === 3 ? 'grid-cols-2 sm:grid-cols-3' : n === 4 ? 'grid-cols-2' : n <= 9 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'
  const dense = n > 9
  return (
    <div>
      <ul className={cx('grid gap-4', cols)}>
        {cards.slice(0, shown).map((c, i) => (
          <ComboTile key={c.id} card={c} index={i} total={n} dense={dense} onZoom={(side) => setLb(i * 2 + side)} />
        ))}
      </ul>
      {shown < n && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <p className="text-[13px] text-subtle">Mostrando {shown} de {n} cartas</p>
          <button type="button" onClick={() => setShown((x) => Math.min(n, x + 12))} className="flex h-11 items-center gap-2 rounded-xl border border-line-strong px-5 font-semibold hover:border-accent">
            <Expand aria-hidden className="size-4" /> Mostrar mais {Math.min(12, n - shown)}
          </button>
        </div>
      )}
      <Lightbox photos={photos} index={lb} onClose={() => setLb(null)} onIndex={setLb} />
    </div>
  )
}

function ComboTile({ card: c, index, total, dense, onZoom }: { card: Card; index: number; total: number; dense: boolean; onZoom(side: 0 | 1): void }) {
  const [back, setBack] = useState(false)
  return (
    <li className="group flex flex-col rounded-[1.25rem] border border-line bg-surface p-2.5 transition-colors hover:border-accent/40">
      <div className="flip-scene relative">
        <button type="button" onClick={() => onZoom(back ? 1 : 0)} aria-label={`Ampliar ${c.title}, ${back ? 'verso' : 'frente'}`} className="block w-full rounded-[0.9rem] focus-visible:outline-offset-2">
          <div className="flip-card relative aspect-[5/7] w-full" data-flipped={back}>
            <div className="flip-face absolute inset-0">
              <CardImage path={c.front_path} alt={`${c.title}, frente`} variant="full" className="size-full rounded-[0.9rem]" />
            </div>
            <div className="flip-face flip-back absolute inset-0">
              <CardImage path={c.back_path} alt={`${c.title}, verso`} variant="full" className="size-full rounded-[0.9rem]" />
            </div>
          </div>
        </button>
        <span className="tabular pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">{index + 1}/{total}</span>
        <span aria-hidden className="pointer-events-none absolute right-2 bottom-2 grid size-8 place-items-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100"><ZoomIn className="size-4" /></span>
      </div>
      <div role="group" aria-label="Lado da carta" className="mt-2.5 grid grid-cols-2 rounded-xl bg-surface-2 p-1 text-[13px] font-semibold">
        {(['Frente', 'Verso'] as const).map((l, k) => (
          <button key={l} type="button" aria-pressed={back === (k === 1)} onClick={() => setBack(k === 1)} className={cx('h-8 rounded-lg transition-colors', back === (k === 1) ? 'bg-bg text-ink shadow-soft' : 'text-subtle hover:text-ink')}>
            {l}
          </button>
        ))}
      </div>
      <div className="flex flex-1 flex-col px-1 pt-3">
        <p className={cx('font-semibold leading-snug', dense ? 'text-[15px]' : 'text-[17px]')}>{c.title}</p>
        <p className="text-[13px] text-subtle">{c.collection || 'Coleção não informada'}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <LanguageTag value={c.language} />
          <ConditionTag value={c.condition} />
        </div>
        {!dense && <div className="mt-2"><PokemonChips card={c} /></div>}
      </div>
    </li>
  )
}
