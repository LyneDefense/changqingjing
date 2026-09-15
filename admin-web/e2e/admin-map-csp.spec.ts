import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// Vite does not send the production CSP. Exercise the real deployment policies
// with Tencent's redirect mocked, without relying on its service or a real key.
const policies = ['https', 'preview'].flatMap((mode) => {
  const template = readFileSync(new URL(`../../deploy/nginx/${mode}.conf.template`, import.meta.url), 'utf8')
  return [...template.matchAll(/add_header Content-Security-Policy "([^"]+)"/g)]
    .map((match, index) => ({ name: `${mode}-${index + 1}`, value: match[1] }))
})

test('every admin deployment policy retains restrictive frame permissions', () => {
  expect(policies).toHaveLength(3)
  for (const { value } of policies) {
    const directives = value.split(';').map((directive) => directive.trim())
    expect(directives.find((directive) => directive.startsWith('frame-src ')))
      .toBe('frame-src https://apis.map.qq.com https://mapapi.qq.com')
    expect(directives).toContain("frame-ancestors 'none'")
    expect(directives).toContain("script-src 'self'")
    expect(directives).toContain("object-src 'none'")
  }
})

for (const policy of policies) {
  test(`${policy.name} allows Tencent's map redirect but blocks unrelated frames`, async ({ page }) => {
    await page.addInitScript(`
      window.mapCspViolations = [];
      document.addEventListener('securitypolicyviolation', function (event) {
        if (event.effectiveDirective === 'frame-src') window.mapCspViolations.push(event.blockedURI);
      });
    `)
    await page.route('**/admin/map-csp-check', (route) => route.fulfill({
      contentType: 'text/html; charset=utf-8',
      headers: { 'Content-Security-Policy': policy.value },
      body: '<!doctype html><html><body><iframe title="腾讯地图位置选择" src="https://apis.map.qq.com/tools/locpicker?key=regression-test"></iframe></body></html>',
    }))
    // Playwright only intercepts the first URL in an HTTP redirect chain.
    // A refresh navigation exercises the destination's frame permission while
    // keeping both requests intercepted and the test completely offline.
    await page.route('https://apis.map.qq.com/tools/locpicker?key=regression-test', (route) => route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html><head><meta http-equiv="refresh" content="0;url=https://mapapi.qq.com/web/mapComponents/locationPicker/v/index.html"></head><body></body></html>',
    }))
    await page.route('https://mapapi.qq.com/web/mapComponents/locationPicker/v/index.html', (route) => route.fulfill({
      contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><body><p>地图选点组件已加载</p></body></html>',
    }))
    await page.route('https://unrelated.example.test/map.html', (route) => route.fulfill({
      contentType: 'text/html; charset=utf-8', body: '<p>不应加载此地图</p>',
    }))
    await page.goto('map-csp-check')
    await expect(page.frameLocator('iframe').getByText('地图选点组件已加载')).toBeVisible()
    expect(await page.evaluate('window.mapCspViolations')).toEqual([])

    await page.evaluate(`
      const frame = document.createElement('iframe');
      frame.src = 'https://unrelated.example.test/map.html';
      document.body.append(frame);
    `)
    await expect.poll(() => page.evaluate('window.mapCspViolations.map(uri => new URL(uri).origin)'))
      .toContain('https://unrelated.example.test')
  })
}
