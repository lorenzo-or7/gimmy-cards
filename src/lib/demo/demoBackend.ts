/**
 * DEMO backend — development/evaluation only.
 * Runs the project's real SQL migrations inside the browser with PGlite,
 * so every rule (bids, ties, buyout, closing, orders, defaults) is the
 * production code. Data lives in this browser's IndexedDB and is never
 * sent anywhere. Enabled automatically when Supabase is not configured.
 */
import { PGliteWorker } from '@electric-sql/pglite/worker'
import { reportBoot, type Backend, type DemoAccount, type Session, type Topic } from '../backend'
import { BOOT_CHANNEL, sha256 } from './schema'

const DB_NAME = 'gimmy-cards-demo-v5'
const SESSION_KEY = 'gimmy-demo-session'


const READ_PREFIXES = ['get_', 'list_', 'my_', 'search_', 'card_pokemon_list', 'admin_list', 'admin_get', 'admin_overview', 'admin_lot_ranking', 'admin_audit', 'lot_bid_board']

async function acquireTabLock(): Promise<boolean> {
  if (!('locks' in navigator)) return true
  // A document being navigated away from can keep its lock for several
  // seconds, so the outgoing page releases it explicitly on `pagehide`. The
  // incoming page then reopens the persisted database (and its session)
  // instead of falling back to an empty in-memory copy. The timeout only
  // matters when another open tab really owns the database.
  return new Promise((resolve) => {
    navigator.locks
      .request('gimmy-cards-demo-db', { signal: AbortSignal.timeout(5000) }, () => {
        resolve(true)
        return new Promise<void>((release) => {
          addEventListener('pagehide', () => release(), { once: true })
          // restored from the back/forward cache without the lock: start clean
          window.addEventListener('pageshow', (e: PageTransitionEvent) => e.persisted && location.reload())
        })
      })
      .catch(() => resolve(false))
  })
}

export async function createDemoBackend(): Promise<Backend> {
  const exclusive = await acquireTabLock()
  // the database lives in a Web Worker so it never blocks the UI thread
  const make = (persist: boolean) =>
    new PGliteWorker(new Worker(new URL('./pglite.worker.ts', import.meta.url), { type: 'module' }), {
      dataDir: persist ? `idb://${DB_NAME}` : undefined,
      id: persist ? DB_NAME : `gimmy-mem-${crypto.randomUUID()}`,
    })
  const db = make(exclusive)
  const bus = new EventTarget()
  const authBus = new EventTarget()
  let uid: string | null = null

  async function setUser(id: string | null) {
    uid = id
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [id ?? ''])
  }

  // schema + sample data are prepared inside the worker; mirror its progress
  async function ensureSchema() {
    const ch = new BroadcastChannel(BOOT_CHANNEL)
    ch.onmessage = (e: MessageEvent<{ done: number; total: number; label: string }>) => reportBoot(e.data.done, e.data.total, e.data.label)
    reportBoot(1, 5, 'Abrindo banco local')
    try {
      await db.waitReady
    } finally {
      ch.close()
    }
  }

  await ensureSchema()
  reportBoot(4, 5, 'Restaurando sua sessão')
  try {
    const saved = localStorage.getItem(SESSION_KEY)
    if (saved) {
      const ok = await db.query(`select 1 from auth.users where id = $1`, [saved])
      await setUser(ok.rows.length ? saved : null)
    }
  } catch {
    /* storage blocked: start signed out */
  }

  const session = async (): Promise<Session | null> => {
    if (!uid) return null
    const r = await db.query<{ email: string }>(`select email from auth.users where id = $1`, [uid])
    return r.rows[0] ? { userId: uid, email: r.rows[0].email } : null
  }
  const emitAuth = async () => authBus.dispatchEvent(new CustomEvent('auth', { detail: await session() }))
  const persistSession = (id: string | null) => {
    try {
      if (id) localStorage.setItem(SESSION_KEY, id)
      else localStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
  }

  // queue: PGlite runs one statement at a time; keep the session GUC consistent
  let chain: Promise<unknown> = Promise.resolve()
  const serial = <T,>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.then(fn, fn)
    chain = next.catch(() => {})
    return next
  }

  // pg_cron stand-in: the server-side sweepers, every 20 s. They run as the
  // anonymous system, so they go through the same queue: no RPC or session
  // read may ever observe the temporarily cleared user.
  const tick = () =>
    serial(async () => {
      const keep = uid
      try {
        await setUser(null)
        const r = await db.query<{ r: { lots_closed: number } }>(`select public.close_due_lots() as r`)
        await db.query(`select public.expire_transfers(), public.notify_ending_soon(), public.flag_overdue_orders()`)
        if (r.rows[0]?.r.lots_closed) bus.dispatchEvent(new Event('change'))
      } finally {
        await setUser(keep)
      }
    })
  setInterval(() => void tick(), 20_000)
  void tick()

  const backend: Backend = {
    mode: 'demo',

    rpc<T>(fn: string, args: Record<string, unknown> = {}) {
      return serial(async () => {
        if (!/^[a-z_]+$/.test(fn)) throw new Error('INVALID_REQUEST')
        const keys = Object.keys(args)
        const values = keys.map((k) => {
          const v = args[k]
          return v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v
        })
        const call = keys.map((k, i) => `${k} => $${i + 1}`).join(', ')
        const isSet = fn === 'lot_bid_board'
        const sql = isSet ? `select * from public.${fn}(${call})` : `select public.${fn}(${call}) as r`
        // small artificial latency so loading states are visible and realistic
        await new Promise((r) => setTimeout(r, 60 + Math.random() * 90))
        const res = await db.query<Record<string, unknown>>(sql, values)
        if (!READ_PREFIXES.some((p) => fn.startsWith(p))) {
          setTimeout(() => bus.dispatchEvent(new Event('change')), 0)
        }
        return (isSet ? res.rows : res.rows[0]?.r) as T
      })
    },

    auth: {
      getSession: () => serial(session),
      onChange(cb) {
        const h = (e: Event) => cb((e as CustomEvent<Session | null>).detail)
        authBus.addEventListener('auth', h)
        return () => authBus.removeEventListener('auth', h)
      },
      signIn: (email, password) =>
        serial(async () => {
          const r = await db.query<{ id: string; demo_password_hash: string | null }>(
            `select id, demo_password_hash from auth.users where lower(email) = lower($1)`, [email.trim()])
          const u = r.rows[0]
          if (!u || !u.demo_password_hash || u.demo_password_hash !== (await sha256(password))) {
            throw new Error('Invalid login credentials')
          }
          await setUser(u.id)
          persistSession(u.id)
          await emitAuth()
        }),
      signUp: ({ email, password, full_name, whatsapp }) =>
        serial(async () => {
          if (password.length < 8) throw new Error('Password should be at least 8 characters')
          const exists = await db.query(`select 1 from auth.users where lower(email) = lower($1)`, [email.trim()])
          if (exists.rows.length) throw new Error('User already registered')
          const r = await db.query<{ id: string }>(
            `insert into auth.users (email, raw_user_meta_data, demo_password_hash) values ($1, $2, $3) returning id`,
            [email.trim().toLowerCase(), JSON.stringify({ full_name, whatsapp }), await sha256(password)])
          await setUser(r.rows[0].id)
          persistSession(r.rows[0].id)
          await emitAuth()
          return { needsConfirmation: false }
        }),
      signOut: () =>
        serial(async () => {
          await setUser(null)
          persistSession(null)
          await emitAuth()
        }),
      async resetPassword() {
        /* demo: no e-mail is sent */
      },
      updatePassword: (password) =>
        serial(async () => {
          if (!uid) throw new Error('AUTH_REQUIRED')
          if (password.length < 8) throw new Error('Password should be at least 8 characters')
          await db.query(`update auth.users set demo_password_hash = $2 where id = $1`, [uid, await sha256(password)])
        }),
      demoAccounts: () =>
        serial(async () => {
          const r = await db.query<DemoAccount>(
            `select u.id, u.demo_label as label, u.demo_description as description from auth.users u
             where u.demo_label is not null order by u.demo_label`)
          return r.rows
        }),
      signInAs: (id) =>
        serial(async () => {
          await setUser(id)
          persistSession(id)
          await emitAuth()
        }),
    },

    storage: {
      async uploadCardImage(blob) {
        return blobToDataUrl(blob)
      },
      uploadProof: (userId, orderId, file, ext) =>
        serial(async () => {
          const path = `${userId}/${orderId}/${crypto.randomUUID()}.${ext}`
          await db.query(`insert into public.demo_files (path, data) values ($1, $2)`, [path, await blobToDataUrl(file)])
          return path
        }),
      imageUrl(path) {
        return path ?? null
      },
      proofUrl: (path) =>
        serial(async () => {
          const r = await db.query<{ data: string }>(`select data from public.demo_files where path = $1`, [path])
          if (!r.rows[0]) throw new Error('NOT_FOUND')
          return r.rows[0].data
        }),
    },

    subscribe(_topic: Topic, _id, cb) {
      const h = () => cb()
      bus.addEventListener('change', h)
      return () => bus.removeEventListener('change', h)
    },

    demo: {
      reset: () =>
        serial(async () => {
          await db.close()
          if (exclusive) indexedDB.deleteDatabase(`/pglite/${DB_NAME}`)
          persistSession(null)
          location.reload()
        }),
      endLiveAuctions: () =>
        serial(async () => {
          const keep = uid
          await setUser(null)
          await db.query(`select set_config('gimmy.internal', 'on', false)`)
          const end = new Date(Date.now() - 1000).toISOString()
          const r = await db.query<{ id: string }>(
            `select id from public.auctions where status = 'published' and starts_at <= now() and ends_at > now()`)
          for (const a of r.rows) {
            await db.query(`update public.lots set ends_at = $2 where auction_id = $1 and status = 'open'`, [a.id, end])
            await db.query(`update public.auctions set ends_at = $2 where id = $1`, [a.id, end])
          }
          await db.query(`select set_config('gimmy.internal', '', false)`)
          await db.query(`select public.close_due_lots()`)
          await setUser(keep)
          bus.dispatchEvent(new Event('change'))
          return r.rows.length
        }),
      makeOrdersOverdue: () =>
        serial(async () => {
          const r = await db.query(
            `update public.orders set due_at = now() - interval '1 minute' where status in ('awaiting_payment','proof_submitted') and due_at > now() returning id`)
          bus.dispatchEvent(new Event('change'))
          return r.rows.length
        }),
    },
  }

  if (!exclusive) console.warn('[gimmy] Demo aberta em outra aba: esta aba usa um banco temporário em memória.')
  return backend
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}
