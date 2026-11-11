import { expect, test, type Page } from '@playwright/test'

const ready = async (page: Page, path = '/', opts: { banner?: boolean } = {}) => {
  if (!opts.banner) {
    await page.addInitScript(() => localStorage.setItem('gimmy-storage-choice', JSON.stringify({ v: 1, preferences: true, at: new Date().toISOString() })))
  }
  await page.goto(path)
  await expect(page.getByRole('status', { name: 'Carregando Gimmy Cards' })).toHaveCount(0, { timeout: 60_000 })
}
const demoLogin = async (page: Page, label: string, back = '/conta') => {
  await ready(page, `/entrar?voltar=${encodeURIComponent(back)}`)
  await page.getByRole('button', { name: new RegExp(label) }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/entrar'))
}

test.describe('V3 refinements', () => {
  test('hero: mascot and cards are fully visible below the navbar @mobile', async ({ page }) => {
    await ready(page)
    await page.waitForTimeout(1800) // entrance animations settle
    const header = (await page.locator('header').first().boundingBox())!
    const vw = page.viewportSize()!.width
    const geo = await page.locator('section').first().evaluate((sec) => {
      const r = sec.getBoundingClientRect()
      const box = (el: Element) => { const b = el.getBoundingClientRect(); return { top: b.top, left: b.left, right: b.right, bottom: b.bottom - r.top, secH: r.height } }
      return {
        mascot: box(sec.querySelector('img[src*="/mascot/saltando"]')!),
        cards: [...sec.querySelectorAll('svg[viewBox="0 0 250 350"]')].map(box),
      }
    })
    expect(geo.mascot.top).toBeGreaterThan(header.y + header.height - 1)
    expect(geo.cards.length).toBe(3)
    for (const c of [geo.mascot, ...geo.cards]) {
      expect(c.left).toBeGreaterThanOrEqual(-1)
      expect(c.right).toBeLessThanOrEqual(vw + 1)
      expect(c.bottom).toBeLessThanOrEqual(c.secH + 1)
    }
    // the live/next auction ticket keeps the real countdown and access to the lots
    await expect(page.locator('section').first().getByRole('timer').or(page.locator('section').first().locator('[aria-label^="Encerra em"], [aria-label^="Começa em"]')).first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  })

  test('featured carousel never blocks vertical page scroll', async ({ page }) => {
    await ready(page)
    const track = page.locator('#featured-track')
    await track.scrollIntoViewIfNeeded()
    await expect(track.locator('a').first()).toBeVisible()
    const box = (await track.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    const before = await page.evaluate(() => scrollY)
    await page.mouse.wheel(0, 400)
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before + 100)
    await track.scrollIntoViewIfNeeded()
    const left0 = await track.evaluate((el) => el.scrollLeft)
    await page.getByRole('button', { name: 'Próximas cartas' }).click()
    await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(left0)
    await track.focus()
    const left1 = await track.evaluate((el) => el.scrollLeft)
    // keyboard: the strip may already be at its right edge, so go back
    await page.keyboard.press('ArrowLeft')
    await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeLessThan(left1)
  })

  test('featured strip lists only single cards (no combos)', async ({ page }) => {
    await ready(page)
    await page.locator('#featured-track').scrollIntoViewIfNeeded()
    await expect(page.locator('#featured-track a').first()).toBeVisible()
    const titles = await page.locator('#featured-track li p.font-semibold').allTextContents()
    expect(titles.length).toBeGreaterThan(0)
    expect(titles.some((t) => /combo/i.test(t))).toBe(false)
  })

  test('tutorial stepper navigates and the simulation steps and resets', async ({ page }) => {
    await ready(page)
    await page.getByRole('link', { name: 'Como participar?' }).first().click()
    await expect(page).toHaveURL(/#como-participar/)
    const panel = page.locator('#step-panel')
    await page.getByRole('tab', { name: /Acompanhar a disputa/ }).click()
    await expect(panel).toContainText('Simulação de classificação')
    const next = panel.getByRole('button', { name: 'Próximo passo' })
    for (let i = 0; i < 5; i++) await next.click()
    await expect(panel).toContainText('Maria recebe a oferta')
    const rows = await panel.locator('ol li').allTextContents()
    expect(rows[0]).toContain('João')
    expect(rows[1]).toContain('Maria')
    expect(rows[2]).toContain('Pedro')
    await panel.getByRole('button', { name: 'Reiniciar' }).click()
    await expect(panel).toContainText('Pedro já ofereceu')
    await page.getByRole('tab', { name: /Pagar e receber/ }).click()
    await expect(panel).toContainText('segunda, às 18h')
  })

  test('raffles: five official artworks with the right milestones, no invented status', async ({ page }) => {
    await ready(page, '/sorteios')
    const imgs = page.locator('img[src^="/sorteios/"]')
    await expect(imgs).toHaveCount(5)
    for (const i of await imgs.all()) {
      await i.scrollIntoViewIfNeeded()
      await expect.poll(() => i.evaluate((el: HTMLImageElement) => (el.complete ? el.naturalWidth : 0))).toBe(800)
    }
    const text = await page.locator('main').innerText()
    for (const [m, prize] of [['100', 'Triple 30 anos'], ['250', 'Box com Pôster 30 anos'], ['500', 'ETB 30 anos'], ['750', 'Box Binder 30 anos'], ['1.000', 'ETB 30 anos']]) {
      expect(text).toContain(`${m} membros`)
      expect(text).toContain(prize)
    }
    expect(text).not.toMatch(/vencedor|ganhador|sorteado/i)
  })

  test('rules: payment deadline is Monday 18h and group rules are separated', async ({ page }) => {
    await ready(page, '/regras')
    await expect(page.getByText('Segunda, até 18h').first()).toBeVisible()
    await page.locator('#pagamento').getByRole('button', { name: 'Regra completa' }).click()
    await expect(page.locator('#pagamento')).toContainText('segunda-feira seguinte ao encerramento, até 18h')
    await expect(page.locator('#comunidade')).toContainText('Grupo do WhatsApp')
    await expect(page.locator('#comunidade')).toContainText('um anúncio por dia')
    await expect(page.locator('body')).not.toContainText('23h59')
  })

  test('community links and the Or7 signature point to the official destinations', async ({ page }) => {
    await ready(page)
    await expect(page.getByRole('link', { name: /Entrar no grupo/ }).first()).toHaveAttribute('href', 'https://chat.whatsapp.com/Dp4ytYmoLYB9TMrAKZRm6q')
    await expect(page.getByRole('link', { name: /@gimmycards/ })).toHaveAttribute('href', 'https://www.instagram.com/gimmycards/')
    const or7 = page.getByRole('link', { name: /Or7 — idealizado e desenvolvido por Lorenzo Orsetti/ })
    await expect(or7).toHaveAttribute('href', 'https://lorenzo-or7.github.io/')
    await expect(or7).toHaveAttribute('target', '_blank')
    await expect(or7).toHaveAttribute('rel', 'noopener noreferrer')
  })

  test('cookie notice is compact, persists the choice and can be reopened', async ({ page }) => {
    await ready(page, '/', { banner: true })
    const banner = page.getByRole('region', { name: 'Aviso de cookies e armazenamento' })
    await expect(banner).toBeVisible()
    expect((await banner.boundingBox())!.height).toBeLessThan(110)
    await banner.getByRole('button', { name: 'Ok' }).click()
    await expect(banner).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('status', { name: 'Carregando Gimmy Cards' })).toHaveCount(0, { timeout: 60_000 })
    await page.waitForTimeout(1300)
    await expect(banner).toHaveCount(0)
    await page.getByRole('button', { name: 'Cookies e armazenamento' }).click()
    await expect(page.getByRole('dialog', { name: 'Cookies e armazenamento' })).toBeVisible()
  })

  test('combo page: 8-card combo gets a large adaptive gallery with flip and zoom', async ({ page }) => {
    await ready(page, '/leiloes')
    await page.locator('a[aria-label*="combo com 8 cartas"]').first().click()
    const tiles = page.locator('main ul.grid > li')
    await expect(tiles).toHaveCount(8)
    expect((await tiles.first().boundingBox())!.width).toBeGreaterThan(160)
    await tiles.first().getByRole('button', { name: 'Verso', exact: true }).click()
    await expect(tiles.first().getByRole('button', { name: 'Verso', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await tiles.first().getByRole('button', { name: /Ampliar/ }).click()
    await expect(page.getByRole('dialog', { name: 'Foto ampliada' })).toBeVisible()
  })

  test('favorites: add, list and remove a Pokémon', async ({ page }) => {
    await demoLogin(page, 'Participante · Lia', '/conta/favoritos')
    await expect(page.getByText('Dragonite', { exact: true })).toBeVisible()
    await page.getByLabel('Buscar Pokémon pelo nome ou número').fill('pika')
    await page.getByRole('button', { name: 'Favoritar Pikachu' }).click()
    await expect(page.getByRole('button', { name: 'Remover Pikachu', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Remover Pikachu', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Remover Pikachu', exact: true })).toHaveCount(0)
  })

  test('orders never show the old 23:59 deadline', async ({ page }) => {
    await demoLogin(page, 'Participante · Lia', '/conta/pedidos')
    await page.locator('a[href^="/conta/pedidos/"]').first().click()
    await expect(page.getByText(/Prazo|venceu/).first()).toBeVisible()
    expect(await page.locator('main').innerText()).not.toContain('23:59')
  })
})
