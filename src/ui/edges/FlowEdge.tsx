import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import { useGameStore } from '../../store'
import { fmtInt } from '../format'

const DOT_TRAVEL_SECONDS = 1.6
const MAX_DOTS = 6

/** Dots needed for a flow: grows with log of rps so 50 and 20,000 rps both read well. */
function dotCount(rps: number): number {
  if (rps < 1) return 0
  return Math.min(MAX_DOTS, Math.max(1, Math.round(Math.log2(rps / 50))))
}

/** A wire. Dots flow along it, density by rps, coloured by read/write share. */
export function FlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd }: EdgeProps) {
  const rps = useGameStore((s) => s.sim.edgeRps[id] ?? 0)
  const writeShare = useGameStore((s) => s.level.mix.write)
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })

  const dots = dotCount(rps)
  const writeDots = writeShare > 0 && dots > 0 ? Math.max(1, Math.round(dots * writeShare)) : 0
  // Spread write dots evenly among the read dots.
  const isWrite = (i: number) => Math.floor(((i + 1) * writeDots) / dots) > Math.floor((i * writeDots) / dots)

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} />
      {Array.from({ length: dots }, (_, i) => (
        <circle
          key={`${dots}-${i}`}
          className="flow-dot"
          r={3.5}
          fill={isWrite(i) ? 'var(--color-write)' : 'var(--color-read)'}
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
