import { ReactFlowProvider } from '@xyflow/react'
import { Canvas } from './ui/Canvas'
import { HUD } from './ui/HUD'
import { Palette } from './ui/Palette'
import { useGameLoop } from './ui/useGameLoop'

export default function App() {
  useGameLoop()
  return (
    <ReactFlowProvider>
      <div className="flex h-full flex-col">
        <HUD />
        <main className="flex min-h-0 flex-1">
          <Palette />
          <Canvas />
        </main>
      </div>
    </ReactFlowProvider>
  )
}
