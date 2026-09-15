import { expect, test } from '@playwright/test'

const admin = {
  id: 'mobile-admin', loginName: 'mobile.admin', displayName: '测试管理员', role: 'ADMIN',
  permissions: ['content:read', 'content:write', 'content:publish', 'media:write', 'user:read', 'user:manage', 'staff:manage'],
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/admin/**', (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/auth/me')) return route.fulfill({ json: { data: admin } })
    return route.abort()
  })
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
