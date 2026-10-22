import { costPerMin } from './components'
import type { Graph, TickStats } from './types'

// Latency histogram buckets: upper bounds grow by 25% from 1 ms to ~23 s.
const BUCKET_GROWTH = 1.25
export const LATENCY_BUCKETS: number[] = Array.from({ length: 46 }, (_, i) => BUCKET_GROWTH ** i)

export function bucketIndex(latencyMs: number): number {
  if (latencyMs <= 1) return 0
  const i = Math.ceil(Math.log(latencyMs) / Math.log(BUCKET_GROWTH))
  return Math.min(i, LATENCY_BUCKETS.length - 1)
}

export function emptyStats(): TickStats {
  return { emitted: 0, success: 0, errors: 0, latencyHist: new Array<number>(LATENCY_BUCKETS.length).fill(0) }
}

export function addStats(a: TickStats, b: TickStats): TickStats {
  return {
    emitted: a.emitted + b.emitted,
    success: a.success + b.success,
    errors: a.errors + b.errors,
    latencyHist: a.latencyHist.map((v, i) => v + (b.latencyHist[i] ?? 0)),
  }
}

/** Latency at percentile p (0..1), interpolated inside the bucket. 0 when nothing succeeded. */
export function percentile(hist: number[], p: number): number {
  const total = hist.reduce((s, v) => s + v, 0)
  if (total <= 0) return 0
  const target = total * p
  let cum = 0
  for (let i = 0; i < hist.length; i++) {
    const count = hist[i] ?? 0
    if (count > 0 && cum + count >= target) {
      const lower = i === 0 ? 0 : (LATENCY_BUCKETS[i - 1] ?? 0)
      const upper = LATENCY_BUCKETS[i] ?? lower
      return lower + ((target - cum) / count) * (upper - lower)
    }
    cum += count
  }
  return LATENCY_BUCKETS[LATENCY_BUCKETS.length - 1] ?? 0
}

export interface Metrics {
  rps: number
  successRps: number
  errorRps: number
  /** successful / (successful + failed). Requests still queued count as neither. 1 when idle. */
  uptime: number
  p50Ms: number
  p95Ms: number
}

/** Metrics over a run of ticks; each tick is 100 ms of game time. */
export function summarize(ticks: TickStats[]): Metrics {
  const sum = ticks.reduce(addStats, emptyStats())
  const seconds = ticks.length / 10 || 1
  const finished = sum.success + sum.errors
  return {
    rps: sum.emitted / seconds,
    successRps: sum.success / seconds,
    errorRps: sum.errors / seconds,
    uptime: finished > 0 ? sum.success / finished : 1,
    p50Ms: percentile(sum.latencyHist, 0.5),
    p95Ms: percentile(sum.latencyHist, 0.95),
  }
}

export function graphCostPerMin(graph: Graph): number {
  return graph.nodes.reduce((s, n) => s + costPerMin(n.kind, n.instances), 0)
}
