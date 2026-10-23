import { COMPONENTS, nodeCostPerMin, type Bottleneck } from './components'
import type { Graph, SimState, TickStats } from './types'

// Latency histogram buckets: upper bounds grow by 25% from 1 ms to ~23 s.
const BUCKET_GROWTH = 1.25
export const LATENCY_BUCKETS: number[] = Array.from({ length: 46 }, (_, i) => BUCKET_GROWTH ** i)

export function bucketIndex(latencyMs: number): number {
  if (latencyMs <= 1) return 0
  const i = Math.ceil(Math.log(latencyMs) / Math.log(BUCKET_GROWTH))
  return Math.min(i, LATENCY_BUCKETS.length - 1)
}

export function emptyStats(): TickStats {
  return {
    emitted: 0,
    success: 0,
    errors: 0,
    deadEnds: 0,
    stale: 0,
    latencyHist: new Array<number>(LATENCY_BUCKETS.length).fill(0),
  }
}

export function addStats(a: TickStats, b: TickStats): TickStats {
  return {
    emitted: a.emitted + b.emitted,
    success: a.success + b.success,
    errors: a.errors + b.errors,
    deadEnds: a.deadEnds + b.deadEnds,
    stale: a.stale + b.stale,
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
  deadEndRps: number
  /** successful / (successful + failed). Requests still queued count as neither. 1 when idle. */
  uptime: number
  p50Ms: number
  p95Ms: number
  /** Stale answers as a share of successful requests. */
  staleRate: number
}

export function metricsOf(sum: TickStats, ticks: number): Metrics {
  const seconds = ticks / 10 || 1
  const finished = sum.success + sum.errors
  return {
    rps: sum.emitted / seconds,
    successRps: sum.success / seconds,
    errorRps: sum.errors / seconds,
    deadEndRps: sum.deadEnds / seconds,
    uptime: finished > 0 ? sum.success / finished : 1,
    p50Ms: percentile(sum.latencyHist, 0.5),
    p95Ms: percentile(sum.latencyHist, 0.95),
    staleRate: sum.success > 0 ? sum.stale / sum.success : 0,
  }
}

/** Metrics over a run of ticks; each tick is 100 ms of game time. */
export function summarize(ticks: TickStats[]): Metrics {
  return metricsOf(ticks.reduce(addStats, emptyStats()), ticks.length)
}

export function graphCostPerMin(graph: Graph): number {
  return graph.nodes.reduce((s, n) => s + nodeCostPerMin(n), 0)
}

export interface StageResult {
  stars: 0 | 1 | 2 | 3
  metrics: Metrics
  cost: number
  /** Plain-language reasons for each missed star, in star order. */
  missed: string[]
}

/** Score a finished stage: ★ goals met, ★★ within budget, ★★★ not over-built (≤ 1.5× reference cost). */
export function stageResult(state: SimState): StageResult {
  const stage = state.chapter.stages[state.stageIndex]!
  const metrics = metricsOf(state.totals, state.tick)
  const cost = graphCostPerMin(state.graph)
  const { goals } = stage

  const missed: string[] = []
  if (metrics.uptime < goals.uptime) missed.push(`Uptime ${(metrics.uptime * 100).toFixed(1)}% is below ${goals.uptime * 100}%`)
  if (metrics.p95Ms > goals.p95Ms) missed.push(`p95 latency ${Math.round(metrics.p95Ms)} ms is over ${goals.p95Ms} ms`)
  if (metrics.staleRate > goals.maxStaleRate)
    missed.push(`${(metrics.staleRate * 100).toFixed(1)}% of answers were stale (users didn't see their own writes)`)
  const goalsMet = missed.length === 0
  const inBudget = cost <= stage.budget
  const lean = cost <= stage.referenceCost * 1.5

  if (goalsMet && !inBudget) missed.push(`Cost ${cost}/min is over the ${stage.budget}/min budget`)
  if (goalsMet && inBudget && !lean)
    missed.push(`Over-built: ${cost}/min where about ${stage.referenceCost}/min would do. Add capacity only where it's needed`)

  const stars = !goalsMet ? 0 : !inBudget ? 1 : !lean ? 2 : 3
  return { stars, metrics, cost, missed }
}

export type { Bottleneck }

export interface Diagnosis {
  bound: Bottleneck
  nodeId: string
  label: string
  load: number
  down: boolean
}

/** The resource that's limiting the system right now, if any node is near saturation or down. */
export function diagnose(state: SimState): Diagnosis | null {
  let worst: Diagnosis | null = null
  for (const node of state.graph.nodes) {
    const s = state.nodeStats[node.id]
    if (!s || node.kind === 'traffic') continue
    const load = s.down ? Infinity : s.load
    if (load < 0.85 || (worst && load <= worst.load)) continue
    // A compute node mostly shipping static files is really limited by bandwidth.
    const own = COMPONENTS[node.kind].bound
    const bound: Bottleneck = own === 'compute' && s.staticShare > 0.5 ? 'network' : own
    worst = { bound, nodeId: node.id, label: COMPONENTS[node.kind].label, load, down: s.down }
  }
  return worst
}
