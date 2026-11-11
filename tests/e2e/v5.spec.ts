import { expect, test, type Page } from '@playwright/test'

const ready = async (page: Page, path = '/') => {
  await page.addInitScript(() => localStorage.setItem('gimmy-storage-choice', JSON.stringify({ v: 1, preferences: true, at: new Date().toISOString() })))
  await page.goto(path)
  await expect(page.getByRole('status', { name: 'Carregando Gimmy Cards' })).toHaveCount(0, { timeout: 60_000 })
}
const demoLogin = async (page: Page, label: string, back = '/conta') => {
  await ready(page, `/entrar?voltar=${encodeURIComponent(back)}`)
  await page.getByRole('button', { name: new RegExp(label) }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/entrar'))
}
const nav = (page: Page) => page.getByRole('navigation', { name: 'Principal' })
/** Horizontal distance between the logo centre and the viewport centre. */
const logoOffset = (page: Page) =>
  nav(page)
    .getByRole('link', { name: /página inicial/ })
    .evaluate((el) => {
      const r = el.getBoundingClientRect()
      return Math.abs(r.left + r.width / 2 - document.documentElement.clientWidth / 2)
    })

test.describe('V5 navbar', () => {
  test('logo stays on the geometric centre: signed out, signed in, scrolled and at 1024px', async ({ page }) => {
    await ready(page, '/')
    expect(await logoOffset(page)).toBeLessThanOrEqual(1)
    await page.mouse.wheel(0, 1400)
    await page.waitForTimeout(500)
    expect(await logoOffset(page)).toBeLessThanOrEqual(1)

    await demoLogin(page, 'Administrador principal', '/leiloes')
    await expect(nav(page).getByRole('button', { name: /Menu da conta/ })).toBeVisible()
    await expect(nav(page).getByRole('button', { name: /^Notificações/ })).toBeVisible()
    expect(await logoOffset(page)).toBeLessThanOrEqual(1)

    await page.setViewportSize({ width: 1024, height: 768 })
    expect(await logoOffset(page)).toBeLessThanOrEqual(1)
    // nothing is clipped and the links never run into the logo
    const fits = await nav(page).evaluate((n) => {
      const cols = [...n.children].filter((c) => c.tagName !== 'SPAN') as HTMLElement[]
      const logo = cols[1].getBoundingClientRect()
      const leftEnd = (cols[0].lastElementChild as HTMLElement).getBoundingClientRect().right
      const rightStart = (cols[2].firstElementChild as HTMLElement).getBoundingClientRect().left
      return cols.every((c) => c.scrollWidth <= c.clientWidth) && leftEnd < logo.left && rightStart > logo.right
    })
    expect(fits).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
  })

  test('exactly one active indicator, following the current page', async ({ page }) => {
    await ready(page, '/catalogo')
    const current = nav(page).locator('a[aria-current="page"]')
    await expect(current).toHaveCount(1)
    await expect(current).toHaveText('Catálogo')
    await expect(nav(page).locator('a span.bg-accent')).toHaveCount(1)
    await nav(page).getByRole('link', { name: 'Histórico' }).click()
    await expect(current).toHaveText('Histórico')
    await expect(nav(page).locator('a span.bg-accent')).toHaveCount(1)
  })

  test('theme, notifications and profile menu work from the bar; logout returns "Entrar"', async ({ page }) => {
    await demoLogin(page, 'Participante · Lia', '/')
    const theme = nav(page).getByRole('switch', { name: /Mudar para tema/ })
    const before = await page.evaluate(() => document.documentElement.dataset.theme)
    await theme.click()
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).not.toBe(before)

    await nav(page).getByRole('button', { name: /^Notificações/ }).click()
    await expect(page.getByText('Ver todas')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByText('Ver todas')).toHaveCount(0)

    const menuButton = nav(page).getByRole('button', { name: /Menu da conta/ })
    await menuButton.click()
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true')
    await page.getByRole('menuitem', { name: 'Sair' }).click()
    await expect(nav(page).getByRole('link', { name: 'Entrar' })).toBeVisible()
    expect(await logoOffset(page)).toBeLessThanOrEqual(1)
  })

  test('keyboard reaches every navbar control with a visible focus ring', async ({ page }) => {
    await ready(page, '/')
    const seen: string[] = []
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab')
      const info = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement
        if (!a.closest('nav[aria-label="Principal"]')) return null
        return { name: a.getAttribute('aria-label') ?? a.textContent?.trim() ?? '', outline: getComputedStyle(a).outlineStyle }
      })
      if (info) {
        expect(info.outline).not.toBe('none')
        seen.push(info.name)
      }
    }
    for (const n of ['Início', 'Leilões', 'Catálogo', 'Sorteios', 'Histórico', 'Minha Conta', 'Entrar']) expect(seen.join('|')).toContain(n)
    expect(seen.some((s) => /página inicial/.test(s))).toBe(true)
    expect(seen.some((s) => /Mudar para tema/.test(s))).toBe(true)
  })

  test('demo session survives repeated full reloads', async ({ page }) => {
    await demoLogin(page, 'Participante · Lia', '/leiloes')
    for (const path of ['/catalogo', '/', '/historico', '/conta']) {
      await page.goto(path)
      await expect(page.getByRole('status', { name: 'Carregando Gimmy Cards' })).toHaveCount(0, { timeout: 60_000 })
      await expect(nav(page).getByRole('button', { name: /Menu da conta/ })).toBeVisible()
    }
    await expect(page).toHaveURL(/\/conta$/)
  })

  test('mobile header keeps theme, notifications and profile; bottom bar navigates @mobile', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile layout only')
    await demoLogin(page, 'Participante · Lia', '/')
    await expect(nav(page)).toBeHidden()
    const top = page.locator('header')
    await expect(top.getByRole('switch', { name: /Mudar para tema/ }).last()).toBeVisible()
    await expect(top.getByRole('button', { name: /^Notificações/ }).last()).toBeVisible()
    await expect(top.getByRole('button', { name: /Menu da conta/ }).last()).toBeVisible()
    const bottom = page.getByRole('navigation', { name: 'Navegação inferior' })
    await bottom.getByRole('link', { name: 'Catálogo' }).click()
    await expect(page).toHaveURL(/\/catalogo$/)
    for (const b of await top.getByRole('button').all()) {
      if (!(await b.isVisible())) continue
      const box = (await b.boundingBox())!
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(40)
    }
  })
})

test.describe('V5 mascot library', () => {
  test('all ten official poses are served as WebP (900px and 360px)', async ({ page }) => {
    await ready(page, '/')
    const files = ['leiloeiro', 'cartas', 'animado', 'dormindo', 'voando', 'saltando', 'acenando', 'triste', 'comemorando', 'confuso']
    for (const f of files)
      for (const s of ['', '-sm']) {
        const r = await page.request.get(`/mascot/${f}${s}.webp`)
        expect(r.status(), `${f}${s}`).toBe(200)
        expect(r.headers()['content-type']).toContain('image/webp')
      }
  })

  test('confused pose marks "no results"', async ({ page }) => {
    await ready(page, '/catalogo')
    await page.getByLabel('Buscar por nome ou coleção').fill('zzzz-nada-encontrado')
    await expect(page.getByText('Nenhuma carta com esses filtros')).toBeVisible()
    await expect(page.locator('img[data-mascot="confused"]')).toBeVisible()
  })

  test('celebrating pose appears only after the server confirms', async ({ page }) => {
    await demoLogin(page, 'Participante · Rafael', '/leiloes')
    await page.locator('a[href^="/lote/"]').first().click()
    await page.getByRole('button', { name: /Arrematar agora por/ }).click()
    await page.getByRole('dialog', { name: 'Arrematar agora?' }).getByRole('button', { name: 'Continuar' }).click()
    const final = page.getByRole('dialog', { name: 'Confirmação final' })
    await final.getByRole('checkbox').check()
    // still unconfirmed: no celebration anywhere
    await expect(page.locator('img[data-mascot="celebrating"]')).toHaveCount(0)
    await final.getByRole('button', { name: /Comprar por/ }).click()
    const done = page.getByRole('dialog', { name: 'Arremate confirmado!' })
    await expect(done.locator('img[data-mascot="celebrating"]')).toBeVisible()
    await done.getByRole('button', { name: 'Fechar' }).first().click()
    await expect(page.getByText('Você venceu este lote!')).toBeVisible()
    await expect(page.locator('img[data-mascot="celebrating"]')).toBeVisible()

    // a paid order (confirmed by the team in the seed) celebrates too
    await page.goto('/conta/pedidos')
    await page.getByRole('link', { name: /Pago|pago/ }).first().click()
    await expect(page.getByText('Pagamento confirmado.', { exact: false })).toBeVisible()
  })
})
