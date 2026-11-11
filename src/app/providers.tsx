import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react'
import { getBackend, onBoot, reportBoot, type Backend, type Session } from '@/lib/backend'
import { api } from '@/lib/api'
import type { Profile, Settings } from '@/lib/types'
import { setServerOffset } from '@/hooks/useNow'
import { preferencesAllowed } from '@/components/layout/CookieNotice'

// ---------------------------------------------------------------------
// Backend + settings
// ---------------------------------------------------------------------
interface BackendCtx {
  backend: Backend
  settings: Settings | null
}
const BackendContext = createContext<BackendCtx | null>(null)
export const useBackend = () => useContext(BackendContext)!.backend
export const useSettings = () => useContext(BackendContext)!.settings
export const useImage = () => {
  const b = useBackend()
  return b.storage.imageUrl
}

export function BackendProvider({ children, fallback }: { children: ReactNode; fallback: (leaving: boolean) => ReactNode }) {
  const [backend, setBackend] = useState<Backend | null>(null)
  const [splashGone, setSplashGone] = useState(false)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  useEffect(() => {
    getBackend()
      .then(async (b) => {
        let total = 0
        const off = onBoot((x) => (total = x.total))
        off()
        reportBoot(Math.max(total - 1, 0), total, 'Sincronizando o horário oficial')
        const t0 = Date.now()
        const s = await api.settings().catch(() => null)
        reportBoot(total, total, 'Pronto')
        setBackend(b)
        setTimeout(() => setSplashGone(true), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 520)
        if (s) {
          setSettings(s)
          setServerOffset(new Date(s.now).getTime() - (t0 + Date.now()) / 2)
        }
      })
      .catch((e) => setFailed(String(e?.message ?? e)))
  }, [])
  if (failed)
    return (
      <div role="alert" className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <p className="text-xl font-semibold">Não foi possível iniciar a plataforma.</p>
          <p className="mt-2 text-muted">Atualize a página. Se continuar, avise a equipe Gimmy Cards.</p>
          <p className="mt-4 text-sm text-subtle">{failed}</p>
        </div>
      </div>
    )
  if (!backend) return <>{fallback(false)}</>
  return (
    <BackendContext.Provider value={{ backend, settings }}>
      {children}
      {!splashGone && fallback(true)}
    </BackendContext.Provider>
  )
}

// ---------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------
interface AuthCtx {
  session: Session | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  isSuperAdmin: boolean
  refreshProfile(): Promise<void>
}
const AuthContext = createContext<AuthCtx | null>(null)
export const useAuth = () => useContext(AuthContext)!

export function AuthProvider({ children }: { children: ReactNode }) {
  const backend = useBackend()
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (s: Session | null) => {
    setSession(s)
    if (!s) {
      setProfile(null)
      setLoading(false)
      return
    }
    try {
      setProfile(await api.me())
    } catch {
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void backend.auth.getSession().then(load)
    return backend.auth.onChange((s) => void load(s))
  }, [backend, load])

  const value = useMemo<AuthCtx>(
    () => ({
      session,
      profile,
      loading,
      isAdmin: profile?.role === 'admin' || profile?.role === 'super_admin',
      isSuperAdmin: profile?.role === 'super_admin',
      refreshProfile: async () => setProfile(await api.me()),
    }),
    [session, profile, loading],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ---------------------------------------------------------------------
// Theme (persisted; respects system preference on first visit)
// ---------------------------------------------------------------------
type Theme = 'dark' | 'light'
const ThemeContext = createContext<{ theme: Theme; toggle(): void }>({ theme: 'dark', toggle: () => {} })
export const useTheme = () => useContext(ThemeContext)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'))
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute('content', theme === 'dark' ? '#0B1218' : '#FFF9ED')
    try {
      if (preferencesAllowed()) localStorage.setItem('gimmy-theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])
  const toggle = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark'
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (doc.startViewTransition && !reduce) doc.startViewTransition(() => setTheme(next))
    else setTheme(next)
  }, [theme])
  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
}

// ---------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------
type ToastKind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  kind: ToastKind
  title: string
  body?: string
}
const ToastContext = createContext<(t: Omit<Toast, 'id'>) => void>(() => {})
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const id = useRef(0)
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const n = ++id.current
    setToasts((xs) => [...xs.slice(-3), { ...t, id: n }])
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== n)), t.kind === 'error' ? 7000 : 4500)
  }, [])
  const Icon = { success: CheckCircle2, error: CircleAlert, info: Info }
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[80] flex flex-col items-center gap-2 px-4 md:bottom-6 md:right-6 md:left-auto md:items-end"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const I = Icon[t.kind]
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                role={t.kind === 'error' ? 'alert' : 'status'}
                className="glass pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line-strong p-4 shadow-pop"
              >
                <I
                  aria-hidden
                  className={`mt-0.5 size-5 shrink-0 ${t.kind === 'success' ? 'text-success' : t.kind === 'error' ? 'text-danger' : 'text-accent-text'}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug">{t.title}</p>
                  {t.body && <p className="mt-0.5 text-sm text-muted">{t.body}</p>}
                </div>
                <button
                  type="button"
                  aria-label="Fechar aviso"
                  onClick={() => setToasts((xs) => xs.filter((x) => x.id !== t.id))}
                  className="-m-1 rounded-full p-1 text-subtle hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
