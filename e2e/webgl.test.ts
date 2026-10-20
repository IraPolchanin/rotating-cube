import { test, expect } from '@playwright/test'

// Diagnostic only: it reports whether the browser can create the WebGL2 context
// that three.js requires. It does not replace the cube tests, which still fail
// on their own when the cube is missing.
test('FR-1: browser can create a WebGL2 context', async ({ page }) => {
  await page.goto('/')
  const info = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2')
    if (!gl) return null
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER)
    return { renderer: String(renderer), version: String(gl.getParameter(gl.VERSION)) }
  })

  expect(
    info,
    `${test.info().project.name} cannot create a WebGL2 context, so the cube cannot render`,
  ).not.toBeNull()
  test.info().annotations.push({
    type: 'webgl',
    description: `${info?.renderer} | ${info?.version}`,
  })
})
