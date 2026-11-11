import { expect, test, type Page } from '@playwright/test'
import sharp from 'sharp'

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
/** A plain photo-like PNG (card on a table) generated for the upload test. */
async function photo(color: string) {
  const card = await sharp({ create: { width: 500, height: 700, channels: 3, background: color } }).png().toBuffer()
  return sharp({ create: { width: 1000, height: 900, channels: 3, background: '#6b4f3a' } })
    .composite([{ input: card, left: 250, top: 100 }])
    .png()
    .toBuffer()
}

test.describe('V4 redesign', () => {
  test('"Ao vivo" indicators are red, with text, and only on live lots', async ({ page }) => {
    await ready(page, '/leiloes')
    const badges = page.locator('main span.bg-live', { hasText: /^Ao vivo$/ })
    await expect(badges.first()).toBeVisible()
    const bg = await badges.first().evaluate((el) => getComputedStyle(el).backgroundColor)
    const [r, g, b] = bg.match(/\d+/g)!.map(Number)
    expect(r).toBeGreaterThan(180)
    expect(g).toBeLessThan(80)
    expect(b).toBeLessThan(90)
    // upcoming auctions never show the live indicator
    await page.goto('/leiloes/proximos')
    await expect(page.getByRole('heading', { name: 'Próximos leilões' })).toBeVisible()
    await expect(page.locator('main span.bg-live')).toHaveCount(0)
  })

  test('navbar keeps its size and logo position while scrolling', async ({ page }) => {
    await ready(page)
    const nav = page.getByRole('navigation', { name: 'Principal' })
    const logo = nav.getByRole('link', { name: /página inicial/ })
    const a = { nav: (await nav.boundingBox())!, logo: (await logo.boundingBox())! }
    await page.mouse.wheel(0, 1600)
    await page.waitForTimeout(600)
    const b = { nav: (await nav.boundingBox())!, logo: (await logo.boundingBox())! }
    expect(Math.abs(a.nav.height - b.nav.height)).toBeLessThanOrEqual(1)
    expect(Math.abs(a.logo.x - b.logo.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(a.logo.y - b.logo.y)).toBeLessThanOrEqual(1)
  })

  test('admin crops front and back photos and saves the card', async ({ page }) => {
    await demoLogin(page, 'Administrador principal', '/admin/cartas')
    await page.getByRole('button', { name: 'Nova carta' }).click()
    const dialog = page.getByRole('dialog', { name: 'Nova carta' })
    await dialog.locator('input[type=file]').nth(0).setInputFiles({ name: 'frente.png', mimeType: 'image/png', buffer: await photo('#d9b44a') })
    await dialog.locator('input[type=file]').nth(1).setInputFiles({ name: 'verso.png', mimeType: 'image/png', buffer: await photo('#2b4fa3') })

    for (const [i, side] of [[0, 'Frente'], [1, 'Verso']] as const) {
      await dialog.getByRole('button', { name: 'Ajustar imagem' }).nth(i).click()
      const editor = page.getByRole('dialog', { name: `Ajustar imagem · ${side}` })
      await expect(editor).toBeVisible()
      await editor.getByRole('button', { name: '90° direita' }).click()
      await editor.getByRole('slider', { name: /Zoom/ }).fill('1.3')
      await editor.getByRole('button', { name: 'Aplicar recorte' }).click()
      await expect(editor).toHaveCount(0)
    }
    await expect(dialog.getByText('Ajustada')).toHaveCount(2)
    // restore one side, then re-crop it to prove both paths work
    await dialog.getByRole('button', { name: 'Restaurar original' }).first().click()
    await expect(dialog.getByText('Ajustada')).toHaveCount(1)
    await dialog.getByRole('button', { name: 'Ajustar imagem' }).first().click()
    await page.getByRole('dialog', { name: 'Ajustar imagem · Frente' }).getByRole('button', { name: 'Aplicar recorte' }).click()
    await expect(dialog.getByText('Ajustada')).toHaveCount(2)

    await dialog.getByLabel('Título').fill('Carta recortada E2E')
    await dialog.getByRole('button', { name: 'Salvar carta' }).click()
    await expect(page.getByText('Carta cadastrada')).toBeVisible()
    await page.getByLabel('Buscar carta').fill('recortada')
    const tile = page.locator('li', { hasText: 'Carta recortada E2E' })
    await expect(tile).toBeVisible()
    // saved images are the cropped results (portrait, close to 5:7), served from the stored path
    const ratios = await tile.locator('img').evaluateAll((imgs) => Promise.all((imgs as HTMLImageElement[]).map(async (i) => { await i.decode().catch(() => {}); return i.naturalWidth / i.naturalHeight })))
    expect(ratios.length).toBe(2)
    for (const r of ratios) expect(Math.abs(r - 5 / 7)).toBeLessThan(0.03)
  })

  test('privacy page: table of contents jumps to sections and legal notice stays', async ({ page }) => {
    await ready(page, '/privacidade')
    await expect(page.getByText('Texto inicial para revisão jurídica.')).toBeVisible()
    const toc = page.getByRole('navigation', { name: 'Índice' })
    await toc.getByRole('link', { name: /Comprovantes de pagamento/ }).click()
    await expect(page).toHaveURL(/#comprovantes/)
    await expect(page.locator('#comprovantes')).toBeInViewport()
  })

  test('mascot art loads from optimised assets', async ({ page }) => {
    await ready(page, '/leiloes')
    const img = page.locator('img[src^="/mascot/leiloeiro"]')
    await expect(img).toBeVisible()
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => (el.complete ? el.naturalWidth : 0))).toBeGreaterThan(0)
  })
})
