/**
 * Backend transport. Two implementations with the SAME contract:
 *  - supabase: production (PostgREST RPC, Supabase Auth, Storage, Realtime)
 *  - demo:     the real SQL migrations running in the browser (PGlite),
 *              used only when no Supabase credentials are configured.
 */
export interface Session {
  userId: string
  email: string
}

export interface DemoAccount {
  id: string
  label: string
  description: string
}

export type Topic = 'lot' | 'lots' | 'notifications' | 'any'

export interface Backend {
  mode: 'supabase' | 'demo'
  rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T>
  auth: {
    getSession(): Promise<Session | null>
    onChange(cb: (s: Session | null) => void): () => void
    signIn(email: string, password: string): Promise<void>
    signUp(input: { email: string; password: string; full_name: string; whatsapp: string }): Promise<{ needsConfirmation: boolean }>
    signOut(): Promise<void>
    resetPassword(email: string): Promise<void>
    updatePassword(password: string): Promise<void>
    demoAccounts?(): Promise<DemoAccount[]>
    signInAs?(id: string): Promise<void>
  }
  storage: {
    uploadCardImage(blob: Blob, name: string, folder?: string): Promise<string>
    uploadProof(userId: string, orderId: string, file: Blob, ext: string): Promise<string>
    imageUrl(path: string | null | undefined, variant?: 'thumb' | 'full'): string | null
    proofUrl(path: string): Promise<string>
  }
  /** Calls back when something relevant may have changed. */
  subscribe(topic: Topic, id: string | null, cb: () => void): () => void
  demo?: {
    reset(): Promise<void>
    endLiveAuctions(): Promise<number>
    makeOrdersOverdue(): Promise<number>
  }
}

// ---------------------------------------------------------------------
// Boot progress: each step is a real initialisation stage (no fake %).
// ---------------------------------------------------------------------
export interface BootProgress {
  done: number
  total: number
  label: string
}
let boot: BootProgress = { done: 0, total: 0, label: 'Preparando os leilões...' }
const bootSubs = new Set<(p: BootProgress) => void>()
export function reportBoot(done: number, total: number, label: string) {
  boot = { done, total, label }
  bootSubs.forEach((f) => f(boot))
}
export function onBoot(f: (p: BootProgress) => void) {
  bootSubs.add(f)
  f(boot)
  return () => void bootSubs.delete(f)
}

let current: Promise<Backend> | null = null

export const isSupabaseConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

export function getBackend(): Promise<Backend> {
  if (!current) {
    current = isSupabaseConfigured
      ? (reportBoot(0, 2, 'Conectando ao servidor'), import('./supabaseBackend').then((m) => (reportBoot(1, 2, 'Carregando configurações'), m.createSupabaseBackend())))
      : (reportBoot(0, 5, 'Carregando banco de demonstração'), import('./demo/demoBackend').then((m) => m.createDemoBackend()))
  }
  return current
}
