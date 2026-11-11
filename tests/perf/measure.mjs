// Performance probe (production build, demo mode).
// Usage: npm run build && npx vite preview --port 5190 & node tests/perf/measure.mjs [label]
// Measures: boot time (splash gone), main-thread long tasks during boot,
// during 10 s idle on the Home, and while scrolling the whole Home.
import { chromium } from '@playwright/test'

const URL = process.env.PERF_URL ?? 'http://localhost:5190/'
const label = process.argv[2] ?? 'run'

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => {
  localStorage.setItem('gimmy-storage-choice', JSON.stringify({ v: 1, preferences: true, at: new Date().toISOString() }))
  window.__lt = []
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push({ t: e.startTime, d: e.duration }))).observe({ type: 'longtask', buffered: true })
})
const page = await ctx.newPage()
const t0 = Date.now()
await page.goto(URL)
await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 90_000 })
await page.waitForFunction(() => !document.querySelector('[aria-label="Carregando Gimmy Cards"]'), null, { timeout: 90_000 })
const boot = Date.now() - t0
const sum = (xs) => Math.round(xs.reduce((a, b) => a + b.d, 0))
const window_ = async (ms) => {
  const start = await page.evaluate(() => performance.now())
  await page.waitForTimeout(ms)
  return page.evaluate((s) => window.__lt.filter((x) => x.t >= s), start)
}
const bootTasks = await page.evaluate(() => window.__lt)
await page.evaluate(() => { window.__mut = 0; new MutationObserver((m) => (window.__mut += m.length)).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true }) })
const idle = await window_(10_000)
const idleMutations = await page.evaluate(() => window.__mut)
const effects = await page.evaluate(() => {
  const all = [...document.querySelectorAll('*')]
  const cs = all.map((e) => [e, getComputedStyle(e)])
  const pseudo = all.map((e) => getComputedStyle(e, '::after'))
  return {
    elements: all.length,
    filter_blur: cs.filter(([, c]) => c.filter.includes('blur')).length,
    backdrop_filter: cs.filter(([, c]) => c.backdropFilter && c.backdropFilter !== 'none').length,
    blend_modes: cs.filter(([, c]) => c.mixBlendMode !== 'normal').length + pseudo.filter((c) => c.mixBlendMode !== 'normal').length,
    infinite_animations: document.getAnimations().filter((a) => a.effect?.getTiming().iterations === Infinity).length,
    running_animations: document.getAnimations().length,
  }
})
const scrollStart = await page.evaluate(() => performance.now())
const frames = await page.evaluate(async () => {
  const deltas = []
  let last = performance.now()
  let run = true
  const loop = (t) => { deltas.push(t - last); last = t; if (run) requestAnimationFrame(loop) }
  requestAnimationFrame(loop)
  const H = document.documentElement.scrollHeight
  for (let y = 0; y < H; y += 120) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 16)) }
  await new Promise((r) => setTimeout(r, 300))
  run = false
  const sorted = [...deltas].sort((a, b) => a - b)
  return { n: deltas.length, p95: Math.round(sorted[Math.floor(sorted.length * 0.95)]), max: Math.round(sorted[sorted.length - 1]), janky: deltas.filter((d) => d > 50).length }
})
const scrollTasks = await page.evaluate((s) => window.__lt.filter((x) => x.t >= s), scrollStart)
const t1 = Date.now()
await page.reload()
await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 90_000 })
await page.waitForFunction(() => !document.querySelector('[aria-label="Carregando Gimmy Cards"]'), null, { timeout: 90_000 })
const boot2 = Date.now() - t1
const boot2Tasks = await page.evaluate(() => window.__lt)
const mem = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null))
console.log(JSON.stringify({
  label,
  boot_ms: boot,
  revisit_boot_ms: boot2,
  revisit_longtasks: { count: boot2Tasks.length, total_ms: sum(boot2Tasks), max_ms: Math.round(Math.max(0, ...boot2Tasks.map((x) => x.d))) },
  boot_longtasks: { count: bootTasks.length, total_ms: sum(bootTasks), max_ms: Math.round(Math.max(0, ...bootTasks.map((x) => x.d))) },
  idle10s_longtasks: { count: idle.length, total_ms: sum(idle) },
  idle10s_dom_mutations: idleMutations,
  effects,
  scroll: { longtasks: scrollTasks.length, longtask_ms: sum(scrollTasks), frame_p95_ms: frames.p95, frame_max_ms: frames.max, frames_over_50ms: frames.janky },
  js_heap_mb: mem,
}, null, 2))
await browser.close()
