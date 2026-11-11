import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowUpRight, Bell, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CreditCard, Gavel, Layers, LayoutGrid, Menu, Package, Settings, Timer, Users, Warehouse, X,
} from 'lucide-react'
import { useAuth } from '@/app/providers'
import { DemoBar, Logo, NotificationBell, ThemeToggle } from '@/components/layout/Chrome'
import { preferencesAllowed } from '@/components/layout/CookieNotice'
import { cx, Spinner } from '@/components/ui'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import { useQuery } from '@/hooks/useQuery'
import { api } from '@/lib/api'

type BadgeKey = 'orders' | 'proofs' | 'ship'
const GROUPS: { label: string; items: { to: string; icon: typeof Timer; label: string; end?: boolean; badge?: BadgeKey }[] }[] = [
  {
    label: 'Operação',
    items: [
      { to: '/admin', icon: LayoutGrid, label: 'Visão geral', end: true },
      { to: '/admin/leiloes', icon: Timer, label: 'Leilões' },
      { to: '/admin/cartas', icon: Layers, label: 'Cartas' },
      { to: '/admin/lances', icon: Gavel, label: 'Lances' },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { to: '/admin/pedidos', icon: Package, label: 'Pedidos', badge: 'orders' },
      { to: '/admin/pagamentos', icon: CreditCard, label: 'Pagamentos', badge: 'proofs' },
    ],
  },
  {
    label: 'Pessoas e entregas',
    items: [
      { to: '/admin/participantes', icon: Users, label: 'Participantes' },
      { to: '/admin/armazenamento', icon: Warehouse, label: 'Armazenamento', badge: 'ship' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/admin/notificacoes', icon: Bell, label: 'Notificações' },
      { to: '/admin/configuracoes', icon: Settings, label: 'Configurações' },
    ],
  },
]
const ALL = GROUPS.flatMap((g) => g.items)

function SideNav({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  const { profile } = useAuth()
  const o = useQuery('admin:badges', api.admin.overview, { live: { topic: 'any' }, poll: 60_000 })
  const badge = (k?: BadgeKey) =>
    !k || !o.data ? 0 : k === 'orders' ? o.data.overdue + o.data.transfers_active : k === 'proofs' ? o.data.proofs_pending : o.data.shipments_open
  const initials = (profile?.full_name ?? '').split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="flex h-full flex-col">
      <Link to="/admin" onClick={onNavigate} className={cx('flex items-center gap-2.5 pt-1 pb-5', collapsed ? 'justify-center' : 'px-2')} aria-label="Painel administrativo Gimmy Cards">
        <Logo size={collapsed ? 'xs' : 'sm'} />
        {!collapsed && <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-bold tracking-[0.12em] text-accent-text uppercase">Painel</span>}
      </Link>
      <nav aria-label="Administração" className="flex-1 space-y-5">
        {GROUPS.map((g) => (
          <div key={g.label}>
            {collapsed ? (
              <div aria-hidden className="mx-auto mb-2 h-px w-6 bg-line-strong" />
            ) : (
              <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-[0.14em] text-subtle uppercase">{g.label}</p>
            )}
            <ul className="space-y-0.5">
              {g.items.map((n) => {
                const b = badge(n.badge)
                return (
                  <li key={n.to}>
                    <NavLink
                      to={n.to}
                      end={n.end}
                      onClick={onNavigate}
                      title={collapsed ? n.label : undefined}
                      className={({ isActive }) =>
                        cx(
                          'group relative flex h-10 items-center gap-3 rounded-[12px] text-[14.5px] font-medium transition-colors',
                          collapsed ? 'justify-center' : 'px-3',
                          isActive ? 'bg-surface text-ink shadow-[0_6px_16px_-10px_rgb(0_0_0/.6)] ring-1 ring-line-strong' : 'text-muted hover:bg-surface-2/70 hover:text-ink',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && <span aria-hidden className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full bg-accent" />}
                          <n.icon aria-hidden className={cx('size-[18px] shrink-0', isActive && 'text-accent-text')} />
                          {collapsed ? <span className="sr-only">{n.label}</span> : <span className="flex-1">{n.label}</span>}
                          {b > 0 && (
                            <span className={cx('tabular grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-white', collapsed && 'absolute top-0.5 right-1.5')}>
                              {b}
                              <span className="sr-only"> pendentes</span>
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className={cx('mt-6 rounded-2xl border border-line bg-bg/40', collapsed ? 'p-2' : 'p-3')}>
        <div className={cx('flex items-center gap-2.5', collapsed && 'justify-center')}>
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-mint text-[12px] font-bold text-[#0b1218]">{initials}</span>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold">{profile?.full_name}</p>
              <p className="text-[12px] text-subtle">{profile?.role === 'super_admin' ? 'Administrador principal' : 'Administrador'}</p>
            </div>
          )}
        </div>
        <Link to="/" onClick={onNavigate} title={collapsed ? 'Ver site' : undefined} className="mt-2.5 flex h-9 items-center justify-center gap-1.5 rounded-[10px] border border-line-strong text-[13px] font-semibold hover:border-accent hover:text-accent-text">
          <ArrowUpRight aria-hidden className="size-3.5" />
          {collapsed ? <span className="sr-only">Ver site</span> : 'Ver site'}
        </Link>
      </div>
    </div>
  )
}

const COLLAPSE_KEY = 'gimmy-admin-sidebar'

export default function AdminLayout() {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === 'collapsed'
    } catch {
      return false
    }
  })
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])
  const toggle = () =>
    setCollapsed((c) => {
      try {
        if (preferencesAllowed()) localStorage.setItem(COLLAPSE_KEY, c ? 'open' : 'collapsed')
      } catch {
        /* ignore */
      }
      return !c
    })
  const current = ALL.find((n) => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)))
  return (
    <div className="relative min-h-dvh">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 -left-40 size-[44rem] rounded-full bg-[radial-gradient(closest-side,rgb(64_217_208/.10),transparent)]" />
        <div className="absolute right-[-10rem] bottom-[-10rem] size-[40rem] rounded-full bg-[radial-gradient(closest-side,rgb(131_230_206/.08),transparent)]" />
      </div>
      <a href="#admin-main" className="sr-only z-[100] rounded-xl bg-accent px-4 py-2 font-semibold text-accent-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Pular para o conteúdo
      </a>
      <aside
        className={cx(
          'fixed inset-y-3 left-3 z-40 hidden overflow-x-hidden overflow-y-auto rounded-[24px] border border-line-strong bg-bg-elevated/95 py-3 shadow-pop transition-[width] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] lg:block',
          collapsed ? 'w-[76px] px-2' : 'w-[248px] px-3',
        )}
      >
        <SideNav collapsed={collapsed} />
      </aside>
      <header className="bg-surface/85 safe-top sticky top-0 z-40 flex h-16 items-center justify-between border-b border-line px-4 lg:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label="Abrir menu" aria-expanded={open} className="grid size-10 place-items-center rounded-full border border-line-strong">
          <Menu className="size-5" />
        </button>
        <Logo size="xs" />
        <NotificationBell />
      </header>
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="fixed inset-0 z-50 bg-scrim lg:hidden" />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="safe-top fixed inset-y-0 left-0 z-50 w-[min(19rem,86vw)] overflow-y-auto border-r border-line-strong bg-bg-elevated p-3 lg:hidden"
              aria-label="Menu administrativo"
            >
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar menu" className="absolute top-3 right-3 z-10 grid size-10 place-items-center rounded-full hover:bg-surface-2">
                <X className="size-5" />
              </button>
              <SideNav onNavigate={() => setOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
      <div className={cx('transition-[padding] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]', collapsed ? 'lg:pl-[92px]' : 'lg:pl-[264px]')}>
        <div className="mx-auto hidden max-w-[1320px] items-center justify-between gap-4 px-8 pt-5 pb-2 lg:flex">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggle}
              aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
              aria-pressed={collapsed}
              className="grid size-9 place-items-center rounded-[10px] border border-line-strong text-muted transition-colors hover:border-accent hover:text-ink"
            >
              {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
            </button>
            <nav aria-label="Você está em" className="text-[14px] text-subtle">
              <Link to="/admin" className="hover:text-ink">Painel</Link>
              {current && current.to !== '/admin' && (
                <>
                  <span aria-hidden className="mx-2">/</span>
                  <span className="font-medium text-ink">{current.label}</span>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </div>
        <main id="admin-main" className="mx-auto max-w-[1320px] px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:pt-4">
          <ErrorBoundary resetKey={loc.pathname}>
            <Suspense fallback={<Spinner />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <DemoBar className={cx('bottom-5', collapsed ? 'lg:left-[104px]' : 'lg:left-[276px]')} />
    </div>
  )
}

export function AdminHeader({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <h1 className="text-[clamp(1.75rem,calc(1.3rem_+_1.2vw),2.35rem)] leading-tight font-bold tracking-[-0.015em]">{title}</h1>
        {children && <div className="mt-1.5 text-[15px] text-muted">{children}</div>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </header>
  )
}

/** Admin surface. Solid (no backdrop blur): dozens of these render at once. */
export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-[22px] border border-line bg-surface/85 p-5 shadow-soft sm:p-6', className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-[17px] font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function FilterTabs<T extends string>({ value, onChange, options }: { value: T; onChange(v: NoInfer<T>): void; options: { value: NoInfer<T>; label: string; count?: number }[] }) {
  return (
    <div className="-mx-1 mb-5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      <div role="tablist" className="inline-flex gap-0.5 rounded-[14px] border border-line bg-surface-2/40 p-[3px]">
        {options.map((o) => {
          const on = value === o.value
          return (
            <button
              key={o.value}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => onChange(o.value)}
              className={cx('relative flex h-9 shrink-0 items-center gap-2 rounded-[11px] px-3.5 text-[14px] font-medium transition-colors', on ? 'text-ink' : 'text-muted hover:text-ink')}
            >
              {on && <span aria-hidden className="absolute inset-0 rounded-[11px] border border-line-strong bg-surface shadow-[0_6px_14px_-8px_rgb(0_0_0/.5)]" />}
              <span className="relative">{o.label}</span>
              {o.count !== undefined && (
                <span className={cx('tabular relative rounded-full px-1.5 text-[12px]', on ? 'bg-accent-soft text-accent-text' : 'bg-surface-3/60')}>{o.count}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Client-side pagination for admin tables. */
export function usePaged<T>(items: T[], size = 25) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(items.length / size))
  useEffect(() => {
    if (page > pages - 1) setPage(0)
  }, [pages, page])
  const slice = useMemo(() => items.slice(page * size, page * size + size), [items, page, size])
  return { slice, page, pages, setPage, total: items.length, from: items.length ? page * size + 1 : 0, to: Math.min(items.length, page * size + size) }
}

export function Pager({ page, pages, setPage, from, to, total }: { page: number; pages: number; setPage(p: number): void; from: number; to: number; total: number }) {
  if (total === 0) return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-[13px] text-subtle">
      <span className="tabular">
        {from}–{to} de {total}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => setPage(page - 1)} disabled={page === 0} aria-label="Página anterior" className="grid size-8 place-items-center rounded-lg border border-line-strong disabled:opacity-35 hover:border-accent">
          <ChevronLeft className="size-4" />
        </button>
        <span className="tabular px-2">{page + 1} / {pages}</span>
        <button type="button" onClick={() => setPage(page + 1)} disabled={page >= pages - 1} aria-label="Próxima página" className="grid size-8 place-items-center rounded-lg border border-line-strong disabled:opacity-35 hover:border-accent">
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}
