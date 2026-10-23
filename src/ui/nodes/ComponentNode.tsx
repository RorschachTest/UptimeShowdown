import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useRef } from 'react'
import { CACHE_SIZES, CDN_HIT_RATE, COMPONENTS, DB_READ_RPS, DB_WRITE_RPS, MAX_REPLICAS, TIER_CAPACITY, TIER_LABELS } from '../../engine/components'
import { useGameStore } from '../../store'
import { fmtInt, fmtMs, loadStatus, statusColor } from '../format'
import type { GameNode, GameNodeData } from '../graph'
import { ComponentIcon } from '../icons'
import { isUnlocked } from '../settings'

/** Wheel delta per step: one mouse-wheel notch (~100 px), or a short trackpad swipe. */
const WHEEL_STEP = 100
const MAX_STACKED_COPIES = 4

function capacityLabel({ kind, instances, config }: GameNodeData): string {
  const m = TIER_CAPACITY[config.tier]
  switch (kind) {
    case 'sqldb':
      return `${fmtInt(DB_READ_RPS * m)} reads, ${fmtInt(DB_WRITE_RPS * m)} writes/s${config.replicas ? ` + ${config.replicas} replica${config.replicas > 1 ? 's' : ''}` : ''}`
    case 'cache':
      return `${config.cacheSize} · ~${Math.round(CACHE_SIZES[config.cacheSize].hitRate * 100)}% hits · ${config.writeStrategy === 'through' ? 'write-through' : 'cache-aside'}`
    case 'cdn':
      return `${config.cdnTtl} TTL · ~${Math.round(CDN_HIT_RATE[config.cdnTtl] * 100)}% hits`
    default:
      return `${fmtInt(COMPONENTS[kind].capacityRps * instances * (COMPONENTS[kind].tiered ? m : 1))} rps capacity`
  }
}

/** Every placeable piece: icon, capacity, a load gauge, and stacked copies for extra instances or replicas. */
export function ComponentNode({ id, data, selected }: NodeProps<GameNode>) {
  const stats = useGameStore((s) => s.sim.nodeStats[id])
  const replicasOpen = useGameStore((s) => isUnlocked(s.chapter, 'replicas', s.stageIndex))
  const { scaleNode, updateConfig } = useGameStore.getState()
  const spec = COMPONENTS[data.kind]
  const wheel = useRef(0)

  // Scroll scales out: instances for web servers, read replicas for the database.
  const scroll =
    data.kind === 'app'
      ? (dir: number) => scaleNode(id, dir)
      : data.kind === 'sqldb' && replicasOpen
        ? (dir: number) => updateConfig(id, { replicas: Math.min(MAX_REPLICAS, Math.max(0, data.config.replicas + dir)) })
        : null

  const onWheel = (e: React.WheelEvent) => {
    if (!scroll) return
    wheel.current += e.deltaY
    while (Math.abs(wheel.current) >= WHEEL_STEP) {
      const dir = wheel.current < 0 ? 1 : -1
      scroll(dir)
      wheel.current += dir * WHEEL_STEP
    }
  }

  const down = stats?.down === true
  const status = down ? 'bad' : loadStatus(stats?.load)
  const dropping = down || (stats?.droppedRps ?? 0) > 0.5
  const loadPct = Math.round((stats?.load ?? 0) * 100)
  const copies = Math.min(data.kind === 'sqldb' ? data.config.replicas : data.instances - 1, MAX_STACKED_COPIES)
  const showQueue = spec.queueTicks > 0 && (stats?.queued ?? 0) >= 1

  return (
    <div
      className={`relative w-52 ${scroll ? 'nowheel' : ''}`}
      onWheel={onWheel}
      title={scroll ? (data.kind === 'app' ? 'Scroll to add or remove instances' : 'Scroll to add or remove read replicas') : 'Click for settings'}
    >
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
          <span className="text-[15px] leading-tight font-semibold">{spec.label}</span>
          <span className="ml-auto flex gap-1">
            {spec.tiered && (
              <span className="rounded-md border-2 border-ink px-1 text-xs font-semibold" title="Machine size">
                {TIER_LABELS[data.config.tier]}
              </span>
            )}
            {data.kind === 'app' && <span className="rounded-md bg-ink px-1.5 py-0.5 text-xs font-semibold text-piece">×{data.instances}</span>}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-ink-soft">{capacityLabel(data)}</p>

        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-board" role="meter" aria-label="Load" aria-valuenow={loadPct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${down ? 100 : Math.min(loadPct, 100)}%`, background: statusColor[status] }} />
        </div>

        <div className="mt-1.5 flex items-baseline justify-between text-xs">
          <span className="font-semibold" style={{ color: status === 'idle' ? undefined : statusColor[status] }}>
            {down ? 'Down: crashed' : `${loadPct}% load`}
          </span>
          <span className="text-ink-soft">{stats && !down ? fmtMs(stats.latencyMs) : '–'}</span>
        </div>

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
