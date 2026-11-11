import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Cookie } from 'lucide-react'
import { useBackend } from '@/app/providers'
import { Button, Modal, Switch } from '@/components/ui'

/**
 * LGPD storage notice. Inventory of what this app actually stores
 * (no cookies are set by our code; no analytics, ads or tracking exist):
 *  - Essential: login session (Supabase Auth, localStorage), this choice,
 *    demo database/session (IndexedDB/localStorage, demo mode only).
 *  - Preferences: theme and admin sidebar state (localStorage) — can be turned off.
 *  - Optional services: none in use, so there is nothing to accept or reject.
 */
const KEY = 'gimmy-storage-choice'
const EVENT = 'gimmy:open-storage-notice'
interface Choice {
  v: 1
  preferences: boolean
  at: string
}

export function readStorageChoice(): Choice | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Choice) : null
  } catch {
    return null
  }
}
/** Preference storage is allowed unless the visitor turned it off. */
export const preferencesAllowed = () => readStorageChoice()?.preferences !== false
export const openCookieNotice = () => window.dispatchEvent(new Event(EVENT))

const PREF_KEYS = ['gimmy-theme', 'gimmy-admin-sidebar']

export function CookieNotice() {
  const backend = useBackend()
  const [banner, setBanner] = useState(false)
  const [details, setDetails] = useState(false)
  const [prefs, setPrefs] = useState(true)
  useEffect(() => {
    const c = readStorageChoice()
    setPrefs(c?.preferences !== false)
    if (!c) {
      const t = setTimeout(() => setBanner(true), 900)
      return () => clearTimeout(t)
    }
  }, [])
  useEffect(() => {
    const open = () => {
      setPrefs(preferencesAllowed())
      setDetails(true)
    }
    window.addEventListener(EVENT, open)
    return () => window.removeEventListener(EVENT, open)
  }, [])
  const save = (preferences: boolean) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: 1, preferences, at: new Date().toISOString() } satisfies Choice))
      if (!preferences) PREF_KEYS.forEach((k) => localStorage.removeItem(k))
    } catch {
      /* storage blocked: nothing is persisted anyway */
    }
    setBanner(false)
    setDetails(false)
  }
  const rows: { t: string; d: string; where: string; always?: boolean; on?: boolean; set?: (v: boolean) => void }[] = [
    { t: 'Essenciais', d: 'Manter você conectado com segurança e lembrar esta escolha.' + (backend.mode === 'demo' ? ' No modo demonstração, também guardam os dados de exemplo neste navegador.' : ''), where: 'Armazenamento local do navegador', always: true },
    { t: 'Preferências', d: 'Lembrar o tema claro/escuro e o estado do menu do painel.', where: 'Armazenamento local do navegador', on: prefs, set: setPrefs },
    { t: 'Serviços opcionais', d: 'Nenhum em uso. Não usamos análise de audiência, publicidade nem rastreamento.', where: '—' },
  ]
  return (
    <>
      <AnimatePresence>
        {banner && !details && (
          <motion.div
            role="region"
            aria-label="Aviso de cookies e armazenamento"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            className="glass fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[75] mx-auto flex max-w-[26rem] items-center gap-3 rounded-2xl border border-line-strong py-2.5 pr-2.5 pl-3 shadow-[0_18px_40px_-20px_rgb(0_0_0/.6)] sm:max-w-[28rem] lg:right-5 lg:bottom-5 lg:left-auto lg:mx-0"
          >
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent-text">
              <Cookie className="size-4" />
            </span>
            <p className="min-w-0 flex-1 text-[13px] leading-snug text-muted">
              <span className="font-semibold text-ink">Sem rastreamento.</span> Guardamos no navegador só seu login e o tema.{' '}
              <Link to="/privacidade" className="font-medium text-accent-text underline underline-offset-2">Privacidade</Link>
            </p>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={() => setDetails(true)} className="h-8 rounded-[9px] px-2.5 text-[13px] font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink">
                Ajustar
              </button>
              <button type="button" onClick={() => save(preferencesAllowed())} className="h-8 rounded-[9px] bg-accent px-3 text-[13px] font-semibold text-accent-ink transition-colors hover:bg-accent-strong active:scale-[.97]">
                Ok
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Modal
        open={details}
        onClose={() => setDetails(false)}
        title="Cookies e armazenamento"
        description="O que guardamos no seu navegador e por quê. Você pode rever esta escolha pelo rodapé a qualquer momento."
        size="md"
        footer={<Button onClick={() => save(prefs)}>Salvar escolha</Button>}
      >
        <ul className="space-y-3 pb-4">
          {rows.map((r) => (
            <li key={r.t} className="flex items-start gap-4 rounded-2xl border border-line bg-surface p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{r.t}</p>
                <p className="mt-0.5 text-[14px] text-muted">{r.d}</p>
                <p className="mt-1 text-[12px] text-subtle">{r.where}</p>
              </div>
              {r.always ? (
                <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-semibold text-subtle">Sempre ativo</span>
              ) : r.set ? (
                <Switch label={r.t} checked={!!r.on} onChange={r.set} />
              ) : null}
            </li>
          ))}
        </ul>
      </Modal>
    </>
  )
}
