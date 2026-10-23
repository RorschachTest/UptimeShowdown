import type { Flows } from './types'

export const TICK_MS = 100
export const TICKS_PER_SEC = 1000 / TICK_MS

export const EPSILON = 1e-9

export const flowKey = (type: number, step: number) => `${type}:${step}`

export function parseKey(key: string): [type: number, step: number] {
  const [t, s] = key.split(':')
  return [Number(t), Number(s)]
}

/** Merge a packet into a flow map, keeping a count-weighted average latency. */
export function addFlow(flows: Flows, key: string, count: number, latencyMs: number) {
  if (count <= EPSILON) return
  const f = flows[key]
  if (!f) {
    flows[key] = { count, latencyMs }
    return
  }
  const total = f.count + count
  f.latencyMs = (f.latencyMs * f.count + latencyMs * count) / total
  f.count = total
}
