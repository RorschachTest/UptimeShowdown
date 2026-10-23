import { ReactFlowProvider } from '@xyflow/react'
import { Canvas } from './ui/Canvas'
import { HUD } from './ui/HUD'
import { Inspector } from './ui/Inspector'
import { Palette } from './ui/Palette'
import { StageBanner } from './ui/StageBanner'
import { useGameLoop } from './ui/useGameLoop'

export default function App() {
  useGameLoop()
  return (
    <ReactFlowProvider>
      <div className="flex h-full flex-col">
        <HUD />
        <StageBanner />
        <main className="flex min-h-0 flex-1">
          <Palette />
          <Canvas />
          <Inspector />
        </main>
      </div>
    </ReactFlowProvider>
  )
}
