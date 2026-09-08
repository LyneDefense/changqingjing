import { expect, test } from '@playwright/test'

const admin = {
  id: '5be477df-6394-4037-aa38-d2b901f5eaf4',
  loginName: 'roadmap.admin',
  displayName: 'Roadmap 管理员',
  role: 'ADMIN',
  permissions: [
    'content:read',
    'content:write',
    'content:publish',
    'media:write',
    'user:read',
    'staff:manage',
  ],
}

test('an administrator logs in and opens staff management', async ({ page }) => {
  let loginCsrfHeader = ''
  await page.route('**/api/v1/admin/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.endsWith('/auth/me')) {
      await route.fulfill({
        status: 401,
        json: { code: 'UNAUTHENTICATED', message: '请先登录', traceId: 'e2e-me' },
      })
      return
    }
    if (path.endsWith('/auth/csrf')) {
      await route.fulfill({
        json: {
          data: {
            headerName: 'X-CSRF-TOKEN',
            parameterName: '_csrf',
            token: 'browser-csrf',
          },
        },
      })
      return
    }
    if (path.endsWith('/auth/login')) {
      loginCsrfHeader = request.headers()['x-csrf-token'] ?? ''
      await route.fulfill({ json: { data: admin } })
      return
    }
    if (path.endsWith('/staff')) {
      await route.fulfill({
        json: {
          data: {
            items: [{
              ...admin,
              status: 'ACTIVE',
              lastLoginAt: '2026-09-08T08:00:00Z',
              createdAt: '2026-09-08T07:00:00Z',
              updatedAt: '2026-09-08T08:00:00Z',
              version: 0,
            }],
            page: 1,
            pageSize: 20,
            total: 1,
          },
        },
      })
      return
    }
    await route.abort()
  })

  await page.goto('login')
  await expect(page.getByRole('heading', { name: '登录内容管理后台' })).toBeVisible()
  await page.getByLabel('登录账号').fill('roadmap.admin')
  await page.getByLabel('密码').fill('RoadmapAdmin2026')
  await page.getByRole('button', { name: '登录' }).click()

  await expect(page.getByRole('heading', { name: '工作台' })).toBeVisible()
  expect(loginCsrfHeader).toBe('browser-csrf')
  expect(await page.evaluate(() => localStorage.length)).toBe(0)

  await page.getByRole('link', { name: '人员管理' }).click()
  await expect(page.getByRole('heading', { name: '人员管理' })).toBeVisible()
  await expect(page.getByText('Roadmap 管理员', { exact: true })).toBeVisible()
})
