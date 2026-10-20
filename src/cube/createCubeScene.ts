import {
  AmbientLight,
  BoxGeometry,
  DirectionalLight,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three'
import { applyDrag, formatDegrees, INITIAL_ORIENTATION, type Orientation } from './rotation'

export interface CubeScene {
  dispose(): void
}

const CAMERA_DISTANCE = 4.5
const DEG_TO_RAD = Math.PI / 180

/**
 * Keeps a drag alive when the pointer leaves the canvas (FR-4).
 *
 * `setPointerCapture` throws `NotFoundError` when the pointer id is not an active
 * pointer. That cannot happen for real input, but the E2E touch tests dispatch
 * synthetic PointerEvents (Playwright cannot produce touch pointers in Firefox),
 * which have no active pointer. Only that error is ignored; anything else is
 * rethrown. Real capture is verified by AC-14 with Playwright's mouse.
 */
function capturePointer(element: Element, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId)
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error
  }
}

/**
 * Creates the WebGL canvas inside `wrapper` and starts the render loop.
 * The cube mesh is rotated; the camera never moves for user interaction.
 */
export function createCubeScene(wrapper: HTMLElement): CubeScene {
  const canvas = document.createElement('canvas')
  wrapper.appendChild(canvas)

  const renderer = new WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const scene = new Scene()
  const camera = new PerspectiveCamera(45, 1, 0.1, 100)

  const geometry = new BoxGeometry(1.6, 1.6, 1.6)
  const material = new MeshStandardMaterial({ color: 0x3b82f6 })
  const cube = new Mesh(geometry, material)
  const edgesGeometry = new EdgesGeometry(geometry)
  const edgesMaterial = new LineBasicMaterial({ color: 0xffffff })
  cube.add(new LineSegments(edgesGeometry, edgesMaterial))
  scene.add(cube)

  scene.add(new AmbientLight(0xffffff, 0.6))
  const light = new DirectionalLight(0xffffff, 2.2)
  light.position.set(3, 4, 5)
  scene.add(light)

  let orientation: Orientation = INITIAL_ORIENTATION

  const resize = (): void => {
    const width = Math.max(wrapper.clientWidth, 1)
    const height = Math.max(wrapper.clientHeight, 1)
    const aspect = width / height
    renderer.setSize(width, height, false)
    camera.aspect = aspect
    // Keep the whole cube visible on portrait viewports.
    camera.position.set(0, 0, CAMERA_DISTANCE / Math.min(1, aspect))
    camera.updateProjectionMatrix()
  }

  const render = (): void => {
    cube.rotation.set(
      orientation.rx * DEG_TO_RAD,
      orientation.ry * DEG_TO_RAD,
      orientation.rz * DEG_TO_RAD,
      'XYZ',
    )
    wrapper.dataset['cubeRx'] = formatDegrees(orientation.rx)
    wrapper.dataset['cubeRy'] = formatDegrees(orientation.ry)
    wrapper.dataset['cubeRz'] = formatDegrees(orientation.rz)
    renderer.render(scene, camera)
  }

  let frame = 0
  const loop = (): void => {
    render()
    frame = requestAnimationFrame(loop)
  }

  // Only one pointer drives the rotation at a time (first pointer wins).
  let activePointerId: number | null = null
  let lastX = 0
  let lastY = 0

  const onPointerDown = (event: PointerEvent): void => {
    if (activePointerId !== null) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    activePointerId = event.pointerId
    lastX = event.clientX
    lastY = event.clientY
    capturePointer(canvas, event.pointerId)
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) return
    orientation = applyDrag(orientation, event.clientX - lastX, event.clientY - lastY)
    lastX = event.clientX
    lastY = event.clientY
  }

  const endDrag = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) return
    activePointerId = null
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', endDrag)
  canvas.addEventListener('pointercancel', endDrag)
  canvas.addEventListener('lostpointercapture', endDrag)

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(wrapper)

  resize()
  loop()

  return {
    dispose(): void {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', endDrag)
      canvas.removeEventListener('pointercancel', endDrag)
      canvas.removeEventListener('lostpointercapture', endDrag)
      geometry.dispose()
      material.dispose()
      edgesGeometry.dispose()
      edgesMaterial.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    },
  }
}
