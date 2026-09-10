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
  let companyContent: Record<string, unknown> = {
    version: 0,
    visibility: 'HIDDEN',
  }
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
    if (path.endsWith('/contents/company') && request.method() === 'GET') {
      await route.fulfill({ json: { data: companyContent } })
      return
    }
    if (path.endsWith('/contents/home-video') && request.method() === 'GET') {
      await route.fulfill({
        json: { data: { version: 0, visibility: 'HIDDEN' } },
      })
      return
    }
    if (path.endsWith('/contents/company/draft')) {
      const input = request.postDataJSON() as {
        title: string
        summary: string
        galleryMediaIds: string[]
        blocks: Array<{ type: string; text: string }>
      }
      const draft = {
        id: 'a3feeaad-6e0d-4b02-8455-f0f624349b76',
        revisionNumber: 1,
        ...input,
        createdBy: admin.id,
        createdAt: '2026-09-08T08:00:00Z',
      }
      companyContent = {
        id: 'b8e14ee4-d727-4164-a82a-196b23c94c3d',
        version: 1,
        visibility: 'HIDDEN',
        updatedAt: '2026-09-08T08:00:00Z',
        draft,
      }
      await route.fulfill({ json: { data: companyContent } })
      return
    }
    if (path.endsWith('/contents/company/publish')) {
      companyContent = {
        ...companyContent,
        version: 2,
        visibility: 'PUBLISHED',
        firstPublishedAt: '2026-09-08T08:05:00Z',
        published: companyContent.draft,
      }
      await route.fulfill({ json: { data: companyContent } })
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

  await expect(page.getByRole('link', { name: '首页宣传视频', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '公司介绍', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '景区管理', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '会员福利管理', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '收益板块管理', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '分公司方案', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '会员体系', exact: true })).toBeVisible()

  await page.getByRole('link', { name: '后台人员', exact: true }).click()
  await expect(page.getByRole('heading', { name: '人员管理' })).toBeVisible()
  await expect(page.getByText('Roadmap 管理员', { exact: true })).toBeVisible()

  await page.getByRole('link', { name: '公司介绍', exact: true }).click()
  await expect(page.getByRole('heading', { name: '公司介绍管理' })).toBeVisible()
  await page.getByLabel('标题', { exact: true }).fill('常清净文旅投介绍')
  await page.getByLabel('首页简介').fill('发现文化与山水的连接')
  await page.getByLabel('第 1 个板块标题').fill('公司简介')
  await page.getByLabel('第 1 个板块文字内容').fill('公司介绍正文')
  await page.getByRole('button', { name: '保存草稿' }).click()
  await expect(page.getByText('第 1 版')).toBeVisible()
  await page.getByRole('button', { name: '发布', exact: true }).click()
  await expect(page.getByText('线上展示中')).toBeVisible()
})
