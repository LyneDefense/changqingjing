import { expect, test } from '@playwright/test'

const audit = {
  id: 'ef7ba355-082b-4faf-89d1-311794f3fdad', actorLoginName: 'shared.admin', actorDisplayName: '内容管理员',
  action: 'COMPANY_DRAFT_SAVE', actionLabel: '保存草稿', module: 'COMPANY', moduleLabel: '公司介绍',
  targetType: 'CONTENT_ENTRY', targetName: '常清净公司介绍', result: 'SUCCESS', affectsOnline: false,
  clientIp: '198.51.100.24', clientSummary: 'Chrome / macOS', loginBatchId: 'd4dfcb21-512b-472f-b2f1-6380cdf9ff08',
  traceId: 'a4db951a-99cd-4672-817b-7ddf868d8682', changeSummary: ['简介修改', '新增 2 个媒体文件'],
  createdAt: '2026-09-15T10:00:00Z', historical: false,
}

for (const width of [1440, 390, 320]) {
  test(`audit filters and readonly drawer work without overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    const queries: URL[] = []
    await page.route('**/api/v1/admin/**', (route) => {
      const url = new URL(route.request().url())
      if (route.request().method() !== 'GET') return route.abort()
      if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: { data: {
        id: 'test-admin', loginName: 'test.admin', displayName: '管理员', role: 'ADMIN', permissions: ['audit:read', 'user:read', 'staff:manage', 'content:read'],
      } } })
      if (url.pathname.endsWith('/audit-events')) {
        queries.push(url)
        return route.fulfill({ json: { data: { items: [audit], page: 1, pageSize: 20, total: 1 } } })
      }
      if (url.pathname.endsWith(`/audit-events/${audit.id}`)) return route.fulfill({ json: { data: audit } })
      return route.abort()
    })
    await page.goto('audit-events')
    await expect(page.getByText('成功 · 未发布')).toBeVisible()
    await page.getByLabel('操作类型').selectOption('DRAFT_SAVE')
    await page.getByLabel('内容 / 来源 IP').fill('198.51.100.24')
    await page.getByRole('button', { name: '查询', exact: true }).click()
    await expect.poll(() => queries.some((url) => url.searchParams.get('action') === 'DRAFT_SAVE' && url.searchParams.get('keyword') === '198.51.100.24')).toBe(true)
    await expect(page.getByText('正在加载操作日志…')).not.toBeVisible()
    const details = page.getByRole('button', { name: '查看详情', exact: true })
    await details.click()
    const drawer = page.getByRole('dialog')
    await expect(drawer.getByText('简介修改')).toBeVisible()
    await expect(drawer.getByText(audit.loginBatchId)).toBeVisible()
    expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true)
    await page.keyboard.press('Escape')
    await expect(drawer).not.toBeVisible()
    await expect(details).toBeFocused()
    expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true)
  })
}
