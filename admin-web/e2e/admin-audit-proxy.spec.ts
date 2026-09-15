import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

test('all backend proxies replace client IP headers and strip the RFC Forwarded header', () => {
  let proxyCount = 0
  for (const mode of ['https', 'preview', 'http']) {
    const template = readFileSync(new URL(`../../deploy/nginx/${mode}.conf.template`, import.meta.url), 'utf8')
    const backendLocations = [...template.matchAll(/location [^{]+\{([^{}]*proxy_pass http:\/\/backend[^{}]*)\}/g)]
    expect(backendLocations.length).toBeGreaterThan(0)
    for (const [, block] of backendLocations) {
      proxyCount++
      // Spring's ForwardedHeaderFilter prioritizes RFC Forwarded over X-Forwarded-For.
      // Keeping an untrusted Forwarded header would let it spoof the audit client IP.
      expect(block).toContain('proxy_set_header Forwarded "";')
      expect(block).toContain('proxy_set_header X-Forwarded-For $remote_addr;')
      expect(block).toContain('proxy_set_header X-Real-IP $remote_addr;')
      expect(block).not.toContain('$proxy_add_x_forwarded_for')
    }
  }
  expect(proxyCount).toBe(7)
})
