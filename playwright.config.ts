import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:5173',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env['CI'],
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        // Headless Firefox on Linux without a GPU refuses WebGL2 ("AllowWebgl2:false
        // restricts context creation on this system"), and three.js needs WebGL2.
        // In CI the browser runs headed under xvfb (see .github/workflows/ci.yml),
        // which gets software WebGL. Elsewhere it stays headless.
        headless: !process.env['CI'],
      },
    },
  ],
})
