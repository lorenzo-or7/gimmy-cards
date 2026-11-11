import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { motion } from 'motion/react'
import { cx } from '@/components/ui'
import { Mascot, type MascotPose } from '@/components/brand/Mascot'

/** Page shell: shared max width, gutters and top offset below the floating navbar. */
export function Page({ children, className, narrow }: { children: ReactNode; className?: string; narrow?: boolean }) {
  return (
    <div className={cx('shell pt-28 pb-6 lg:pt-32', className)}>
      <div className={cx(narrow && 'mx-auto max-w-3xl')}>{children}</div>
    </div>
  )
}

/**
 * Editorial page header. With `mascot`, the title sits on a soft panel and the
 * official illustration anchors the right side (hidden on narrow phones so the
 * content stays first).
 */
export function PageHeader({
  eyebrow, title, children, action, mascot,
}: { eyebrow?: string; title: ReactNode; children?: ReactNode; action?: ReactNode; mascot?: MascotPose }) {
  if (!mascot)
    return (
      <header className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          {eyebrow && <p className="t-eyebrow mb-2.5">{eyebrow}</p>}
          <h1 className="t-h1">{title}</h1>
          {children && <div className="t-lead mt-3">{children}</div>}
        </div>
        {action}
      </header>
    )
  return (
    <header className="relative mb-10 overflow-hidden rounded-[28px] border border-line bg-surface/60">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_120%_at_100%_0%,rgb(64_217_208/.14),transparent_60%)]" />
      <div aria-hidden className="dot-grid pointer-events-none absolute inset-0 opacity-25 [mask-image:radial-gradient(50%_80%_at_90%_40%,black,transparent)]" />
      <div className="relative grid items-end gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] lg:p-10">
        <div className="max-w-2xl">
          {eyebrow && <p className="t-eyebrow mb-2.5">{eyebrow}</p>}
          <h1 className="t-h1">{title}</h1>
          {children && <div className="t-lead mt-3">{children}</div>}
          {action && <div className="mt-6 flex flex-wrap gap-3">{action}</div>}
        </div>
        <motion.div
          initial={{ opacity: 0, y: 18, rotate: -4 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
          className="-mb-10 hidden self-end justify-self-end md:block lg:-mb-12"
        >
          <Mascot pose={mascot} width={mascot === 'voando' ? 320 : 170} eager />
        </motion.div>
      </div>
    </header>
  )
}

/** Segmented tabs with a gliding capsule for the active route. */
export function Tabs({ items, label }: { items: { to: string; label: ReactNode; end?: boolean }[]; label: string }) {
  return (
    <nav aria-label={label} className="-mx-[var(--gutter)] mb-8 overflow-x-auto px-[var(--gutter)] [scrollbar-width:none] sm:mx-0 sm:px-0">
      <ul className="inline-flex gap-0.5 rounded-[14px] border border-line bg-surface-2/40 p-[3px]">
        {items.map((i) => (
          <li key={i.to}>
            <NavLink
              to={i.to}
              end={i.end}
              className={({ isActive }) => cx('relative flex h-10 items-center rounded-[11px] px-4 text-[14.5px] font-medium whitespace-nowrap transition-colors', isActive ? 'text-ink' : 'text-muted hover:text-ink')}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span layoutId={`tabs-${label}`} aria-hidden className="absolute inset-0 rounded-[11px] border border-line-strong bg-surface shadow-[0_6px_14px_-8px_rgb(0_0_0/.5)]" transition={{ type: 'spring', stiffness: 460, damping: 38 }} />
                  )}
                  <span className="relative">{i.label}</span>
                  {isActive && <span aria-hidden className="relative ml-2 size-1.5 rounded-full bg-accent" />}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export const ACCOUNT_TABS = [
  { to: '/conta', label: 'Perfil', end: true },
  { to: '/conta/lances', label: 'Meus lances' },
  { to: '/conta/arremates', label: 'Arremates' },
  { to: '/conta/pedidos', label: 'Pedidos' },
  { to: '/conta/armazenadas', label: 'Armazenadas' },
  { to: '/conta/favoritos', label: 'Favoritos' },
  { to: '/notificacoes', label: 'Notificações' },
]
