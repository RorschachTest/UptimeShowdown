import { Handle, Position, type NodeProps } from '@xyflow/react'
import { trafficRpsAt, TICKS_PER_SEC } from '../../engine/simulator'
import { useGameStore } from '../../store'
import { fmtInt, fmtPct } from '../format'
import type { GameNode } from '../graph'
import { ComponentIcon } from '../icons'

/** Where the level's users come from. Set by the level; the player can only wire it up. */
export function TrafficNode({ id }: NodeProps<GameNode>) {
  const level = useGameStore((s) => s.level)
  const tick = useGameStore((s) => s.sim.tick)
  const wired = useGameStore((s) => s.edges.some((e) => e.source === id))
  const rps = trafficRpsAt(level, tick / TICKS_PER_SEC)

  return (
    <div className="relative w-44">
      <div className="piece bg-ink px-3 pt-2.5 pb-3 text-piece">
        <div className="flex items-center gap-2">
          <ComponentIcon kind="traffic" />
          <span className="text-[15px] leading-tight font-semibold">Users</span>
        </div>
        <p className="mt-1 text-2xl leading-none font-bold">
          {fmtInt(rps)} <span className="text-sm font-medium opacity-70">rps</span>
        </p>

        <div className="mt-2.5 flex h-2 overflow-hidden rounded-full" aria-hidden="true">
          <div className="bg-read" style={{ width: `${level.mix.read * 100}%` }} />
          <div className="bg-write" style={{ width: `${level.mix.write * 100}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-xs opacity-80">
          <span>{fmtPct(level.mix.read)} reads</span>
          <span>{fmtPct(level.mix.write)} writes</span>
        </div>
        {!wired && <p className="mt-2 text-xs font-medium text-warn">Not connected: every request fails</p>}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
