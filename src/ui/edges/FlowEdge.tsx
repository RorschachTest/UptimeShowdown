import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import { useGameStore } from '../../store'
import { fmtInt, fmtPct } from '../format'
import { TYPE_COLORS } from '../settings'

const DOT_TRAVEL_SECONDS = 1.6
const MAX_DOTS = 6
const EMPTY: Record<number, number> = {}

/** Dots needed for a flow: grows with log of rps so 50 and 20,000 rps both read well. */
function dotCount(rps: number): number {
  if (rps < 1) return 0
  return Math.min(MAX_DOTS, Math.max(1, Math.round(Math.log2(rps / 50))))
}

/** A wire. Dots flow along it (density by rps, coloured by what this wire actually carries); hover the label for the breakdown. */
export function FlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd }: EdgeProps) {
  const rps = useGameStore((s) => s.sim.edgeRps[id] ?? 0)
  const byType = useGameStore((s) => s.sim.edgeTypes[id] ?? EMPTY)
  const types = useGameStore((s) => s.chapter.requestTypes)
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })

  // This wire's own mix, busiest type first.
  const rows = Object.entries(byType)
    .map(([t, r]) => ({ rt: types[Number(t)]!, rps: r }))
    .filter((row) => row.rps >= 0.5)
    .sort((a, b) => b.rps - a.rps)

  const dots = dotCount(rps)
  // Dot i takes the type whose cumulative share of this wire covers it.
  const colorOf = (i: number) => {
    let cum = 0
    for (const row of rows) {
      cum += row.rps / rps
      if ((i + 0.5) / dots <= cum) return TYPE_COLORS[row.rt.id]
    }
    return TYPE_COLORS[rows.at(-1)?.rt.id ?? 'page']
  }

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} />
      {Array.from({ length: dots }, (_, i) => (
        <circle key={`${dots}-${i}`} className="flow-dot" r={3.5} fill={colorOf(i)}>
          <animateMotion dur={`${DOT_TRAVEL_SECONDS}s`} begin={`${(-i * DOT_TRAVEL_SECONDS) / dots}s`} repeatCount="indefinite" path={path} />
        </circle>
      ))}
      {rps >= 1 && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan group pointer-events-auto absolute"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 14}px)` }}
            tabIndex={0}
            aria-label={`${fmtInt(rps)} requests per second: ${rows.map((r) => `${r.rt.label} ${fmtInt(r.rps)}`).join(', ')}`}
          >
            <div className="cursor-default rounded-md border border-ink/20 bg-panel px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft group-hover:border-ink group-focus:border-ink">
              {fmtInt(rps)} rps
            </div>
            {/* Breakdown card, same language as the Users piece. */}
            <div
              className="pointer-events-none invisible absolute bottom-full left-1/2 z-10 mb-1.5 w-56 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-xs text-piece opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100"
              role="tooltip"
            >
              <div className="mb-1.5 flex h-1.5 overflow-hidden rounded-full" aria-hidden="true">
                {rows.map((r) => (
                  <div key={r.rt.id} style={{ width: `${(r.rps / rps) * 100}%`, background: TYPE_COLORS[r.rt.id] }} />
                ))}
              </div>
              <ul className="flex flex-col gap-0.5">
                {rows.map((r) => (
                  <li key={r.rt.id} className="flex items-center gap-1.5">
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: TYPE_COLORS[r.rt.id] }} aria-hidden="true" />
                    <span className="flex-1">{r.rt.label}</span>
                    <span className="font-semibold">{fmtInt(r.rps)}</span>
                    <span className="w-10 text-right opacity-70">{fmtPct(r.rps / rps)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
