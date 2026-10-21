import { test, expect } from '@playwright/test'
import { INITIAL, canvasCentre, mouseDrag, sceneOf, touchDrag } from './helpers'

test('AC-8: reset button is visible and enabled on load', async ({ page }) => {
  await page.goto('./')
  const button = page.locator('button[data-testid="reset-button"]')
  await expect(button).toBeVisible()
  await expect(button).toBeEnabled()
})

test('AC-9: reset restores all attributes after a mouse drag', async ({ page }) => {
  await page.goto('./')
  const scene = sceneOf(page)
  await expect(scene).toHaveAttribute('data-cube-ry', INITIAL.ry)

  await mouseDrag(page, await canvasCentre(page), 80, 60)
  await expect(scene).not.toHaveAttribute('data-cube-ry', INITIAL.ry)
  await expect(scene).not.toHaveAttribute('data-cube-rx', INITIAL.rx)

  await page.locator('button[data-testid="reset-button"]').click()

  await expect(scene).toHaveAttribute('data-cube-rx', INITIAL.rx)
  await expect(scene).toHaveAttribute('data-cube-ry', INITIAL.ry)
  await expect(scene).toHaveAttribute('data-cube-rz', INITIAL.rz)
})

test('AC-9: reset restores all attributes after a touch drag', async ({ page }) => {
  await page.goto('./')
  const scene = sceneOf(page)
  await expect(scene).toHaveAttribute('data-cube-ry', INITIAL.ry)

  await touchDrag(page, await canvasCentre(page), -70, -40)
  await expect(scene).not.toHaveAttribute('data-cube-ry', INITIAL.ry)

  await page.locator('button[data-testid="reset-button"]').click()

  await expect(scene).toHaveAttribute('data-cube-rx', INITIAL.rx)
  await expect(scene).toHaveAttribute('data-cube-ry', INITIAL.ry)
  await expect(scene).toHaveAttribute('data-cube-rz', INITIAL.rz)
})

test('AC-9: a drag after reset rotates from the initial orientation again', async ({ page }) => {
  await page.goto('./')
  const scene = sceneOf(page)
  await expect(scene).toHaveAttribute('data-cube-ry', INITIAL.ry)

  await mouseDrag(page, await canvasCentre(page), 50, 0)
  await expect(scene).not.toHaveAttribute('data-cube-ry', INITIAL.ry)
  await page.locator('button[data-testid="reset-button"]').click()
  await expect(scene).toHaveAttribute('data-cube-ry', INITIAL.ry)

  await mouseDrag(page, await canvasCentre(page), 50, 0)
  await expect(scene).not.toHaveAttribute('data-cube-ry', INITIAL.ry)
})
