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
import { formatDegrees, INITIAL_ORIENTATION, type Orientation } from './rotation'

export interface CubeScene {
  dispose(): void
}

const CAMERA_DISTANCE = 4.5
const DEG_TO_RAD = Math.PI / 180

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

  const orientation: Orientation = INITIAL_ORIENTATION

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

  resize()
  loop()

  return {
    dispose(): void {
      cancelAnimationFrame(frame)
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
