import type { Locator, Page } from '@playwright/test'

export const INITIAL = { rx: '25.0', ry: '-45.0', rz: '0.0' }

export function sceneOf(page: Page): Locator {
  return page.locator('div[data-testid="cube-scene"]')
}

export async function canvasCentre(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator('div[data-testid="cube-scene"] canvas').boundingBox()
  if (!box) throw new Error('canvas has no bounding box')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** Real mouse drag by (dx, dy) px starting at `start`. */
export async function mouseDrag(
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

/**
 * Simulated touch drag: dispatches pointer events with pointerType "touch" on the
 * canvas. Playwright's mouse API cannot produce touch pointers, so real touch
 * hardware is covered by the manual check only (spec §3, §7.3).
 */
export async function touchDrag(
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
