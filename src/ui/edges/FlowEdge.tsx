import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import { useGameStore } from '../../store'
import { fmtInt } from '../format'
import { TYPE_COLORS } from '../settings'

const DOT_TRAVEL_SECONDS = 1.6
const MAX_DOTS = 6

/** Dots needed for a flow: grows with log of rps so 50 and 20,000 rps both read well. */
function dotCount(rps: number): number {
  if (rps < 1) return 0
  return Math.min(MAX_DOTS, Math.max(1, Math.round(Math.log2(rps / 50))))
}

/** A wire. Dots flow along it, density by rps, coloured by the stage's request mix. */
export function FlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd }: EdgeProps) {
  const rps = useGameStore((s) => s.sim.edgeRps[id] ?? 0)
  const mix = useGameStore((s) => s.chapter.stages[s.stageIndex]!.mix)
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })

  const dots = dotCount(rps)
  // Colour dots by the stage's request mix: dot i takes the type whose cumulative share covers it.
  const shares = Object.entries(mix).filter(([, v]) => v > 0)
  const colorOf = (i: number) => {
    let cum = 0
    for (const [type, share] of shares) {
      cum += share
      if ((i + 0.5) / dots <= cum) return TYPE_COLORS[type]
    }
    return TYPE_COLORS[shares[shares.length - 1]?.[0] ?? 'page']
  }

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} />
      {Array.from({ length: dots }, (_, i) => (
        <circle
          key={`${dots}-${i}`}
          className="flow-dot"
          r={3.5}
          fill={colorOf(i)}
        >
          <animateMotion
            dur={`${DOT_TRAVEL_SECONDS}s`}
            begin={`${(-i * DOT_TRAVEL_SECONDS) / dots}s`}
            repeatCount="indefinite"
            path={path}
          />
        </circle>
      ))}
      {rps >= 1 && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute rounded-md border border-ink/20 bg-panel px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 14}px)` }}
          >
            {fmtInt(rps)} rps
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
