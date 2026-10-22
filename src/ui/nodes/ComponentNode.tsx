import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useRef } from 'react'
import { COMPONENTS } from '../../engine/components'
import { useGameStore } from '../../store'
import { fmtInt, fmtMs, loadStatus, statusColor } from '../format'
import type { GameNode } from '../graph'
import { ComponentIcon } from '../icons'

/** Wheel delta per instance step: one mouse-wheel notch (~100 px), or a short trackpad swipe. */
const WHEEL_STEP = 100
const MAX_STACKED_COPIES = 4

function capacityLabel(kind: GameNode['data']['kind'], instances: number): string {
  const cap = COMPONENTS[kind].capacityRps
  if (cap.read === cap.write) return `${fmtInt(cap.read * instances)} rps capacity`
  return `${fmtInt(cap.read * instances)} reads/s, ${fmtInt(cap.write * instances)} writes/s`
}

/** App servers, databases and later components: one piece with a load gauge. */
export function ComponentNode({ id, data }: NodeProps<GameNode>) {
  const stats = useGameStore((s) => s.sim.nodeStats[id])
  const scaleNode = useGameStore((s) => s.scaleNode)
  const spec = COMPONENTS[data.kind]
  const scalable = spec.maxInstances > spec.minInstances
  const wheel = useRef(0)

  const status = loadStatus(stats?.load)
  const dropping = (stats?.droppedRps ?? 0) > 0.5
  const loadPct = Math.round((stats?.load ?? 0) * 100)

  const onWheel = (e: React.WheelEvent) => {
    if (!scalable) return
    wheel.current += e.deltaY
    while (Math.abs(wheel.current) >= WHEEL_STEP) {
      const dir = wheel.current < 0 ? 1 : -1
      scaleNode(id, dir)
      wheel.current += dir * WHEEL_STEP
    }
  }

  const copies = Math.min(data.instances - 1, MAX_STACKED_COPIES)

  return (
    <div
      className={`relative w-48 ${scalable ? 'nowheel' : ''}`}
      onWheel={onWheel}
      title={scalable ? 'Scroll to add or remove instances' : undefined}
    >
      {/* Extra instances fan out behind the piece. */}
      {Array.from({ length: copies }, (_, i) => (
        <div
          key={i}
          className="piece absolute inset-0"
          style={{ transform: `translate(${(copies - i) * 5}px, ${-(copies - i) * 5}px)` }}
          aria-hidden="true"
        />
      ))}

      <div className={`piece relative px-3 pt-2.5 pb-3 ${dropping ? 'piece-dropping' : ''}`}>
        <div className="flex items-center gap-2">
          <span style={{ color: statusColor[status] }}>
            <ComponentIcon kind={data.kind} />
          </span>
          <span className="text-[15px] leading-tight font-semibold">{spec.label}</span>
          {scalable && (
            <span className="ml-auto rounded-md bg-ink px-1.5 py-0.5 text-xs font-semibold text-piece">
              ×{data.instances}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-ink-soft">{capacityLabel(data.kind, data.instances)}</p>

        <div
          className="mt-2.5 h-2 overflow-hidden rounded-full bg-board"
          role="meter"
          aria-label="Load"
          aria-valuenow={loadPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full transition-[width] duration-150"
            style={{ width: `${Math.min(loadPct, 100)}%`, background: statusColor[status] }}
          />
        </div>

        <div className="mt-1.5 flex items-baseline justify-between text-xs">
          <span className="font-semibold" style={{ color: status === 'idle' ? undefined : statusColor[status] }}>
            {loadPct}% load
          </span>
          <span className="text-ink-soft">{stats ? fmtMs(stats.latencyMs) : '–'}</span>
        </div>

        {(stats?.queued ?? 0) >= 1 || dropping ? (
          <div className="mt-1 flex justify-between text-xs">
            <span className="text-ink-soft">{spec.queueTicks > 0 ? `${fmtInt(stats?.queued ?? 0)} waiting` : ''}</span>
            {dropping && <span className="font-semibold text-bad">{fmtInt(stats?.droppedRps ?? 0)}/s dropped</span>}
          </div>
        ) : null}
      </div>

      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
