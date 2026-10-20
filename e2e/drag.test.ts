import { test, expect, type Locator, type Page } from '@playwright/test'

const INITIAL = { rx: '25.0', ry: '-45.0', rz: '0.0' }

function sceneOf(page: Page): Locator {
  return page.locator('div[data-testid="cube-scene"]')
}

async function canvasCentre(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator('div[data-testid="cube-scene"] canvas').boundingBox()
  if (!box) throw new Error('canvas has no bounding box')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** Real mouse drag by (dx, dy) px starting at (startX, startY). */
async function mouseDrag(
  page: Page,
  start: { x: number; y: number },
  dx: number,
  dy: number,
  steps = 10,
): Promise<void> {
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + dx, start.y + dy, { steps })
  await page.mouse.up()
}

/**
 * Simulated touch drag: dispatches pointer events with pointerType "touch" on the
 * canvas. Playwright's mouse API cannot produce touch pointers, so real touch
 * hardware is covered by the manual check only (spec §3, §7.3).
 */
async function fireTouch(
  page: Page,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  x: number,
  y: number,
): Promise<void> {
  await page.evaluate(
    ({ type, x, y }) => {
      const canvas = document.querySelector('div[data-testid="cube-scene"] canvas')
      if (!canvas) throw new Error('canvas not found')
      canvas.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 7,
          pointerType: 'touch',
          isPrimary: true,
          button: 0,
          buttons: type === 'pointerup' ? 0 : 1,
          clientX: x,
          clientY: y,
          bubbles: true,
          cancelable: true,
        }),
      )
    },
    { type, x, y },
  )
}

async function touchDrag(
  page: Page,
  start: { x: number; y: number },
  dx: number,
  dy: number,
  steps = 10,
  onStep?: () => Promise<void>,
): Promise<void> {
  await fireTouch(page, 'pointerdown', start.x, start.y)
  for (let i = 1; i <= steps; i++) {
    await fireTouch(page, 'pointermove', start.x + (dx * i) / steps, start.y + (dy * i) / steps)
    await onStep?.()
  }
  await fireTouch(page, 'pointerup', start.x + dx, start.y + dy)
}

test('AC-4: horizontal mouse drag of 50 px changes ry', async ({ page }) => {
  await page.goto('/')
  const scene = sceneOf(page)
  await expect(scene).toHaveAttribute('data-cube-ry', INITIAL.ry)

  await mouseDrag(page, await canvasCentre(page), 50, 0)

  await expect(scene).not.toHaveAttribute('data-cube-ry', INITIAL.ry)
  await expect(scene).toHaveAttribute('data-cube-rx', INITIAL.rx)
  await expect(scene).toHaveAttribute('data-cube-rz', INITIAL.rz)
})

test('AC-5: vertical mouse drag of 50 px changes rx', async ({ page }) => {
  await page.goto('/')
  const scene = sceneOf(page)
  await expect(scene).toHaveAttribute('data-cube-rx', INITIAL.rx)

  await mouseDrag(page, await canvasCentre(page), 0, 50)

  await expect(scene).not.toHaveAttribute('data-cube-rx', INITIAL.rx)
  await expect(scene).toHaveAttribute('data-cube-ry', INITIAL.ry)
  await expect(scene).toHaveAttribute('data-cube-rz', INITIAL.rz)
})

test('AC-6: horizontal touch drag of 50 px changes ry', async ({ page }) => {
  await page.goto('/')
  const scene = sceneOf(page)
  await expect(scene).toHaveAttribute('data-cube-ry', INITIAL.ry)

  await touchDrag(page, await canvasCentre(page), 50, 0)

  await expect(scene).not.toHaveAttribute('data-cube-ry', INITIAL.ry)
  await expect(scene).toHaveAttribute('data-cube-rx', INITIAL.rx)
})

test('AC-7: vertical touch drag of 50 px changes rx', async ({ page }) => {
  await page.goto('/')
  const scene = sceneOf(page)
  await expect(scene).toHaveAttribute('data-cube-rx', INITIAL.rx)

  await touchDrag(page, await canvasCentre(page), 0, 50)

  await expect(scene).not.toHaveAttribute('data-cube-rx', INITIAL.rx)
  await expect(scene).toHaveAttribute('data-cube-ry', INITIAL.ry)
})

test('AC-12: 1000 px vertical mouse drag never leaves [-90, 90]', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 })
  await page.goto('/')
  const scene = sceneOf(page)
  await expect(scene).toHaveAttribute('data-cube-rx', INITIAL.rx)

  const start = { x: 640, y: 40 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(start.x, start.y + (1000 * i) / 20)
    const rx = Number(await scene.getAttribute('data-cube-rx'))
    expect(rx).toBeGreaterThanOrEqual(-90)
    expect(rx).toBeLessThanOrEqual(90)
  }
  await page.mouse.up()

  await expect(scene).toHaveAttribute('data-cube-rx', '90.0')
})

test('AC-12: 1000 px upward touch drag never leaves [-90, 90]', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 })
  await page.goto('/')
  const scene = sceneOf(page)
  await expect(scene).toHaveAttribute('data-cube-rx', INITIAL.rx)

  await touchDrag(page, { x: 640, y: 1060 }, 0, -1000, 20, async () => {
    const rx = Number(await scene.getAttribute('data-cube-rx'))
    expect(rx).toBeGreaterThanOrEqual(-90)
    expect(rx).toBeLessThanOrEqual(90)
  })

  await expect(scene).toHaveAttribute('data-cube-rx', '-90.0')
})
