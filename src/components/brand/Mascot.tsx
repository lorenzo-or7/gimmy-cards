import { clsx as cx } from 'clsx'

/**
 * Official Gimmy mascot library: ten poses of the original art, trimmed and
 * converted to WebP (900px + `-sm` 360px, transparency kept). Originals live
 * in `assets/mascot-originals/`.
 *
 * Use poses by context, never as filler:
 * - auctioneer · collector · jumping · flying: page identity (headers, hero)
 * - happy · waving: welcome, all-clear states
 * - sleeping: nothing happening yet (empty lists)
 * - confused: no results, help, tutorials
 * - sad: recoverable errors only
 * - celebrating: only after the server confirmed a success
 */
const POSES = {
  auctioneer: { file: 'leiloeiro', w: 900, h: 1132, alt: 'Gimmy segurando um martelo de leilão' },
  collector: { file: 'cartas', w: 900, h: 1158, alt: 'Gimmy abraçando cartas colecionáveis' },
  happy: { file: 'animado', w: 896, h: 1414, alt: 'Gimmy sentado e sorridente' },
  sleeping: { file: 'dormindo', w: 900, h: 1206, alt: 'Gimmy dormindo enrolado' },
  flying: { file: 'voando', w: 900, h: 293, alt: 'Gimmy, o dragão da Gimmy Cards, voando' },
  jumping: { file: 'saltando', w: 900, h: 595, alt: 'Gimmy, o dragão da Gimmy Cards, saltando animado' },
  waving: { file: 'acenando', w: 894, h: 1248, alt: 'Gimmy acenando e sorrindo' },
  sad: { file: 'triste', w: 900, h: 1312, alt: 'Gimmy triste, com uma lágrima' },
  celebrating: { file: 'comemorando', w: 869, h: 1399, alt: 'Gimmy comemorando' },
  confused: { file: 'confuso', w: 900, h: 1336, alt: 'Gimmy pensativo, com pontos de interrogação' },
} as const

/** Earlier (Portuguese) pose names keep working. */
const LEGACY = {
  leiloeiro: 'auctioneer',
  cartas: 'collector',
  animado: 'happy',
  dormindo: 'sleeping',
  voando: 'flying',
  saltando: 'jumping',
} as const

export type MascotName = keyof typeof POSES
export type MascotPose = MascotName | keyof typeof LEGACY

export const resolvePose = (pose: MascotPose): MascotName => (pose in LEGACY ? LEGACY[pose as keyof typeof LEGACY] : (pose as MascotName))

/** Public URL of a pose; `small` picks the 360px file. */
export function mascotSrc(pose: MascotPose, small = false) {
  return `/mascot/${POSES[resolvePose(pose)].file}${small ? '-sm' : ''}.webp`
}

/**
 * The whole illustration is always shown as-is (no crop, no recolouring, no
 * distortion). `decorative` hides it from screen readers when the surrounding
 * text already carries the meaning. `motion` adds a short entrance (CSS,
 * disabled under prefers-reduced-motion).
 */
export function Mascot({
  pose,
  width,
  className,
  decorative = true,
  eager,
  motion,
}: {
  pose: MascotPose
  width: number
  className?: string
  decorative?: boolean
  eager?: boolean
  motion?: 'rise' | 'wave' | 'pop'
}) {
  const name = resolvePose(pose)
  const p = POSES[name]
  return (
    <img
      src={mascotSrc(name, width <= 220)}
      alt={decorative ? '' : p.alt}
      aria-hidden={decorative || undefined}
      data-mascot={name}
      width={width}
      height={Math.round((width * p.h) / p.w)}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      className={cx('pointer-events-none h-auto shrink-0 select-none', motion && `mascot-${motion}`, className)}
      style={{ width }}
    />
  )
}
