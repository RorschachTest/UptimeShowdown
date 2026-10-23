import { ReactFlowProvider } from '@xyflow/react'
import { Canvas } from './ui/Canvas'
import { HUD } from './ui/HUD'
import { Inspector } from './ui/Inspector'
import { InterviewBar } from './ui/interview/InterviewBar'
import { InterviewOverlay } from './ui/interview/Overlays'
import { ScopePanel } from './ui/interview/ScopePanel'
import { Palette } from './ui/Palette'
import { StageBanner } from './ui/StageBanner'
import { useGameStore } from './store'
import { useGameLoop } from './ui/useGameLoop'

export default function App() {
  useGameLoop()
  const interview = useGameStore((s) => s.interview !== null)
  const scoping = useGameStore((s) => s.interview?.phase === 'scope')
  return (
    <ReactFlowProvider>
      <div className="flex h-full flex-col">
        <HUD />
        {interview ? <InterviewBar /> : <StageBanner />}
        <main className="flex min-h-0 flex-1">
          {scoping ? (
            <ScopePanel />
          ) : (
            <>
              <Palette />
              <div className="relative flex min-w-0 flex-1">
                <Canvas />
                <InterviewOverlay />
              </div>
              <Inspector />
            </>
          )}
        </main>
      </div>
    </ReactFlowProvider>
  )
}
