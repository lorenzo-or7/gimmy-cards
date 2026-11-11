import { defineConfig, devices } from '@playwright/test'

/**
 * E2E runs against the dev server in DEMO mode (no Supabase env vars):
 * the real SQL migrations execute in the browser via PGlite, so these tests
 * exercise the same rules as production. Each test gets a fresh database.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1, // each test seeds a fresh in-browser PGlite; parallel seeding made timings flaky
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5180',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: {
    command: 'npx vite --port 5180 --strictPort',
    url: 'http://localhost:5180',
    reuseExistingServer: true,
    timeout: 120_000,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
})
