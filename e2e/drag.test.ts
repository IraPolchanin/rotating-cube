import { test, expect } from '@playwright/test'
import { INITIAL, canvasCentre, mouseDrag, sceneOf, touchDrag } from './helpers'

test('AC-4: horizontal mouse drag of 50 px changes ry', async ({ page }) => {
  await page.goto('./')
  const scene = sceneOf(page)
  await expect(scene).toHaveAttribute('data-cube-ry', INITIAL.ry)

  await mouseDrag(page, await canvasCentre(page), 50, 0)

  await expect(scene).not.toHaveAttribute('data-cube-ry', INITIAL.ry)
  await expect(scene).toHaveAttribute('data-cube-rx', INITIAL.rx)
  await expect(scene).toHaveAttribute('data-cube-rz', INITIAL.rz)
})

test('AC-5: vertical mouse drag of 50 px changes rx', async ({ page }) => {
  await page.goto('./')
  const scene = sceneOf(page)
  await expect(scene).toHaveAttribute('data-cube-rx', INITIAL.rx)

  await mouseDrag(page, await canvasCentre(page), 0, 50)

  await expect(scene).not.toHaveAttribute('data-cube-rx', INITIAL.rx)
  await expect(scene).toHaveAttribute('data-cube-ry', INITIAL.ry)
  await expect(scene).toHaveAttribute('data-cube-rz', INITIAL.rz)
})

test('AC-6: horizontal touch drag of 50 px changes ry', async ({ page }) => {
  await page.goto('./')
  const scene = sceneOf(page)
  await expect(scene).toHaveAttribute('data-cube-ry', INITIAL.ry)

  await touchDrag(page, await canvasCentre(page), 50, 0)

  await expect(scene).not.toHaveAttribute('data-cube-ry', INITIAL.ry)
  await expect(scene).toHaveAttribute('data-cube-rx', INITIAL.rx)
})

test('AC-7: vertical touch drag of 50 px changes rx', async ({ page }) => {
  await page.goto('./')
  const scene = sceneOf(page)
  await expect(scene).toHaveAttribute('data-cube-rx', INITIAL.rx)

  await touchDrag(page, await canvasCentre(page), 0, 50)

  await expect(scene).not.toHaveAttribute('data-cube-rx', INITIAL.rx)
  await expect(scene).toHaveAttribute('data-cube-ry', INITIAL.ry)
})

test('AC-12: 1000 px vertical mouse drag never leaves [-90, 90]', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 })
  await page.goto('./')
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
  await page.goto('./')
  const scene = sceneOf(page)
  await expect(scene).toHaveAttribute('data-cube-rx', INITIAL.rx)

  await touchDrag(page, { x: 640, y: 1060 }, 0, -1000, 20, async () => {
    const rx = Number(await scene.getAttribute('data-cube-rx'))
    expect(rx).toBeGreaterThanOrEqual(-90)
    expect(rx).toBeLessThanOrEqual(90)
  })

  await expect(scene).toHaveAttribute('data-cube-rx', '-90.0')
})
