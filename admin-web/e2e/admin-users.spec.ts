import { expect, test } from '@playwright/test'

const admin = {
  id: 'users-admin', loginName: 'test.admin', displayName: '测试管理员', role: 'ADMIN',
  permissions: ['content:read', 'user:read', 'user:manage', 'staff:manage'],
}

for (const width of [1366, 390]) {
test(`administrator confirms freeze, unfreeze and deletion at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  let users = [{
    id: '2f3976a4-0ad8-448e-ab54-81baf5c2d391', displayName: '山水旅人', maskedPhone: '138****8000',
    phoneBound: true, wechatBound: true, status: 'ACTIVE', version: 0, registeredAt: '2026-09-09T08:00:00Z',
  }]
  const writes: Array<{ method: string; version: number }> = []
  await page.route('**/api/v1/admin/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: { data: admin } })
    if (url.pathname.endsWith('/auth/csrf')) return route.fulfill({ json: { data: { headerName: 'X-CSRF-TOKEN', parameterName: '_csrf', token: 'test-users-csrf' } } })
    if (request.method() === 'PATCH') {
      expect(request.headers()['x-csrf-token']).toBe('test-users-csrf')
      const body = request.postDataJSON()
      expect(body.expectedVersion).toBe(users[0].version)
      writes.push({ method: 'PATCH', version: body.expectedVersion })
      users[0] = { ...users[0], status: body.status, version: users[0].version + 1 }
      return route.fulfill({ json: { data: users[0] } })
    }
    if (request.method() === 'DELETE') {
      expect(request.headers()['x-csrf-token']).toBe('test-users-csrf')
      expect(Number(url.searchParams.get('expectedVersion'))).toBe(users[0].version)
      writes.push({ method: 'DELETE', version: users[0].version })
      users = []
      return route.fulfill({ json: { data: 'deleted' } })
    }
    if (url.pathname.endsWith('/users')) return route.fulfill({ json: { data: { items: users, page: 1, pageSize: 20, total: users.length } } })
    return route.fulfill({ json: { data: users[0] } })
  })
  await page.goto('users')
  await expect(page.getByText('山水旅人', { exact: true })).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(243, 240, 232)')
  await page.getByRole('button', { name: '冻结', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCSS('background-color', 'rgb(255, 253, 248)')
  await expect(page.getByRole('button', { name: '取消' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: '确认冻结' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: '取消' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(writes).toEqual([])
  await page.getByRole('button', { name: '冻结', exact: true }).click()
  await page.getByRole('button', { name: '确认冻结' }).click()
  await expect(page.getByRole('button', { name: '解冻', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '解冻', exact: true }).click()
  await page.getByRole('button', { name: '确认解冻' }).click()
  await expect(page.getByRole('button', { name: '冻结', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '删除', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('此操作无法撤销')
  await expect(page.getByRole('dialog')).toContainText('138****8000')
  await page.getByRole('button', { name: '确认删除' }).click()
  await expect(page.getByText('没有符合条件的注册用户。')).toBeVisible()
  expect(writes).toEqual([{ method: 'PATCH', version: 0 }, { method: 'PATCH', version: 1 }, { method: 'DELETE', version: 2 }])
})
}

test('operator cannot navigate to registered-user management', async ({ page }) => {
  await page.route('**/api/v1/admin/auth/me', (route) => route.fulfill({ json: { data: {
    ...admin, role: 'OPERATOR', permissions: ['content:read', 'content:write'],
  } } }))
  await page.goto('users')
  await expect(page).toHaveURL(/\/admin\/forbidden$/)
  await expect(page.getByRole('button', { name: /冻结|解冻|删除/ })).toHaveCount(0)
})
