import { test, expect } from '@playwright/test'
import { INITIAL, canvasCentre, sceneOf } from './helpers'

test('AC-14: drag over reset button keeps rotating and does not reset', async ({ page }) => {
  await page.goto('/')
  const scene = sceneOf(page)
  const button = page.locator('button[data-testid="reset-button"]')
  await expect(scene).toHaveAttribute('data-cube-ry', INITIAL.ry)

  const box = await button.boundingBox()
  if (!box) throw new Error('reset button has no bounding box')
  const target = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

  const start = await canvasCentre(page)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 20 })
  await expect(scene).not.toHaveAttribute('data-cube-ry', INITIAL.ry)

  // Keep moving while the pointer is over the button: without pointer capture the
  // canvas stops receiving moves here, so ry would stay at this value.
  const ryOverButton = await scene.getAttribute('data-cube-ry')
  await page.mouse.move(target.x + 15, target.y, { steps: 5 })
  await expect(scene).not.toHaveAttribute('data-cube-ry', ryOverButton ?? INITIAL.ry)

  await page.mouse.up()

  await expect(scene).not.toHaveAttribute('data-cube-ry', INITIAL.ry)
  await expect(scene).not.toHaveAttribute('data-cube-rx', INITIAL.rx)
})
