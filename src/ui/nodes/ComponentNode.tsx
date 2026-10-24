import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useRef } from 'react'
import { COMPONENTS, getCount, TIER_LABELS } from '../../engine/components'
import { useGameStore } from '../../store'
import { fmtInt, fmtMs, loadStatus, statusColor } from '../format'
import type { GameNode } from '../graph'
import { ComponentIcon } from '../icons'
import { isUnlocked } from '../settings'

/** Wheel delta per step: one mouse-wheel notch (~100 px), or a short trackpad swipe. */
const WHEEL_STEP = 100
const MAX_STACKED_COPIES = 4

/** Every placeable piece, drawn from its component definition: summary, gauge, scale-out copies. */
export function ComponentNode({ id, data, selected }: NodeProps<GameNode>) {
  const stats = useGameStore((s) => s.sim.nodeStats[id])
  // Cluster pieces track live members once nodes join or leave mid-run.
  const live = useGameStore((s) => s.sim.runtime[id]?.state?.live)
  const def = COMPONENTS[data.kind]
  const count = def.count
  const countOpen = useGameStore((s) => count !== undefined && isUnlocked(s.chapter, count.gate, s.stageIndex))
  const setCount = useGameStore((s) => s.setCount)
  const wheel = useRef(0)
  const value = count ? getCount(data, count.field) : 0

  const onWheel = (e: React.WheelEvent) => {
    if (!countOpen) return
    wheel.current += e.deltaY
    while (Math.abs(wheel.current) >= WHEEL_STEP) {
      const dir = wheel.current < 0 ? 1 : -1
      setCount(id, getCount(useGameStore.getState().nodes.find((n) => n.id === id)!.data, count!.field) + dir)
      wheel.current += dir * WHEEL_STEP
    }
  }

  const down = stats?.down === true
  const status = down ? 'bad' : loadStatus(stats?.load)
  const dropping = down || (stats?.droppedRps ?? 0) > 0.5
  const loadPct = Math.round((stats?.load ?? 0) * 100)
  // Instances count the piece itself; replicas are extra copies.
  const copies = Math.min(count?.field === 'instances' ? value - 1 : value, MAX_STACKED_COPIES)
  const showQueue = (stats?.queued ?? 0) >= 1

  return (
    <div className={`relative w-52 ${countOpen ? 'nowheel' : ''}`} onWheel={onWheel} title={countOpen ? count!.scrollHint : 'Click for settings'}>
      {Array.from({ length: copies }, (_, i) => (
        <div
          key={i}
          className="piece absolute inset-0"
          style={{ transform: `translate(${(copies - i) * 5}px, ${-(copies - i) * 5}px)` }}
          aria-hidden="true"
        />
      ))}

      <div className={`piece relative px-3 pt-2.5 pb-3 ${dropping ? 'piece-dropping' : ''} ${selected ? 'outline-3 outline-offset-2 outline-read' : ''}`}>
        <div className="flex items-center gap-2">
          <span style={{ color: statusColor[status] }}>
            <ComponentIcon kind={data.kind} />
          </span>
          <span className="text-[15px] leading-tight font-semibold">{def.label}</span>
          <span className="ml-auto flex gap-1">
            {def.tiered && (
              <span className="rounded-md border-2 border-ink px-1 text-xs font-semibold" title="Machine size">
                {TIER_LABELS[data.config.tier]}
              </span>
            )}
            {count?.field === 'instances' && <span className="rounded-md bg-ink px-1.5 py-0.5 text-xs font-semibold text-piece">×{value}</span>}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-ink-soft">{def.summary({ id, ...data })}</p>

        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-board" role="meter" aria-label="Load" aria-valuenow={loadPct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${down ? 100 : Math.min(loadPct, 100)}%`, background: statusColor[status] }} />
        </div>

        <div className="mt-1.5 flex items-baseline justify-between text-xs">
          <span className="font-semibold" style={{ color: status === 'idle' ? undefined : statusColor[status] }}>
            {down ? 'Down: crashed' : `${loadPct}% load`}
          </span>
          <span className="text-ink-soft">{stats && !down ? fmtMs(stats.latencyMs) : '–'}</span>
        </div>

        {(stats?.hitRate !== undefined || (live !== undefined && live !== value)) && !down && (
          <div className="mt-1 flex justify-between text-xs text-ink-soft">
            <span>{stats?.hitRate !== undefined && `${Math.round(stats.hitRate * 100)}% hits`}</span>
            {live !== undefined && live !== value && <span className="font-semibold text-ink">{live} nodes live</span>}
          </div>
        )}

        {(showQueue || (dropping && !down)) && (
          <div className="mt-1 flex justify-between text-xs">
            <span className="text-ink-soft">{showQueue ? `${fmtInt(stats?.queued ?? 0)} waiting` : ''}</span>
            {dropping && <span className="font-semibold text-bad">{fmtInt(stats?.droppedRps ?? 0)}/s dropped</span>}
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
