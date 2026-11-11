import { useEffect, useState } from 'react'

/** Shared ticking clock (one interval for the whole app). */
const subs = new Set<(n: number) => void>()
let timer: ReturnType<typeof setInterval> | null = null
let offset = 0 // server - client clock difference, set from get_settings().now

export function setServerOffset(ms: number) {
  if (Number.isFinite(ms) && Math.abs(ms) < 24 * 3600_000) offset = ms
}
export const serverNow = () => Date.now() + offset

export function useNow(enabled = true) {
  const [now, setNow] = useState(serverNow)
  useEffect(() => {
    if (!enabled) return
    subs.add(setNow)
    if (!timer) timer = setInterval(() => subs.forEach((s) => s(serverNow())), 1000)
    return () => {
      subs.delete(setNow)
      if (!subs.size && timer) {
        clearInterval(timer)
        timer = null
      }
    }
  }, [enabled])
  return now
}

/**
 * Like useNow, but re-renders only when one of the given instants passes
 * (e.g. an auction start/end). Lets tiles compute their phase without
 * re-rendering every second; live countdowns keep using useNow.
 */
export function useNowAt(times: (string | null | undefined)[]) {
  const [now, setNow] = useState(serverNow)
  const key = times.join('|')
  useEffect(() => {
    const t = serverNow()
    const next = times
      .filter((x): x is string => !!x)
      .map((x) => new Date(x).getTime())
      .filter((x) => x > t)
      .sort((a, b) => a - b)[0]
    if (next === undefined) return
    const id = setTimeout(() => setNow(serverNow()), Math.min(next - t + 50, 2_147_000_000))
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, now])
  return now
}
