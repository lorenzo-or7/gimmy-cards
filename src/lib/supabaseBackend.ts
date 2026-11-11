import { createClient, type RealtimeChannel } from '@supabase/supabase-js'
import type { Backend, Session, Topic } from './backend'

const CARD_BUCKET = 'card-images'
const PROOF_BUCKET = 'payment-proofs'

export function createSupabaseBackend(): Backend {
  const url = import.meta.env.VITE_SUPABASE_URL as string
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  const sb = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    realtime: { params: { eventsPerSecond: 5 } },
  })

  const toSession = (s: { user: { id: string; email?: string } } | null): Session | null =>
    s ? { userId: s.user.id, email: s.user.email ?? '' } : null

  const publicUrl = (path: string) => sb.storage.from(CARD_BUCKET).getPublicUrl(path).data.publicUrl

  return {
    mode: 'supabase',

    async rpc<T>(fn: string, args: Record<string, unknown> = {}) {
      const { data, error } = await sb.rpc(fn, args)
      if (error) throw new Error(error.message)
      return data as T
    },

    auth: {
      async getSession() {
        const { data } = await sb.auth.getSession()
        return toSession(data.session)
      },
      onChange(cb) {
        const { data } = sb.auth.onAuthStateChange((_e, s) => cb(toSession(s)))
        return () => data.subscription.unsubscribe()
      },
      async signIn(email, password) {
        const { error } = await sb.auth.signInWithPassword({ email, password })
        if (error) throw new Error(error.message)
      },
      async signUp({ email, password, full_name, whatsapp }) {
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: { data: { full_name, whatsapp }, emailRedirectTo: `${location.origin}/entrar` },
        })
        if (error) throw new Error(error.message)
        return { needsConfirmation: !data.session }
      },
      async signOut() {
        await sb.auth.signOut()
      },
      async resetPassword(email) {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/nova-senha` })
        if (error) throw new Error(error.message)
      },
      async updatePassword(password) {
        const { error } = await sb.auth.updateUser({ password })
        if (error) throw new Error(error.message)
      },
    },

    storage: {
      async uploadCardImage(blob, name, folder) {
        const path = `${folder ?? crypto.randomUUID()}/${name}`
        const { error } = await sb.storage.from(CARD_BUCKET).upload(path, blob, {
          contentType: blob.type || 'image/webp',
          cacheControl: '31536000',
          upsert: false,
        })
        if (error) throw new Error(error.message)
        return path
      },
      async uploadProof(userId, orderId, file, ext) {
        const path = `${userId}/${orderId}/${crypto.randomUUID()}.${ext}`
        const { error } = await sb.storage.from(PROOF_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
        if (error) throw new Error(error.message)
        return path
      },
      imageUrl(path, variant = 'full') {
        if (!path) return null
        if (/^(data:|https?:|blob:)/.test(path)) return path
        // uploads store "<id>/front.webp" (full) next to "<id>/front_thumb.webp"
        const p = variant === 'thumb' && path.endsWith('.webp') && !path.endsWith('_thumb.webp') ? path.replace(/\.webp$/, '_thumb.webp') : path
        return publicUrl(p)
      },
      async proofUrl(path) {
        if (/^(data:|https?:)/.test(path)) return path
        const { data, error } = await sb.storage.from(PROOF_BUCKET).createSignedUrl(path, 300)
        if (error) throw new Error(error.message)
        return data.signedUrl
      },
    },

    subscribe(topic: Topic, id, cb) {
      const channels: RealtimeChannel[] = []
      const name = `gc-${topic}-${id ?? 'all'}-${Math.random().toString(36).slice(2, 8)}`
      if (topic === 'lot' && id) {
        channels.push(
          sb.channel(name).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lots', filter: `id=eq.${id}` }, cb).subscribe(),
        )
      } else if (topic === 'lots' || topic === 'any') {
        channels.push(sb.channel(name).on('postgres_changes', { event: '*', schema: 'public', table: 'lots' }, cb).subscribe())
      }
      if ((topic === 'notifications' || topic === 'any') && id) {
        channels.push(
          sb
            .channel(name + '-n')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${id}` }, cb)
            .subscribe(),
        )
      }
      return () => channels.forEach((c) => sb.removeChannel(c))
    },
  }
}
