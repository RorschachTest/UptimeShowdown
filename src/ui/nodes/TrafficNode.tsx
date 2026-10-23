import { Handle, Position, type NodeProps } from '@xyflow/react'
import { currentStage, trafficRpsAt, TICKS_PER_SEC } from '../../engine/simulator'
import { useGameStore } from '../../store'
import { fmtInt, fmtPct } from '../format'
import type { GameNode } from '../graph'
import { ComponentIcon } from '../icons'
import { useFactVisible } from '../interview/facts'
import { TYPE_COLORS } from '../settings'

/** Where the stage's users come from. Set by the stage; the player can only wire it up. */
export function TrafficNode({ id }: NodeProps<GameNode>) {
  const sim = useGameStore((s) => s.sim)
  const wired = useGameStore((s) => s.edges.some((e) => e.source === id))
  const stage = currentStage(sim)
  const rps = trafficRpsAt(stage, sim.tick / TICKS_PER_SEC)
  const types = sim.chapter.requestTypes.filter((rt) => (stage.mix[rt.id] ?? 0) > 0)
  // In an interview, numbers stay hidden until the player asks (or watches a run).
  const showScale = useFactVisible('scale')
  const showMix = useFactVisible('mix')

  return (
    <div className="relative w-48">
      <div className="piece bg-ink px-3 pt-2.5 pb-3 text-piece">
        <div className="flex items-center gap-2">
          <ComponentIcon kind="traffic" />
          <span className="text-[15px] leading-tight font-semibold">Users</span>
        </div>
        <p className="mt-1 text-2xl leading-none font-bold">
          {showScale ? fmtInt(rps) : '?'} <span className="text-sm font-medium opacity-70">rps</span>
        </p>

        <div className="mt-2.5 flex h-2 overflow-hidden rounded-full" aria-hidden="true">
          {types.map((rt) => (
            <div key={rt.id} style={{ width: `${showMix ? (stage.mix[rt.id] ?? 0) * 100 : 100 / types.length}%`, background: showMix ? TYPE_COLORS[rt.id] : 'var(--color-ink-soft)' }} />
          ))}
        </div>
        <ul className="mt-1.5 grid grid-cols-2 gap-x-2 text-xs opacity-85">
          {types.map((rt) => (
            <li key={rt.id} className="flex items-center gap-1">
              <span className="size-1.5 rounded-full" style={{ background: TYPE_COLORS[rt.id] }} aria-hidden="true" />
              {rt.label} {showMix ? fmtPct(stage.mix[rt.id] ?? 0) : '?'}
            </li>
          ))}
        </ul>
        {!wired && <p className="mt-2 text-xs font-medium text-warn">Not connected: every request fails</p>}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
