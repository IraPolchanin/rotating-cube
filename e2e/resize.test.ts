import { test, expect, type Page } from '@playwright/test'

const TOLERANCE_PX = 2

async function canvasWidthDelta(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector('div[data-testid="cube-scene"] canvas')
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('canvas not found')
    return Math.abs(canvas.clientWidth - window.innerWidth)
  })
}

test('AC-10: canvas width matches innerWidth at 1280x720', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('./')
  await expect(page.locator('div[data-testid="cube-scene"] canvas')).toBeAttached()
  await expect.poll(() => canvasWidthDelta(page)).toBeLessThanOrEqual(TOLERANCE_PX)
})

test('AC-11: canvas width follows viewport after resize to 375x667', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('./')
  await expect(page.locator('div[data-testid="cube-scene"] canvas')).toBeAttached()

  await page.setViewportSize({ width: 375, height: 667 })

  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(375)
  await expect.poll(() => canvasWidthDelta(page)).toBeLessThanOrEqual(TOLERANCE_PX)
})

test('FR-6: drawing buffer is resized with the viewport, not only the CSS box', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('./')
  await expect(page.locator('div[data-testid="cube-scene"] canvas')).toBeAttached()

  await page.setViewportSize({ width: 375, height: 667 })

  await expect
    .poll(() =>
      page.evaluate(() => {
        const canvas = document.querySelector('div[data-testid="cube-scene"] canvas')
        if (!(canvas instanceof HTMLCanvasElement)) throw new Error('canvas not found')
        // The renderer caps its pixel ratio at 2.
        return canvas.width / Math.min(window.devicePixelRatio, 2)
      }),
    )
    .toBeCloseTo(375, 0)
})
