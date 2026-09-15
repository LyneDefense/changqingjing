import { expect, test } from '@playwright/test'

const user = { id: 'recent-user', displayName: '山水旅人', maskedPhone: '138****9190', status: 'ACTIVE', registeredAt: '2026-09-15T00:00:00Z', phoneBound: true, wechatBound: true, version: 0 }
const operation = { id: 'recent-audit', actorLoginName: 'test.admin', actorDisplayName: '管理员', action: 'SCENIC_PUBLISH', actionLabel: '发布', module: 'SCENIC', moduleLabel: '景区管理', targetType: 'CONTENT_ENTRY', targetName: '仙岛湖旅游风景区', result: 'SUCCESS', affectsOnline: true, clientIp: '198.51.100.24', clientSummary: 'Chrome / macOS', traceId: 'test-trace', changeSummary: ['发布当前草稿到线上'], createdAt: '2026-09-15T01:00:00Z', historical: false }
const statistics = { totalRegistrations: 128, todayRegistrations: 3, last7DaysRegistrations: 15, frozenUsers: 2 }

for (const width of [1440, 390, 320]) {
  test(`dashboard metrics, periods and direct details work at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.route('**/api/v1/admin/**', (route) => {
      const url = new URL(route.request().url()), path = url.pathname.replace('/api/v1/admin', '')
      if (route.request().method() !== 'GET') return route.abort()
      if (path === '/auth/me') return route.fulfill({ json: { data: { id: 'test-admin', loginName: 'test.admin', displayName: '管理员', role: 'ADMIN', permissions: ['user:read', 'user:manage', 'staff:manage', 'content:read', 'audit:read'] } } })
      if (path === '/dashboard') {
        const days = Number(url.searchParams.get('days') || 7)
        return route.fulfill({ json: { data: { userMetricsVisible: true, statistics, registrationTrend: Array.from({ length: days }, (_, i) => ({ date: new Date(Date.UTC(2026, 8, 15 - days + 1 + i)).toISOString().slice(0, 10), count: i === days - 1 ? 3 : 2 })), recentUsers: [user], recentOperations: [operation], trendDays: days, generatedAt: '2026-09-15T01:00:00Z', timezone: 'Asia/Shanghai' } } })
      }
      if (path === '/users') return route.fulfill({ json: { data: { items: [user], page: 1, pageSize: 20, total: 1 } } })
      if (path === `/users/${user.id}`) return route.fulfill({ json: { data: user } })
      if (path === '/audit-events') return route.fulfill({ json: { data: { items: [operation], page: 1, pageSize: 20, total: 1 } } })
      if (path === `/audit-events/${operation.id}`) return route.fulfill({ json: { data: operation } })
      return route.abort()
    })
    await page.goto('./')
    await expect(page.getByText('128', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '近 30 天' }).click()
    await expect(page.getByRole('img', { name: '近 30 天首次注册趋势，共新增 61 人' })).toBeVisible()
    expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true)
    await page.getByRole('link', { name: /山水旅人/ }).click()
    await expect(page.getByRole('dialog', { name: '注册用户详情' }).getByText('山水旅人')).toBeVisible()
    await page.getByRole('button', { name: '关闭', exact: true }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await page.goto('./')
    await page.getByRole('link', { name: /景区管理 · 发布/ }).click()
    await expect(page.getByRole('dialog', { name: '操作详情' }).getByText('发布当前草稿到线上')).toBeVisible()
    expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true)
  })
}

test('operator dashboard has no registered-user data or navigation', async ({ page }) => {
  await page.route('**/api/v1/admin/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/auth/me')) return route.fulfill({ json: { data: { id: 'operator', displayName: '运营', role: 'OPERATOR', permissions: ['content:read', 'audit:read'] } } })
    if (path.endsWith('/dashboard')) return route.fulfill({ json: { data: { userMetricsVisible: false, statistics: null, registrationTrend: [], recentUsers: [], recentOperations: [{ ...operation, actorDisplayName: '运营' }], trendDays: 7, generatedAt: '2026-09-15T01:00:00Z', timezone: 'Asia/Shanghai' } } })
    return route.abort()
  })
  await page.goto('./')
  await expect(page.getByRole('heading', { name: '最近操作' })).toBeVisible()
  await expect(page.getByText('仅自己的最新 6 条操作')).toBeVisible()
  await expect(page.getByText('累计注册')).not.toBeVisible()
  await expect(page.getByRole('heading', { name: '最近注册' })).not.toBeVisible()
  await expect(page.getByRole('link', { name: '查看注册用户' })).not.toBeVisible()
})
