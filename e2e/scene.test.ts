import { test, expect } from '@playwright/test'

test('AC-1: cube-scene wrapper is present on load', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('div[data-testid="cube-scene"]')).toBeAttached()
})

test('AC-2: canvas has non-zero client size on load', async ({ page }) => {
  await page.goto('./')
  const canvas = page.locator('div[data-testid="cube-scene"] canvas')
  await expect(canvas).toBeAttached()
  const size = await canvas.evaluate((el) => ({
    width: el.clientWidth,
    height: el.clientHeight,
  }))
  expect(size.width).toBeGreaterThan(0)
  expect(size.height).toBeGreaterThan(0)
})

test('AC-3: initial rx/ry/rz attributes are 25.0 / -45.0 / 0.0', async ({ page }) => {
  await page.goto('./')
  const scene = page.locator('div[data-testid="cube-scene"]')
  await expect(scene).toHaveAttribute('data-cube-rx', '25.0')
  await expect(scene).toHaveAttribute('data-cube-ry', '-45.0')
  await expect(scene).toHaveAttribute('data-cube-rz', '0.0')
})

test('AC-13: no console errors or page errors on load', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => {
    errors.push(`pageerror: ${error.message}`)
  })
  await page.goto('./')
  await page.waitForLoadState('networkidle')
  // Check the errors first: if mounting threw (for example, no WebGL), the real
  // cause is reported here instead of an opaque "element(s) not found" timeout.
  expect(errors).toEqual([])
  // The scene must also have rendered at least once.
  await expect(page.locator('div[data-testid="cube-scene"]')).toHaveAttribute(
    'data-cube-rx',
    '25.0',
  )
  expect(errors).toEqual([])
})

test('AC-15: canvas computed touch-action is none', async ({ page }) => {
  await page.goto('./')
  const canvas = page.locator('div[data-testid="cube-scene"] canvas')
  await expect(canvas).toBeAttached()
  const touchAction = await canvas.evaluate((el) => getComputedStyle(el).touchAction)
  expect(touchAction).toBe('none')
})
