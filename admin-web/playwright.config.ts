import { existsSync } from 'node:fs'
import { defineConfig } from '@playwright/test'

const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const executablePath = process.env.PLAYWRIGHT_CHROME_PATH
  ?? (existsSync(macChrome) ? macChrome : undefined)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4174/admin/',
    browserName: 'chromium',
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174/admin/',
    reuseExistingServer: false,
  },
})
