import { useRef } from 'react'
import CubeScene, { type CubeSceneHandle } from './CubeScene'

export default function App() {
  const sceneRef = useRef<CubeSceneHandle>(null)

  return (
    <>
      <CubeScene ref={sceneRef} />
      <button
        type="button"
        className="reset-button"
        data-testid="reset-button"
        onClick={() => sceneRef.current?.reset()}
      >
        Reset
      </button>
    </>
  )
}
