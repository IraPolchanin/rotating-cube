import { defineConfig, devices } from '@playwright/test'

// Runs a subset of the existing e2e tests against the public GitHub Pages URL
// (AC-16, spec section 7.6). The URL comes from DEPLOYED_URL; there is no webServer.
const raw = process.env['DEPLOYED_URL']
if (!raw) {
  throw new Error('DEPLOYED_URL is required, e.g. https://<user>.github.io/rotating-cube/')
}

// Tests navigate with page.goto('./'), which resolves under the Pages project
// sub-path only if the base URL ends with a slash.
const url = new URL(raw)
if (!url.pathname.endsWith('/')) url.pathname += '/'
const baseURL = url.toString()
process.env['DEPLOYED_URL'] = baseURL

export default defineConfig({
  testDir: './e2e',
  // Exactly the tests named in spec section 7.6: AC-1, AC-13 and FR-1 (WebGL2).
  // The colon keeps AC-1 from matching AC-10 to AC-15.
  grep: /(AC-1|AC-13|FR-1):/,
  // Failures must not be hidden by retries; propagation delay is handled in the setup.
  retries: 0,
  globalSetup: './playwright.deployed.setup.ts',
  use: { baseURL },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        // Same reason as playwright.config.ts: headed Firefox under xvfb gets WebGL2 in CI.
        headless: !process.env['CI'],
      },
    },
  ],
})
