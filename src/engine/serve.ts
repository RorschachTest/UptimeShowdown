import { COMPONENTS, tierMult, type Served, type ServeContext } from './components'
import { addFlow, parseKey, TICK_MS, TICKS_PER_SEC } from './flows'
import type { Flows, SimNode } from './types'

/** Default serving model: one capacity pool in weighted units, with an optional backlog. */
export function serveGeneric(node: SimNode, { instances, inflow, backlog, chapter }: ServeContext): Served {
  const def = COMPONENTS[node.kind]
  const weights = chapter.requestTypes.map((rt) => rt.weight)
  const capTick = (def.capacityRps * instances * tierMult(def, node.config.tier)) / TICKS_PER_SEC
  const units = (f: Flows) => Object.entries(f).reduce((s, [k, p]) => s + p.count * (weights[parseKey(k)[0]] ?? 1), 0)

  const all: Flows = {}
  for (const [k, p] of Object.entries(backlog)) addFlow(all, k, p.count, p.latencyMs)
  for (const [k, p] of Object.entries(inflow)) addFlow(all, k, p.count, p.latencyMs)

  const demand = units(all) / capTick
  const serveScale = demand > def.maxUtil ? def.maxUtil / demand : 1
  const leftoverUtil = demand - demand * serveScale
  const keepScale = leftoverUtil > def.queueTicks ? def.queueTicks / leftoverUtil : 1

  const served: Flows = {}
  const queue: Flows = {}
  const dropped: Record<number, number> = {}
  for (const [k, p] of Object.entries(all)) {
    addFlow(served, k, p.count * serveScale, p.latencyMs)
    const left = p.count * (1 - serveScale)
    addFlow(queue, k, left * keepScale, p.latencyMs)
    const t = parseKey(k)[0]
    dropped[t] = (dropped[t] ?? 0) + left * (1 - keepScale)
  }
  const queueWaitMs = (units(backlog) / capTick / def.maxUtil) * TICK_MS
  return {
    served,
    queue,
    dropped,
    load: units(inflow) / capTick,
    latencyMs: def.baseLatencyMs * (1 + Math.min(demand, 2) ** 4) + queueWaitMs,
    stale: 0,
  }
}
