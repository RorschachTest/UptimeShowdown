import { COMPONENTS } from './components'
import { addStats, bucketIndex, emptyStats } from './scoring'
import type {
  Flow,
  Graph,
  Level,
  NodeRuntime,
  NodeTickStats,
  SimEdge,
  SimNode,
  SimState,
  TickStats,
  TrafficClass,
} from './types'

export const TICK_MS = 100
export const TICKS_PER_SEC = 1000 / TICK_MS
/** Rolling window for live metrics: 5 s of game time. */
export const WINDOW_TICKS = 50

const CLASSES: TrafficClass[] = ['read', 'write']
const EPSILON = 1e-9

const zero = (): Flow => ({ read: 0, write: 0 })
const total = (f: Flow): number => f.read + f.write
const clean = (v: number): number => (v < EPSILON ? 0 : v)

/** Level traffic at a game time, linearly interpolated between points and held after the last one. */
export function trafficRpsAt(level: Level, seconds: number): number {
  const pts = level.traffic
  const first = pts[0]
  if (!first) return 0
  if (seconds <= first.t) return first.rps
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!
    const b = pts[i]!
    if (seconds <= b.t) return a.rps + ((seconds - a.t) / (b.t - a.t)) * (b.rps - a.rps)
  }
  return pts[pts.length - 1]!.rps
}

/** Topological order (Kahn) plus outgoing edges per node. Nodes on a cycle are left out. */
function topology(graph: Graph): { order: string[]; outEdges: Record<string, SimEdge[]> } {
  const ids = new Set(graph.nodes.map((n) => n.id))
  const indegree: Record<string, number> = {}
  const outEdges: Record<string, SimEdge[]> = {}
  for (const n of graph.nodes) {
    indegree[n.id] = 0
    outEdges[n.id] = []
  }
  for (const e of graph.edges) {
    if (!ids.has(e.source) || !ids.has(e.target) || e.source === e.target) continue
    outEdges[e.source]!.push(e)
    indegree[e.target]! += 1
  }
  const ready = graph.nodes.filter((n) => indegree[n.id] === 0).map((n) => n.id)
  const order: string[] = []
  while (ready.length > 0) {
    const id = ready.shift()!
    order.push(id)
    for (const e of outEdges[id]!) {
      indegree[e.target]! -= 1
      if (indegree[e.target] === 0) ready.push(e.target)
    }
  }
  return { order, outEdges }
}

export function initSim(graph: Graph, level: Level): SimState {
  return {
    tick: 0,
    graph,
    level,
    ...topology(graph),
    runtime: {},
    nodeStats: {},
    edgeRps: {},
    window: [],
    totals: emptyStats(),
    rng: level.seed,
  }
}

/** Swap in an edited graph mid-run. Queues of nodes that still exist are kept. */
export function withGraph(state: SimState, graph: Graph): SimState {
  const ids = new Set(graph.nodes.map((n) => n.id))
  const runtime: Record<string, NodeRuntime> = {}
  for (const [id, rt] of Object.entries(state.runtime)) if (ids.has(id)) runtime[id] = rt
  return { ...state, graph, ...topology(graph), runtime }
}

interface Inbox {
  count: Flow
  /** Sum of count × upstream latency, per class; divide by count for the average. */
  latencySum: Flow
}

/** One tick (100 ms of game time). Pure: never mutates `state`. */
export function step(state: SimState): SimState {
  const nodesById = new Map<string, SimNode>(state.graph.nodes.map((n) => [n.id, n]))
  const inbox: Record<string, Inbox> = {}
  const runtime: Record<string, NodeRuntime> = {}
  const nodeStats: Record<string, NodeTickStats> = {}
  const edgeRps: Record<string, number> = {}
  const stats: TickStats = emptyStats()
  const seconds = state.tick / TICKS_PER_SEC

  for (const id of state.order) {
    const node = nodesById.get(id)!
    const spec = COMPONENTS[node.kind]
    let processed: Flow
    let outLatency: Flow

    if (node.kind === 'traffic') {
      const perTick = trafficRpsAt(state.level, seconds) / TICKS_PER_SEC
      processed = { read: perTick * state.level.mix.read, write: perTick * state.level.mix.write }
      outLatency = zero()
      stats.emitted += perTick
      nodeStats[id] = { load: 0, processedRps: perTick * TICKS_PER_SEC, droppedRps: 0, queued: 0, latencyMs: 0 }
    } else {
      const inc = inbox[id] ?? { count: zero(), latencySum: zero() }
      const prev = state.runtime[id] ?? { queue: zero(), queueLatency: zero() }
      const capacity: Flow = {
        read: (spec.capacityRps.read * node.instances) / TICKS_PER_SEC,
        write: (spec.capacityRps.write * node.instances) / TICKS_PER_SEC,
      }
      const util = (f: Flow) => CLASSES.reduce((s, c) => s + f[c] / capacity[c], 0)

      const available: Flow = { read: inc.count.read + prev.queue.read, write: inc.count.write + prev.queue.write }
      const demand = util(available)
      const serveScale = demand > spec.maxUtil ? spec.maxUtil / demand : 1
      processed = { read: available.read * serveScale, write: available.write * serveScale }

      const leftover: Flow = { read: available.read - processed.read, write: available.write - processed.write }
      const leftoverUtil = util(leftover)
      const keepScale = leftoverUtil > spec.queueTicks ? spec.queueTicks / leftoverUtil : 1
      const queue: Flow = { read: clean(leftover.read * keepScale), write: clean(leftover.write * keepScale) }
      const dropped = clean(total(leftover) - total(queue))
      stats.errors += dropped

      // Latency: base × load factor, plus waiting behind the backlog that was already queued.
      const queueWaitMs = (util(prev.queue) / spec.maxUtil) * TICK_MS
      const nodeLatency = spec.baseLatencyMs * (1 + Math.min(demand, 2) ** 4) + queueWaitMs
      const upstream: Flow = zero()
      for (const c of CLASSES) {
        upstream[c] = available[c] > 0 ? (inc.latencySum[c] + prev.queue[c] * prev.queueLatency[c]) / available[c] : 0
      }
      outLatency = { read: upstream.read + nodeLatency, write: upstream.write + nodeLatency }

      runtime[id] = { queue, queueLatency: upstream }
      nodeStats[id] = {
        load: util(inc.count),
        processedRps: total(processed) * TICKS_PER_SEC,
        droppedRps: dropped * TICKS_PER_SEC,
        queued: total(queue),
        latencyMs: nodeLatency,
      }
    }

    // Route what this node served. A terminal node completes the request; the source with no
    // wire has nowhere to send it, so those are errors.
    const edges = state.outEdges[id] ?? []
    if (edges.length === 0) {
      if (node.kind === 'traffic') {
        stats.errors += total(processed)
      } else {
        for (const c of CLASSES) {
          if (processed[c] <= 0) continue
          stats.success += processed[c]
          const b = bucketIndex(outLatency[c])
          stats.latencyHist[b] = (stats.latencyHist[b] ?? 0) + processed[c]
        }
      }
      continue
    }
    const share = 1 / edges.length
    for (const e of edges) {
      const box = (inbox[e.target] ??= { count: zero(), latencySum: zero() })
      for (const c of CLASSES) {
        box.count[c] += processed[c] * share
        box.latencySum[c] += processed[c] * share * outLatency[c]
      }
      edgeRps[e.id] = total(processed) * share * TICKS_PER_SEC
    }
  }

  return {
    ...state,
    tick: state.tick + 1,
    runtime,
    nodeStats,
    edgeRps,
    window: [...state.window, stats].slice(-WINDOW_TICKS),
    totals: addStats(state.totals, stats),
  }
}
