import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import { createCubeScene, type CubeScene as CubeSceneApi } from './cube/createCubeScene'

export interface CubeSceneHandle {
  reset(): void
}

interface CubeSceneProps {
  ref?: Ref<CubeSceneHandle>
}

export default function CubeScene({ ref }: CubeSceneProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<CubeSceneApi | null>(null)

  useImperativeHandle(ref, () => ({
    reset(): void {
      sceneRef.current?.reset()
    },
  }), [])

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const cubeScene = createCubeScene(wrapper)
    sceneRef.current = cubeScene
    return () => {
      cubeScene.dispose()
      sceneRef.current = null
    }
  }, [])

  return <div ref={wrapperRef} className="cube-scene" data-testid="cube-scene" />
}
