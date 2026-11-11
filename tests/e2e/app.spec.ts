import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const ready = async (page: Page, path = '/') => {
  // the storage notice is covered in v3.spec.ts; keep it out of the way here
  await page.addInitScript(() => localStorage.setItem('gimmy-storage-choice', JSON.stringify({ v: 1, preferences: true, at: new Date().toISOString() })))
  await page.goto(path)
  await expect(page.getByRole('status', { name: 'Carregando Gimmy Cards' })).toHaveCount(0, { timeout: 60_000 })
}

const demoLogin = async (page: Page, label: string, back = '/conta') => {
  await ready(page, `/entrar?voltar=${encodeURIComponent(back)}`)
  await page.getByRole('button', { name: new RegExp(label) }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/entrar'))
}

test.describe('public site', () => {
  test('home shows the hero, a live auction and real lots @mobile', async ({ page }) => {
    await ready(page)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Sua próxima carta.')
    await expect(page.getByRole('link', { name: 'Explorar leilões' })).toBeVisible()
    await expect(page.locator('#live-title')).not.toHaveText('Nenhum leilão aberto agora')
    await page.locator('#live-title').scrollIntoViewIfNeeded()
    await expect(page.locator('article').first()).toBeVisible()
  })

  test('no horizontal overflow at the required widths', async ({ page }) => {
    await ready(page)
    for (const width of [320, 360, 390, 430, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      for (const path of ['/', '/leiloes', '/catalogo', '/historico', '/regras', '/sorteios']) {
        await page.evaluate((p) => {
          history.pushState({}, '', p)
          dispatchEvent(new PopStateEvent('popstate'))
        }, path)
        await page.waitForTimeout(250)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        expect(overflow, `${path} @ ${width}px`).toBeLessThanOrEqual(0)
      }
    }
  })

  test('theme toggle persists across reloads', async ({ page }) => {
    await ready(page)
    const before = await page.evaluate(() => document.documentElement.dataset.theme)
    await page.getByRole('switch', { name: /Mudar para tema/ }).first().click()
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).not.toBe(before)
    const after = await page.evaluate(() => document.documentElement.dataset.theme)
    await page.reload()
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe(after)
  })

  test('keyboard: first Tab reaches the skip link', async ({ page }) => {
    await ready(page)
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused()
  })

  test('catalog filters by language', async ({ page }) => {
    await ready(page, '/catalogo')
    const count = page.getByText(/lotes? encontrados?/)
    await expect(count).toBeVisible()
    const total = Number((await count.textContent())!.match(/\d+/)![0])
    await page.getByRole('radio', { name: /JAP/ }).check({ force: true })
    await expect.poll(async () => Number(((await count.textContent()) ?? '0').match(/\d+/)?.[0] ?? 0)).toBeLessThan(total)
  })
})

test.describe('auth and permissions', () => {
  test('protected routes redirect to login and come back after signing in', async ({ page }) => {
    await ready(page, '/conta/pedidos')
    await expect(page).toHaveURL(/\/entrar\?voltar=%2Fconta%2Fpedidos/)
    await page.getByRole('button', { name: /Participante · Rafael/ }).click()
    await expect(page).toHaveURL(/\/conta\/pedidos$/)
    await expect(page.getByRole('heading', { name: 'Meus pedidos' })).toBeVisible()
  })

  test('sign-up validates fields and creates a participant account', async ({ page }) => {
    await ready(page, '/cadastro')
    await page.getByRole('button', { name: 'Criar conta' }).click()
    await expect(page.getByText('Informe nome e sobrenome.')).toBeVisible()
    await page.getByLabel('Nome completo').fill('Teste Playwright')
    await page.getByLabel('E-mail').fill(`pw${Date.now()}@teste.local`)
    await page.getByLabel('WhatsApp').fill('41999998888')
    await page.getByLabel('Senha').fill('senha-segura-123')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Criar conta' }).click()
    await expect(page).toHaveURL(/\/conta$/)
    await expect(page.getByRole('heading', { name: 'Olá, Teste!' })).toBeVisible()
  })

  test('login with wrong password shows a clear error', async ({ page }) => {
    await ready(page, '/entrar')
    await page.getByLabel('E-mail').fill('lia@demo.gimmy')
    await page.getByLabel('Senha', { exact: true }).fill('errada')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()
  })

  test('participants cannot open the admin panel', async ({ page }) => {
    await demoLogin(page, 'Participante · Lia')
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/conta$/)
  })

  test('admins reach the dashboard with real counts', async ({ page }) => {
    await demoLogin(page, 'Administrador principal', '/admin')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Bom dia|Boa tarde|Boa noite/)
    await expect(page.getByText('Lances registrados')).toBeVisible()
  })
})

test.describe('bidding', () => {
  test('confirm a leading bid; the server-confirmed result is shown @mobile', async ({ page }) => {
    await demoLogin(page, 'Participante · Rafael', '/leiloes')
    await page.locator('a[href^="/lote/"]').first().click()
    await expect(page.getByRole('button', { name: /Dar lance de/ })).toBeVisible()
    await page.getByRole('button', { name: /Liderar ·/ }).click()
    await page.getByRole('button', { name: /Dar lance de/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Confirmar lance' })
    await expect(dialog).toContainText('não pode ser retirado')
    await dialog.getByRole('button', { name: 'Confirmar lance' }).click()
    const ok = page.getByRole('dialog', { name: 'Lance registrado' })
    await expect(ok).toContainText('Confirmado pelo servidor: você lidera.')
    await ok.getByRole('button', { name: 'Fechar' }).first().click()
    await expect(page.getByText(/Você lidera com/)).toBeVisible()
  })

  test('an amount between the top bid and the increment is blocked before sending', async ({ page }) => {
    await demoLogin(page, 'Participante · Rafael', '/leiloes')
    await page.locator('a[href^="/lote/"]').first().click()
    const input = page.getByLabel('Seu lance')
    const current = await page.getByRole('button', { name: /Liderar ·/ }).textContent()
    const min = Number(current!.replace(/[^\d,]/g, '').replace(',', '.'))
    await input.fill(String(min - 0.5).replace('.', ','))
    await expect(page.getByText('Para passar o maior lance, respeite o incremento mínimo.')).toBeVisible()
    await expect(page.getByRole('button', { name: /Dar lance de/ })).toBeDisabled()
  })

  test('buyout requires two confirmations and closes the lot', async ({ page }) => {
    await demoLogin(page, 'Participante · Rafael', '/leiloes')
    await page.locator('a[href^="/lote/"]').first().click()
    await page.getByRole('button', { name: /Arrematar agora por/ }).click()
    await page.getByRole('dialog', { name: 'Arrematar agora?' }).getByRole('button', { name: 'Continuar' }).click()
    const final = page.getByRole('dialog', { name: 'Confirmação final' })
    const buy = final.getByRole('button', { name: /Comprar por/ })
    await expect(buy).toBeDisabled()
    await final.getByRole('checkbox').check()
    await buy.click()
    await expect(page.getByRole('dialog', { name: 'Arremate confirmado!' })).toBeVisible()
    await page.getByRole('dialog', { name: 'Arremate confirmado!' }).getByRole('button', { name: 'Fechar' }).first().click()
    await expect(page.getByText('Você venceu este lote!')).toBeVisible()
    await expect(page.getByRole('button', { name: /Dar lance de/ })).toHaveCount(0)
  })
})

test.describe('accessibility (axe, WCAG 2 A/AA)', () => {
  for (const theme of ['dark', 'light'])
  for (const path of ['/', '/leiloes', '/catalogo', '/historico', '/regras', '/entrar', '/cadastro']) {
    test(`no serious violations on ${path} (${theme})`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('gimmy-theme', t), theme)
      await ready(page, path)
      await page.waitForTimeout(1200)
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      const serious = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
      expect(serious.map((v) => `${v.id}: ${v.nodes.length} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
    })
  }
})
