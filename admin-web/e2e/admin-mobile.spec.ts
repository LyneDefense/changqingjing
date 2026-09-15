import { expect, test } from '@playwright/test'

const admin = {
  id: 'mobile-admin', loginName: 'mobile.admin', displayName: '测试管理员', role: 'ADMIN',
  permissions: ['content:read', 'content:write', 'content:publish', 'media:write', 'user:read', 'user:manage', 'staff:manage'],
}

const updatedAt = '2026-09-09T08:00:00Z'
const listFixtures: Record<string, unknown[]> = {
  '/users': [{
    id: '2f3976a4-0ad8-448e-ab54-81baf5c2d391', displayName: '山水旅人', maskedPhone: '138****8000',
    phoneBound: true, wechatBound: true, status: 'ACTIVE', version: 0, registeredAt: updatedAt,
  }],
  '/staff': [{ id: 'staff-1', displayName: '运营人员', loginName: 'test.operator', role: 'OPERATOR', status: 'ACTIVE', version: 0 }],
  '/contents/home-videos': [{ id: 'video-1', title: '常清净山水文旅宣传视频', coverMediaId: 'cover-1', status: 'ONLINE', version: 0, updatedAt }],
  '/scenics': [{ id: 'scenic-1', title: '仙岛湖旅游风景区', status: 'ONLINE', openStatus: 'OPEN', displayOrder: 1, viewCount: 18, version: 0, updatedAt }],
  '/products': [{ id: 'product-1', name: '2021年乘风 易武高杆茶', categoryName: '茶与生活', status: 'ONLINE', displayOrder: 1, version: 0, updatedAt }],
}
const categories = [{ id: 'category-1', name: '茶与生活', displayOrder: 1, status: 'ONLINE', version: 0, updatedAt }]

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/admin/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1/admin', '')
    if (path === '/auth/me') return route.fulfill({ json: { data: admin } })
    if (path.startsWith('/media/')) return route.fulfill({ json: { data: {
      id: path.split('/').pop(), mediaType: 'IMAGE', status: 'READY', originalFilename: 'cover.jpg',
      previewUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="82" height="48"%3E%3Crect width="82" height="48" fill="%23dce6df"/%3E%3C/svg%3E',
    } } })
    if (path === '/product-categories') return route.fulfill({ json: { data: categories } })
    if (listFixtures[path]) return route.fulfill({ json: { data: { items: listFixtures[path], page: 1, pageSize: 20, total: listFixtures[path].length } } })
    return route.abort()
  })
})

for (const route of ['home-videos', 'scenics', 'products', 'users', 'staff']) {
  test(`${route} becomes readable phone cards without changing desktop tables`, async ({ page }) => {
    await page.goto(route)
    const table = page.getByRole('table')
    await expect(table.locator('tbody tr')).toHaveCount(1)
    for (const width of [320, 390, 760, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      await expect(table).toHaveCSS('display', width <= 760 ? 'block' : 'table')
      expect(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')).toBe(true)
      if (width <= 760) {
        await expect(table.locator('td[data-label]').first()).toHaveCSS('display', 'grid')
        await expect(table.locator('[data-card-actions] button').first()).toHaveCSS('min-height', '44px')
        for (const button of await table.locator('[data-card-actions] button').all()) {
          const box = await button.boundingBox()
          expect(box).not.toBeNull()
          expect(box!.x).toBeGreaterThanOrEqual(0)
          expect(box!.x + box!.width).toBeLessThanOrEqual(width)
        }
      }
    }
  })
}

test('phone category cards keep editing and confirmation dialogs usable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto('products')
  await page.getByRole('tab', { name: '产品分类设置' }).click()
  const table = page.getByRole('table')
  await expect(table).toHaveCSS('display', 'block')
  await expect(table.locator('[data-card-heading]')).toContainText('茶与生活')
  await table.getByRole('button', { name: '编辑', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const box = await dialog.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(320)
  await expect(dialog.getByRole('textbox', { name: '分类名称' })).toHaveValue('茶与生活')
  await dialog.getByRole('button', { name: '取消' }).click()
  await expect(dialog).toHaveCount(0)
})

test('phone navigation is a closable, keyboard-contained drawer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./')
  await expect(page.getByRole('heading', { name: '工作台', exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '管理后台主导航' })).not.toBeVisible()
  const trigger = page.getByRole('button', { name: '打开管理菜单', includeHidden: true })
  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  const drawer = page.getByRole('dialog', { name: '管理菜单' })
  await expect(drawer).toBeVisible()
  await expect(page.getByRole('button', { name: '关闭菜单', exact: true })).toBeFocused()
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
  await expect(page.locator('.admin-main')).toHaveAttribute('inert', '')
  await page.keyboard.press('Shift+Tab')
  await expect(drawer.getByRole('link').last()).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(drawer.getByRole('button', { name: '关闭菜单', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
  await trigger.click()
  await drawer.getByRole('link', { name: '使用指南', exact: true }).click()
  await expect(page).toHaveURL(/\/guide$/)
  await expect(page.getByRole('heading', { name: '后台使用指南' })).toBeVisible()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  expect(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')).toBe(true)
  await trigger.click()
  await page.getByRole('button', { name: '关闭菜单遮罩' }).click({ position: { x: 375, y: 200 } })
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
})

test('desktop retains its sidebar, header and warm colors', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('./')
  await expect(page.locator('.sidebar')).toHaveCSS('width', '248px')
  await expect(page.locator('.sidebar')).toHaveCSS('position', 'sticky')
  await expect(page.locator('.admin-header')).toHaveCSS('height', '68px')
  await expect(page.getByRole('navigation', { name: '管理后台主导航' })).toBeVisible()
  await expect(page.getByRole('button', { name: '打开管理菜单' })).not.toBeVisible()
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(243, 240, 232)')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '打开管理菜单' }).click()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
  await expect(page.locator('.sidebar')).not.toHaveAttribute('inert', '')
  await expect(page.locator('.admin-main')).not.toHaveAttribute('inert', '')
})
