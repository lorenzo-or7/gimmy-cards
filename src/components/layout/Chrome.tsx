import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  ArrowUpRight, Bell, BookOpen, CalendarClock, ChevronDown, FlaskConical, Gavel, Gift, Heart, Home, LayoutDashboard,
  LogIn, LogOut, Moon, Package, RotateCcw, Sun, Timer, Trophy, User, UserRound, Users, Warehouse,
} from 'lucide-react'
import { useAuth, useBackend, useTheme, useToast } from '@/app/providers'
import { cx } from '@/components/ui'
import { api } from '@/lib/api'
import { useQuery } from '@/hooks/useQuery'
import { NotificationItem } from './NotificationItem'
import { openCookieNotice } from './CookieNotice'

/** Official logo, never stretched: width drives height via the intrinsic ratio (752×632). */
export function Logo({ className, size = 'md' }: { className?: string; size?: 'xs' | 'nav' | 'sm' | 'md' | 'lg' }) {
  const w = { xs: 60, nav: 66, sm: 76, md: 104, lg: 220 }[size]
  return (
    <img
      src={size === 'lg' ? '/brand/gimmy-cards-logo.webp' : '/brand/gimmy-cards-logo-sm.webp'}
      alt="Gimmy Cards"
      width={w}
      height={Math.round(w * (632 / 752))}
      className={cx('block h-auto shrink-0 select-none', className)}
      draggable={false}
      style={{ width: w }}
    />
  )
}

/**
 * One control language for the site header: borderless 40px round buttons
 * that only gain a soft fill on hover/press. Focus keeps the global ring.
 */
export const HEADER_ICON_BTN =
  'relative grid size-10 shrink-0 place-items-center rounded-full text-muted transition-[background-color,color,transform] duration-200 hover:bg-ink/[.07] hover:text-ink active:scale-[.94] aria-expanded:bg-ink/[.07] aria-expanded:text-ink'

/**
 * Theme switch. `variant="icon"` is the header button (sun/moon swap);
 * the default pill track is kept for the admin top bar.
 */
export function ThemeToggle({ className, variant = 'switch' }: { className?: string; variant?: 'switch' | 'icon' }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  if (variant === 'icon')
    return (
      <button type="button" onClick={toggle} role="switch" aria-checked={!dark} aria-label={dark ? 'Mudar para tema claro' : 'Mudar para tema escuro'} title={dark ? 'Tema claro' : 'Tema escuro'} className={cx(HEADER_ICON_BTN, className)}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={theme} aria-hidden initial={{ rotate: -60, scale: 0.5, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} exit={{ rotate: 60, scale: 0.5, opacity: 0 }} transition={{ duration: 0.2 }}>
            {dark ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
          </motion.span>
        </AnimatePresence>
      </button>
    )
  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={!dark}
      aria-label={dark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      className={cx('group relative flex h-9 w-[3.75rem] shrink-0 items-center rounded-full border border-line-strong bg-surface-2/80 p-[3px] transition-colors hover:border-accent/60', className)}
    >
      <span aria-hidden className="absolute inset-0 flex items-center justify-between px-2.5 text-subtle">
        <Moon className="size-3.5" />
        <Sun className="size-3.5" />
      </span>
      <span
        aria-hidden
        className={cx(
          'relative grid size-7 place-items-center rounded-full bg-ink text-bg shadow-[0_2px_8px_-2px_rgb(0_0_0/.4)] transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)]',
          !dark && 'translate-x-[1.5rem]',
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={theme} initial={{ rotate: -90, scale: 0.4, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} exit={{ rotate: 90, scale: 0.4, opacity: 0 }} transition={{ duration: 0.22 }}>
            {dark ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
  )
}

function useScrolled(px = 8) {
  const [s, setS] = useState(false)
  useEffect(() => {
    const on = () => setS(window.scrollY > px)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [px])
  return s
}

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close()
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', k)
    return () => {
      document.removeEventListener('mousedown', h)
      document.removeEventListener('keydown', k)
    }
  }, [open, close])
  return ref
}

/**
 * Plain text link. The only active indicator is a short cyan line under the
 * label; one shared layoutId lets it glide between every link of the bar
 * (across the logo too). Weight never changes, so labels never reflow.
 */
function NavItem({ to, children, end }: { to: string; children: string; end?: boolean }) {
  const reduce = useReducedMotion()
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cx(
          'relative flex h-10 items-center rounded-full px-3 text-[14.5px] font-medium tracking-[-0.005em] whitespace-nowrap transition-colors duration-200 xl:px-3.5',
          isActive ? 'text-ink' : 'text-muted hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {children}
          {isActive && (
            <motion.span
              layoutId="nav-underline"
              aria-hidden
              className="absolute bottom-[5px] left-1/2 h-[2px] w-[18px] -translate-x-1/2 rounded-full bg-accent"
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }}
            />
          )}
        </>
      )}
    </NavLink>
  )
}

// ---------------------------------------------------------------------
// Notification bell (realtime + polling fallback)
// ---------------------------------------------------------------------
export function NotificationBell({ plain }: { plain?: boolean }) {
  const { session } = useAuth()
  const { data, reload } = useQuery(`notif:${session?.userId}`, () => api.notifications(8), {
    enabled: !!session,
    live: { topic: 'notifications', id: session?.userId },
    poll: 45_000,
  })
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])
  if (!session) return null
  const unread = data?.unread ?? 0
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unread ? `Notificações, ${unread} não lidas` : 'Notificações'}
        className={plain ? HEADER_ICON_BTN : 'relative grid size-9 place-items-center rounded-full border border-line-strong bg-surface-2/80 text-ink transition-colors hover:border-accent/60'}
      >
        <Bell aria-hidden className={plain ? 'size-[18px]' : 'size-[17px]'} />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className={cx(
                'tabular absolute grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink ring-2',
                plain ? 'top-0.5 right-0.5 ring-[var(--bg-elevated)]' : '-top-1 -right-1 ring-bg',
              )}
            >
              {unread > 9 ? '9+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="glass fixed top-[4.75rem] right-3 left-3 z-[70] origin-top-right rounded-3xl border border-line-strong p-2 shadow-pop sm:absolute sm:top-12 sm:right-0 sm:left-auto sm:w-[25rem]"
          >
            <div className="flex items-center justify-between px-3 py-2">
              <p className="font-semibold">Notificações</p>
              {unread > 0 && (
                <button type="button" className="text-sm font-medium text-accent-text hover:underline" onClick={() => void api.markRead().then(reload)}>
                  Marcar todas como lidas
                </button>
              )}
            </div>
            <ul className="max-h-[60dvh] space-y-1 overflow-y-auto">
              {(data?.items ?? []).length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">Nada por aqui ainda.</li>}
              {(data?.items ?? []).map((n) => (
                <li key={n.id}>
                  <NotificationItem n={n} onRead={reload} compact />
                </li>
              ))}
            </ul>
            <Link to="/notificacoes" className="mt-1 block rounded-2xl px-3 py-2.5 text-center text-sm font-semibold text-accent-text hover:bg-surface-2">
              Ver todas
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------------
// Account menu
// ---------------------------------------------------------------------
function AccountMenu({ compact }: { compact?: boolean }) {
  const { session, profile, isAdmin } = useAuth()
  const backend = useBackend()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])

  if (!session)
    return (
      <Link
        to="/entrar"
        className="group inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 text-[14px] font-semibold text-bg transition-[background-color,color,transform] hover:bg-accent hover:text-accent-ink active:scale-[.97]"
      >
        <LogIn aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" /> Entrar
      </Link>
    )
  const initials = (profile?.full_name ?? session.email).split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase()
  const items = [
    { to: '/conta', icon: UserRound, label: 'Minha conta' },
    { to: '/conta/lances', icon: Gavel, label: 'Meus lances' },
    { to: '/conta/arremates', icon: Trophy, label: 'Meus arremates' },
    { to: '/conta/pedidos', icon: Package, label: 'Meus pedidos' },
    { to: '/conta/armazenadas', icon: Warehouse, label: 'Cartas armazenadas' },
    { to: '/conta/favoritos', icon: Heart, label: 'Meus favoritos' },
  ]
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Menu da conta de ${profile?.full_name.split(' ')[0] ?? 'usuário'}`}
        className="flex h-10 shrink-0 items-center gap-2 rounded-full pr-2.5 pl-[5px] text-ink transition-[background-color,transform] duration-200 hover:bg-ink/[.07] active:scale-[.97] aria-expanded:bg-ink/[.07]"
      >
        <span aria-hidden className="grid size-[30px] place-items-center rounded-full bg-mint text-[12px] font-bold text-[#0b1218] ring-2 ring-mint/25">
          {initials}
        </span>
        {!compact && <span className="hidden max-w-24 truncate text-[14px] font-medium xl:block">{profile?.full_name.split(' ')[0] ?? 'Conta'}</span>}
        <ChevronDown aria-hidden className={cx('size-3.5 text-subtle transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="glass absolute top-12 right-0 z-[70] w-64 rounded-3xl border border-line-strong p-2 shadow-pop"
          >
            {items.map((i) => (
              <Link key={i.to} role="menuitem" to={i.to} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] hover:bg-surface-2">
                <i.icon aria-hidden className="size-4 text-subtle" /> {i.label}
              </Link>
            ))}
            {isAdmin && (
              <Link role="menuitem" to="/admin" className="mt-1 flex items-center gap-3 rounded-2xl bg-accent-soft px-3 py-2.5 text-[15px] font-semibold text-accent-text">
                <LayoutDashboard aria-hidden className="size-4" /> Painel administrativo
              </Link>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                await backend.auth.signOut()
                nav('/')
              }}
              className="mt-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] text-muted hover:bg-surface-2 hover:text-ink"
            >
              <LogOut aria-hidden className="size-4" /> Sair
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------------
// Header. Dimensions never change on scroll: only the glass layer fades in,
// so nothing jumps, deforms or shifts the centred logo.
// ---------------------------------------------------------------------
export function SiteHeader() {
  const scrolled = useScrolled()
  return (
    <header className="safe-top fixed inset-x-0 top-0 z-50">
      {/*
        Desktop: one floating glass capsule, fixed 68px. Columns are
        minmax(0,1fr) | auto | minmax(0,1fr), so the logo sits on the exact
        centre of the bar (and of the viewport) whatever each side holds:
        signing in/out or a new badge never moves it. Scrolling only deepens
        the surface tint and shadow; no size, blur or position changes.
      */}
      <div className="shell hidden pt-3 lg:block">
        <nav aria-label="Principal" className="relative grid h-[68px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-3">
          <span
            aria-hidden
            className={cx(
              'nav-glass absolute inset-0 -z-10 rounded-[24px] transition-[background-color,box-shadow] duration-300',
              scrolled && 'is-scrolled',
            )}
          />
          <div className="flex min-w-0 items-center gap-0.5">
            <NavItem to="/" end>Início</NavItem>
            <NavItem to="/leiloes">Leilões</NavItem>
            <NavItem to="/catalogo">Catálogo</NavItem>
            <NavItem to="/sorteios">Sorteios</NavItem>
          </div>
          <Link to="/" aria-label="Gimmy Cards, página inicial" className="group relative mx-7 flex h-[68px] items-center justify-center rounded-2xl xl:mx-10">
            <Logo size="nav" className="transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:-translate-y-px group-hover:scale-[1.035]" />
          </Link>
          <div className="flex min-w-0 items-center justify-end gap-0.5">
            <NavItem to="/historico">Histórico</NavItem>
            <NavItem to="/conta">Minha Conta</NavItem>
            <span aria-hidden className="mx-2 h-5 w-px shrink-0 bg-line-strong xl:mx-2.5" />
            <ThemeToggle variant="icon" />
            <NotificationBell plain />
            <span className="ml-1">
              <AccountMenu />
            </span>
          </div>
        </nav>
      </div>
      {/* Mobile / tablet: compact top bar (logo + theme, notifications, profile); primary navigation lives in the floating bottom bar */}
      <div className="relative flex h-16 items-center justify-between gap-3 px-4 lg:hidden">
        <span aria-hidden className={cx('absolute inset-0 -z-10 border-b border-line bg-bg/90 backdrop-blur-xl transition-opacity duration-300', scrolled ? 'opacity-100' : 'opacity-0')} />
        <Link to="/" aria-label="Gimmy Cards, página inicial">
          <Logo size="xs" />
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle variant="icon" />
          <NotificationBell plain />
          <AccountMenu compact />
        </div>
      </div>
    </header>
  )
}

export function BottomNav() {
  const { session } = useAuth()
  const items = [
    { to: '/', icon: Home, label: 'Início', end: true },
    { to: '/leiloes', icon: Timer, label: 'Leilões' },
    { to: '/catalogo', icon: BookOpen, label: 'Catálogo' },
    { to: '/sorteios', icon: Gift, label: 'Sorteios' },
    { to: session ? '/conta' : '/entrar', icon: User, label: session ? 'Conta' : 'Entrar' },
  ]
  return (
    <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] lg:hidden">
      <ul className="glass mx-auto grid max-w-md grid-cols-5 rounded-[22px] border border-line-strong p-1.5 shadow-[0_18px_40px_-18px_rgb(0_0_0/.7)]">
        {items.map((i) => (
          <li key={i.label}>
            <NavLink
              to={i.to}
              end={i.end}
              className={({ isActive }) => cx('relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-[16px] text-[11.5px] font-semibold transition-colors', isActive ? 'text-accent-ink' : 'text-subtle hover:text-ink')}
            >
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="bottom-capsule" aria-hidden className="absolute inset-0 rounded-[16px] bg-accent" transition={{ type: 'spring', stiffness: 480, damping: 38 }} />}
                  <i.icon aria-hidden className="relative size-5" />
                  <span className="relative">{i.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// ---------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------
export function SiteFooter() {
  const cols: { title: string; links: [string, string][] }[] = [
    { title: 'Leilões', links: [['Ao vivo', '/leiloes'], ['Próximos', '/leiloes/proximos'], ['Catálogo', '/catalogo'], ['Histórico', '/historico']] },
    { title: 'Sua conta', links: [['Meus lances', '/conta/lances'], ['Meus pedidos', '/conta/pedidos'], ['Cartas armazenadas', '/conta/armazenadas'], ['Meus favoritos', '/conta/favoritos']] },
    { title: 'Comunidade', links: [['Como participar', '/#como-participar'], ['Regras', '/regras'], ['Sorteios', '/sorteios'], ['Privacidade', '/privacidade']] },
  ]
  return (
    <footer className="relative mt-24 overflow-hidden border-t border-line pb-28 lg:pb-8">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[64rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(64_217_208/.07),transparent)]" />
      <div className="relative mx-auto max-w-[1320px] px-5 pt-14 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.25fr_2fr]">
          <div className="max-w-sm">
            <Logo size="md" />
            <p className="mt-5 text-[15px] leading-relaxed text-muted">
              Comunidade e loja de cartas colecionáveis em Curitiba/PR. O papo continua no grupo do WhatsApp; os lances, pedidos e entregas ficam registrados aqui.
            </p>
            <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-line bg-surface/60 px-4 py-3">
              <CalendarClock aria-hidden className="size-5 text-accent-text" />
              <p className="text-[14px] leading-snug">
                <span className="block font-semibold">Terças e quintas, 19h</span>
                <span className="block text-subtle">24 horas de leilão, sem prorrogação</span>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {cols.map((c) => (
              <div key={c.title}>
                <p className="text-[13px] font-semibold tracking-[0.12em] text-subtle uppercase">{c.title}</p>
                <ul className="mt-4 space-y-3">
                  {c.links.map(([l, h]) => (
                    <li key={h}>
                      <Link to={h} className="group inline-flex items-center gap-1 text-[15px] text-muted transition-colors hover:text-ink">
                        {l}
                        <ArrowUpRight aria-hidden className="size-3.5 -translate-x-1 opacity-0 transition-[opacity,transform] group-hover:translate-x-0 group-hover:opacity-100" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-6 border-t border-line pt-7 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] text-subtle">
            <span>© {new Date().getFullYear()} Gimmy Cards</span>
            <Link to="/privacidade" className="hover:text-ink">Privacidade</Link>
            <Link to="/regras" className="hover:text-ink">Regras</Link>
            <button type="button" onClick={openCookieNotice} className="hover:text-ink">Cookies e armazenamento</button>
          </div>
          <a
            href="https://lorenzo-or7.github.io/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Or7 — idealizado e desenvolvido por Lorenzo Orsetti (abre em nova aba)"
            className="group inline-flex items-center self-start rounded-xl p-1.5 opacity-80 transition-[opacity,background-color] hover:bg-surface-2/70 hover:opacity-100 md:self-auto"
          >
            <img src="/brand/or7-assinatura.webp" alt="Or7 — Idealizado e desenvolvido por Lorenzo Orsetti" width={720} height={102} className="h-auto w-[196px] sm:w-[220px]" loading="lazy" draggable={false} />
          </a>
        </div>
      </div>
    </footer>
  )
}

// ---------------------------------------------------------------------
// Demo banner — always visible in demo mode, never in production
// ---------------------------------------------------------------------
export function DemoBar({ className }: { className?: string }) {
  const backend = useBackend()
  const { session, profile } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [accounts, setAccounts] = useState<{ id: string; label: string; description: string }[]>([])
  const reduce = useReducedMotion()
  useEffect(() => {
    if (open && backend.auth.demoAccounts) void backend.auth.demoAccounts().then(setAccounts)
  }, [open, backend])
  if (backend.mode !== 'demo') return null
  return (
    <div className={cx('fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-3 z-[60] lg:bottom-5 lg:left-5', className)}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="glass mb-2 max-h-[70dvh] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-3xl border border-gold/40 p-4 shadow-pop"
          >
            <p className="font-semibold">Modo demonstração</p>
            <p className="mt-1 text-sm text-muted">
              Dados de exemplo rodando só neste navegador, com as mesmas regras do servidor. Nada aqui é um leilão real. Configure o Supabase para usar dados reais.
            </p>
            <p className="mt-4 mb-2 text-xs font-semibold tracking-[0.12em] text-subtle uppercase">Entrar como</p>
            <ul className="space-y-1">
              {accounts.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={async () => {
                      await backend.auth.signInAs!(a.id)
                      toast({ kind: 'info', title: `Agora você é: ${a.label}` })
                      setOpen(false)
                    }}
                    className={cx('w-full rounded-2xl px-3 py-2 text-left hover:bg-surface-2', session?.userId === a.id && 'bg-accent-soft')}
                  >
                    <span className="block text-[15px] font-medium">{a.label}</span>
                    <span className="block text-[13px] text-subtle">{a.description}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-2xl border border-line-strong px-3 py-2 text-sm font-medium hover:border-accent"
                onClick={async () => {
                  const n = await backend.demo!.endLiveAuctions()
                  toast({ kind: 'info', title: n ? 'Leilão ao vivo encerrado' : 'Nenhum leilão ao vivo', body: n ? 'Pedidos gerados como no horário oficial.' : undefined })
                }}
              >
                Simular encerramento
              </button>
              <button
                type="button"
                className="rounded-2xl border border-line-strong px-3 py-2 text-sm font-medium hover:border-accent"
                onClick={async () => {
                  const n = await backend.demo!.makeOrdersOverdue()
                  toast({ kind: 'info', title: `${n} pedido(s) agora vencido(s)` })
                }}
              >
                Vencer prazos
              </button>
              <button
                type="button"
                className="col-span-2 flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium text-danger hover:bg-danger-soft"
                onClick={() => confirm('Apagar todos os dados de demonstração deste navegador?') && void backend.demo!.reset()}
              >
                <RotateCcw aria-hidden className="size-4" /> Restaurar dados de exemplo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-10 items-center gap-2 rounded-full border border-gold/50 bg-gold-soft px-4 text-sm font-semibold text-gold-text shadow-soft backdrop-blur"
      >
        <FlaskConical aria-hidden className="size-4" />
        DEMO{profile ? ` · ${profile.full_name.split(' ')[0]}` : ''}
        {profile && profile.role !== 'participant' && <Users aria-hidden className="size-3.5" />}
      </button>
    </div>
  )
}
