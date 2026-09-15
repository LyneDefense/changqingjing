import { expect, test } from '@playwright/test'

const operator = {
  id: 'guide-operator', loginName: 'guide.operator', displayName: '运营人员',
  role: 'OPERATOR', permissions: ['content:read', 'content:write', 'content:publish', 'media:write'],
}

test('guide is protected and the public login page carries the ICP link', async ({ page }) => {
  await page.route('**/api/v1/admin/auth/me', (route) => route.fulfill({ status: 401, json: { code: 'UNAUTHENTICATED', message: '请先登录' } }))
  await page.goto('guide')
  await expect(page).toHaveURL(/\/admin\/login$/)
  const filing = page.getByRole('link', { name: '鄂ICP备2025140094号-3' })
  await expect(filing).toBeVisible()
  await expect(filing).toHaveAttribute('href', 'https://beian.miit.gov.cn/')
  await expect(filing).toHaveAttribute('rel', 'noopener noreferrer')
})

test('operators read and search guidance without any business API writes', async ({ page }) => {
  const writes: string[] = []
  await page.route('**/api/v1/admin/**', async (route) => {
    if (route.request().method() !== 'GET') writes.push(route.request().method())
    if (new URL(route.request().url()).pathname.endsWith('/auth/me')) {
      await route.fulfill({ json: { data: operator } })
    } else {
      await route.abort()
    }
  })
  await page.goto('./')
  await page.getByRole('link', { name: '查看完整使用指南' }).click()
  await expect(page).toHaveURL(/\/admin\/guide$/)
  await expect(page.getByRole('heading', { name: '后台使用指南' })).toBeVisible()
  await expect(page.getByRole('link', { name: '使用指南', exact: true })).toHaveAttribute('aria-current', 'page')

  await page.getByRole('button', { name: '会员福利', exact: true }).click()
  await expect(page.getByText(/产品详情不是必填/)).toBeVisible()
  await expect(page.getByRole('link', { name: '进入会员福利' })).toHaveAttribute('href', '/admin/products')

  await page.getByRole('searchbox', { name: '搜索使用指南' }).fill('地图')
  await expect(page.getByRole('status')).toContainText('找到 2 个相关主题')
  await page.getByRole('button', { name: '常见问题 QA' }).click()
  const entry = page.locator('details').filter({ hasText: '不配置地图，景区能保存和发布吗？' })
  await entry.locator('summary').focus()
  await page.keyboard.press('Enter')
  await expect(entry).toHaveAttribute('open', '')
  await expect(entry.locator('p')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(entry).not.toHaveAttribute('open', '')

  await page.getByRole('button', { name: '清空搜索' }).click()
  await page.getByRole('searchbox', { name: '搜索使用指南' }).fill('qa')
  await expect(page.getByText('保存了草稿，为什么小程序里还是旧内容？')).toBeVisible()
  await page.getByRole('button', { name: '清空搜索' }).click()
  await page.getByRole('button', { name: '后台账号与权限' }).click()
  await expect(page.getByRole('link', { name: '进入后台人员' })).toHaveCount(0)
  for (const viewport of [{ width: 1366, height: 900 }, { width: 900, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    expect(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')).toBe(true)
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(243, 240, 232)')
    await expect(page.locator('.guide-article')).toHaveCSS('background-color', 'rgb(255, 253, 248)')
  }
  await page.getByRole('link', { name: '鄂ICP备2025140094号-3' }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('link', { name: '鄂ICP备2025140094号-3' })).toBeVisible()
  expect(writes).toEqual([])
})
