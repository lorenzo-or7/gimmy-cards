import { useCallback, useEffect, useRef, useState } from 'react'
import { getBackend, type Topic } from '@/lib/backend'
import { errorMessage } from '@/lib/errors'

interface Options {
  /** live-refresh when the backend reports changes */
  live?: { topic: Topic; id?: string | null }
  /** polling fallback in ms (realtime can drop on mobile networks) */
  poll?: number
  enabled?: boolean
}

export function useQuery<T>(key: string, fn: () => Promise<T>, opts: Options = {}) {
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const seq = useRef(0)
  const enabled = opts.enabled ?? true

  const run = useCallback(async (silent = false) => {
    const mine = ++seq.current
    if (!silent) setLoading(true)
    try {
      const r = await fnRef.current()
      if (mine === seq.current) {
        setData(r)
        setError(null)
      }
    } catch (e) {
      if (mine === seq.current) setError(errorMessage(e))
    } finally {
      if (mine === seq.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    void run()
  }, [key, enabled, run])

  const liveTopic = opts.live?.topic
  const liveId = opts.live?.id ?? null
  useEffect(() => {
    if (!enabled || !liveTopic) return
    let off = () => {}
    let cancelled = false
    let t: ReturnType<typeof setTimeout> | undefined
    void getBackend().then((b) => {
      if (cancelled) return
      off = b.subscribe(liveTopic, liveId, () => {
        clearTimeout(t)
        t = setTimeout(() => void run(true), 120)
      })
    })
    return () => {
      cancelled = true
      clearTimeout(t)
      off()
    }
  }, [enabled, liveTopic, liveId, run])

  useEffect(() => {
    if (!enabled || !opts.poll) return
    const i = setInterval(() => {
      if (document.visibilityState === 'visible') void run(true)
    }, opts.poll)
    const onVis = () => document.visibilityState === 'visible' && void run(true)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(i)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [enabled, opts.poll, run])

  return { data, error, loading, reload: () => run(true), setData }
}
