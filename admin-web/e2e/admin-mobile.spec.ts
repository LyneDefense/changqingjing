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
const coverUrl = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="82" height="48"%3E%3Crect width="82" height="48" fill="%23dce6df"/%3E%3C/svg%3E'
const companyRevision = {
  id: 'revision-1', revisionNumber: 1, title: '公司介绍', summary: '深耕文旅，筑就清净生态',
  coverMediaId: 'cover-1', galleryMediaIds: [], createdBy: admin.id, createdAt: updatedAt,
  blocks: [
    { type: 'HEADING', text: '公司简介' }, { type: 'PARAGRAPH', text: '连接文化、山水与生活。' },
    { type: 'IMAGE', mediaId: 'cover-2', altText: '公司山水' },
    { type: 'HEADING', text: '企业愿景' }, { type: 'PARAGRAPH', text: '以文旅为桥，创造合作价值。' },
  ],
}
const editorFixtures: Record<string, unknown> = {
  '/contents/home-hero': { version: 1, visibility: 'PUBLISHED', draft: { ...companyRevision }, published: { ...companyRevision } },
  '/contents/company': { version: 1, visibility: 'PUBLISHED', updatedAt, draft: companyRevision, published: companyRevision },
  '/contents/cooperation': {
    version: 1, visibility: 'PUBLISHED', draft: {
      ...companyRevision,
      revenueSections: [{ title: '招商收益', description: '融资、分公司合作', icon: 'cooperate', displayOrder: 0 }],
      valueSections: [{ title: '资源整合', description: '链接传统文化、文旅资源、高端人脉，助力长期发展', displayOrder: 0 }],
    },
  },
  '/scenics/scenic-1': { id: 'scenic-1', version: 1, visibility: 'PUBLISHED', draft: { ...companyRevision, title: '仙岛湖旅游风景区', openStatus: 'OPEN', displayOrder: 1 }, published: { ...companyRevision, openStatus: 'OPEN' } },
  '/products/product-1': { id: 'product-1', version: 1, visibility: 'PUBLISHED', draft: { ...companyRevision, name: '2021年乘风 易武高杆茶', categoryId: 'category-1', listImageMediaIds: ['cover-1', 'cover-2'], displayOrder: 1, blocks: [] }, published: companyRevision },
  '/contents/home-videos/video-1': { id: 'video-1', version: 1, visibility: 'PUBLISHED', draft: { ...companyRevision, title: '常清净山水文旅宣传视频', videoMediaId: 'video-media-1' }, published: companyRevision },
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/admin/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1/admin', '')
    if (route.request().method() !== 'GET') return route.abort()
    if (path === '/auth/me') return route.fulfill({ json: { data: admin } })
    if (path.startsWith('/media/')) return route.fulfill({ json: { data: {
      id: path.split('/').pop(), mediaType: 'IMAGE', status: 'READY', originalFilename: 'cover.jpg',
      previewUrl: coverUrl,
    } } })
    if (path === '/product-categories') return route.fulfill({ json: { data: categories } })
    if (editorFixtures[path]) return route.fulfill({ json: { data: editorFixtures[path] } })
    if (listFixtures[path]) return route.fulfill({ json: { data: { items: listFixtures[path], page: 1, pageSize: 20, total: listFixtures[path].length } } })
    return route.abort()
  })
})

for (const mediaType of ['IMAGE', 'VIDEO']) {
  test(`phone selects and uploads ${mediaType} through the existing COS workflow`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const filename = mediaType === 'IMAGE' ? 'mobile-photo.png' : 'mobile-video.mp4'
    const contentType = mediaType === 'IMAGE' ? 'image/png' : 'video/mp4'
    const ready = {
      id: 'mobile-upload-1', originalFilename: filename, mediaType, contentType, status: 'READY',
      previewUrl: mediaType === 'IMAGE' ? coverUrl : 'data:video/mp4;base64,AAAAHGZ0eXBpc29t',
    }
    let cosPuts = 0
    await page.route('**/api/v1/admin/auth/csrf', (route) => route.fulfill({ json: { data: { headerName: 'X-CSRF-TOKEN', parameterName: '_csrf', token: 'mobile-test-csrf' } } }))
    await page.route('**/api/v1/admin/media/uploads', (route) => {
      expect(route.request().headers()['x-csrf-token']).toBe('mobile-test-csrf')
      expect(route.request().postDataJSON()).toMatchObject({ originalFilename: filename, contentType, mediaType })
      const now = Math.floor(Date.now() / 1000)
      return route.fulfill({ json: { data: {
        media: { ...ready, status: 'UPLOADING' },
        upload: {
          bucket: 'mobile-test-12345', region: 'ap-guangzhou', objectKey: `uploads/${filename}`,
          credentials: { secretId: 'test-id', secretKey: 'test-key', sessionToken: 'test-token', startTime: now - 5, expiredTime: now + 300 },
        },
      } } })
    })
    await page.route('**/mobile-test-12345.cos.ap-guangzhou.myqcloud.com/**', (route) => {
      if (route.request().method() === 'PUT') cosPuts++
      return route.fulfill({ status: 200, body: '', headers: {
        'access-control-allow-origin': '*', 'access-control-allow-methods': 'PUT, OPTIONS',
        'access-control-allow-headers': '*', 'access-control-expose-headers': 'ETag', ETag: '"mobile-test-etag"',
      } })
    })
    await page.route('**/api/v1/admin/media/uploads/mobile-upload-1/complete', (route) => {
      expect(cosPuts).toBe(1)
      return route.fulfill({ json: { data: ready } })
    })
    await page.route('**/api/v1/admin/media/mobile-upload-1', (route) => route.fulfill({ json: { data: ready } }))
    await page.goto(mediaType === 'IMAGE' ? 'home-hero' : 'home-videos')
    if (mediaType === 'VIDEO') await page.getByRole('table').getByRole('button', { name: '编辑', exact: true }).click()
    const input = page.getByLabel(mediaType === 'IMAGE' ? '选择头图图片' : '选择宣传视频文件')
    const field = input.locator('..').locator('..').locator('..')
    await expect(field.locator('.mobile-upload-hint')).toBeVisible()
    const chooserPromise = page.waitForEvent('filechooser')
    await field.locator('.file-button').click()
    const chooser = await chooserPromise
    await chooser.setFiles({ name: filename, mimeType: contentType, buffer: Buffer.from('mobile-test-content') })
    await expect(field.locator('.media-ready')).toHaveText('已校验')
    expect(cosPuts).toBe(1)
    await expect(page.getByRole('button', { name: '保存草稿', exact: true })).toBeEnabled()
    if (mediaType === 'IMAGE') await expect(field.getByRole('img', { name: filename })).toBeVisible()
    else await expect(field.locator('video')).toBeVisible()
    expect(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')).toBe(true)
  })
}

test('phone editors preserve unsaved-input and upload-error feedback', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('company')
  await page.getByRole('textbox', { name: '标题', exact: true }).fill('尚未保存的公司介绍')
  await page.getByRole('button', { name: '打开管理菜单' }).click()
  const prompt = page.waitForEvent('dialog')
  const navigation = page.getByRole('dialog', { name: '管理菜单' }).getByRole('link', { name: '使用指南' }).click()
  await (await prompt).dismiss()
  await navigation
  await expect(page).toHaveURL(/\/company$/)
  await expect(page.getByRole('textbox', { name: '标题', exact: true })).toHaveValue('尚未保存的公司介绍')
  await page.route('**/api/v1/admin/auth/csrf', (route) => route.fulfill({ json: { data: { headerName: 'X-CSRF-TOKEN', parameterName: '_csrf', token: 'mobile-error-csrf' } } }))
  await page.route('**/api/v1/admin/media/uploads', (route) => route.fulfill({ status: 503, json: { code: 'MEDIA_SERVICE_UNAVAILABLE', message: '上传服务暂不可用，请重试' } }))
  await page.getByLabel('选择公司介绍列表封面').setInputFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('test') })
  await expect(page.getByRole('alert')).toContainText('上传服务暂不可用，请重试')
  await expect(page.getByRole('button', { name: '保存草稿', exact: true })).toBeEnabled()
  await expect(page.getByRole('textbox', { name: '标题', exact: true })).toHaveValue('尚未保存的公司介绍')
})

test('phone selects a product cover and saves an optional-detail draft without publishing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let saved = false
  await page.route('**/api/v1/admin/auth/csrf', (route) => route.fulfill({ json: { data: { headerName: 'X-CSRF-TOKEN', parameterName: '_csrf', token: 'mobile-product-csrf' } } }))
  await page.route('**/api/v1/admin/products/product-1/draft', (route) => {
    const body = route.request().postDataJSON()
    expect(route.request().method()).toBe('PUT')
    expect(route.request().headers()['x-csrf-token']).toBe('mobile-product-csrf')
    expect(body).toMatchObject({ expectedVersion: 1, coverMediaId: 'cover-2', listImageMediaIds: ['cover-1', 'cover-2'], blocks: [] })
    saved = true
    return route.fulfill({ json: { data: { id: 'product-1', visibility: 'PUBLISHED', version: 2, draft: { ...companyRevision, ...body } } } })
  })
  await page.goto('products')
  await page.getByRole('table').getByRole('button', { name: '编辑', exact: true }).click()
  await page.getByRole('tab', { name: /产品图片/ }).click()
  await page.locator('.product-image-item').nth(1).getByRole('radio').check()
  await expect(page.locator('.product-image-item').nth(1)).toHaveClass(/product-image-item--cover/)
  await page.getByRole('tab', { name: /详情内容/ }).click()
  await expect(page.getByText('当前未设置产品详情，小程序将只显示产品基本信息。')).toBeVisible()
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect(page.getByText('草稿已保存，不会立即影响小程序。')).toBeVisible()
  expect(saved).toBe(true)
  await expect(page.getByRole('button', { name: '保存草稿', exact: true })).toBeDisabled()
  await page.getByRole('tab', { name: /产品图片/ }).click()
  await expect(page.locator('.product-image-item').nth(1).getByRole('radio')).toBeChecked()
})

for (const editor of [
  { route: 'home-hero', layout: 'hero', form: 'home-hero-form' },
  { route: 'company', layout: 'company', form: 'company-content-form' },
  { route: 'cooperation', layout: 'cooperation', form: 'cooperation-content-form' },
  { route: 'home-videos', layout: 'video', form: 'home-video-form' },
  { route: 'scenics', layout: 'scenic', form: 'scenic-content-form' },
  { route: 'products', layout: 'product', form: 'product-content-form' },
]) {
  test(`${editor.route} editor fits phones and retains the desktop side preview`, async ({ page }) => {
    const writes: string[] = []
    page.on('request', (request) => { if (request.url().includes('/api/v1/admin/') && request.method() !== 'GET') writes.push(request.method()) })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(editor.route)
    if (['home-videos', 'scenics', 'products'].includes(editor.route)) {
      await page.getByRole('table').getByRole('button', { name: '编辑', exact: true }).click()
    }
    const form = page.locator(`#${editor.form}`)
    await expect(form).toBeVisible()
    const preview = page.locator('.mobile-preview')
    await expect(preview).not.toHaveAttribute('open', '')
    for (const width of [320, 390, 760]) {
      await page.setViewportSize({ width, height: 844 })
      for (const tab of await form.getByRole('tab').all()) {
        await tab.click()
        expect(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')).toBe(true)
      }
      expect(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')).toBe(true)
      const actions = page.locator(`.${editor.layout}-page-actions`)
      await expect(actions).toHaveCSS('position', 'fixed')
      for (const button of await actions.getByRole('button').all()) {
        const box = await button.boundingBox()
        expect(box!.height).toBeGreaterThanOrEqual(44)
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(width)
        expect(box!.y + box!.height).toBeLessThanOrEqual(844)
      }
    }
    await preview.locator('summary').click()
    await expect(preview).toHaveAttribute('open', '')
    await expect(preview.locator('aside')).toBeVisible()
    expect(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')).toBe(true)
    await page.setViewportSize({ width: 320, height: 700 })
    const filing = page.getByRole('link', { name: '鄂ICP备2025140094号-3' })
    await filing.scrollIntoViewIfNeeded()
    const filingBox = await filing.boundingBox()
    const actionsBox = await page.locator(`.${editor.layout}-page-actions`).boundingBox()
    expect(filingBox!.y + filingBox!.height).toBeLessThanOrEqual(actionsBox!.y)
    const layout = page.locator(`.${editor.layout}-editor-layout`)
    for (const width of [761, 900, 1280, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      await expect(page.locator('.mobile-preview')).toHaveCount(0)
      await expect(layout.locator(':scope > aside')).toHaveCount(1)
      await expect(page.locator(`.${editor.layout}-page-actions`)).toHaveCSS('position', 'static')
      await expect(page.locator(`.${editor.layout}-page-actions > .primary-button`)).toHaveCSS('min-height', '38px')
      const formBox = await form.boundingBox()
      const previewBox = await layout.locator(':scope > aside').boundingBox()
      if (width > 1180) expect(previewBox!.x).toBeGreaterThanOrEqual(formBox!.x + formBox!.width)
      else expect(previewBox!.y).toBeGreaterThanOrEqual(formBox!.y + formBox!.height)
    }
    expect(writes).toEqual([])
  })
}

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
