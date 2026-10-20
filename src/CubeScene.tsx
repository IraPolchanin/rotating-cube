import { useEffect, useRef } from 'react'
import { createCubeScene } from './cube/createCubeScene'

export default function CubeScene() {
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const cubeScene = createCubeScene(wrapper)
    return () => {
      cubeScene.dispose()
    }
  }, [])

  return <div ref={wrapperRef} className="cube-scene" data-testid="cube-scene" />
}
