import { COMPONENTS, DB_READ_RPS, DB_WRITE_RPS, TIER_CAPACITY, hitRate, serves } from './components'
import { addStats, bucketIndex, emptyStats } from './scoring'
import type {
  Capability,
  Chapter,
  ComponentKind,
  Flows,
  Graph,
  NodeRuntime,
  NodeTickStats,
  SimEdge,
  SimNode,
  SimState,
  Stage,
  TickStats,
} from './types'

export const TICK_MS = 100
export const TICKS_PER_SEC = 1000 / TICK_MS
/** Rolling window for live metrics: 5 s of game time. */
export const WINDOW_TICKS = 50

const EPSILON = 1e-9

const flowKey = (type: number, step: number) => `${type}:${step}`
function parseKey(key: string): [type: number, step: number] {
  const [t, s] = key.split(':')
  return [Number(t), Number(s)]
}

function addFlow(flows: Flows, key: string, count: number, latencyMs: number) {
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

const isCompute = (kind: ComponentKind) => kind === 'app' || kind === 'allinone'

export function currentStage(state: Pick<SimState, 'chapter' | 'stageIndex'>): Stage {
  return state.chapter.stages[state.stageIndex]!
}

/** Stage traffic at a game time, linearly interpolated between points and held after the last one. */
export function trafficRpsAt(stage: Stage, seconds: number): number {
  const pts = stage.traffic
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

/** Steps a full (non-partial) node completes in one visit, starting at `step`. */
function advance(kind: ComponentKind, needs: Capability[], step: number): number {
  let j = step
  while (j < needs.length && serves(kind, needs[j])) j++
  return j
}

interface Topology {
  order: string[]
  outEdges: Record<string, SimEdge[]>
  lbFed: Record<string, boolean>
  reach: Record<string, boolean[][]>
}

/** Topological order (Kahn), outgoing edges, LB-fed nodes, and which requests each node can complete. */
function topology(graph: Graph, chapter: Chapter): Topology {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const indegree: Record<string, number> = {}
  const outEdges: Record<string, SimEdge[]> = {}
  const lbFed: Record<string, boolean> = {}
  for (const n of graph.nodes) {
    indegree[n.id] = 0
    outEdges[n.id] = []
  }
  for (const e of graph.edges) {
    const src = byId.get(e.source)
    if (!src || !byId.has(e.target) || e.source === e.target) continue
    outEdges[e.source]!.push(e)
    indegree[e.target]! += 1
    if (src.kind === 'lb') lbFed[e.target] = true
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

  // A node completes (type, step) if it finishes the request itself or hands it to a child that can.
  // Partial nodes (cache, CDN) need both paths: hits continue from step+1, misses from step.
  const reach: Record<string, boolean[][]> = {}
  const childCan = (id: string, t: number, step: number) =>
    step >= chapter.requestTypes[t]!.needs.length || outEdges[id]!.some((e) => reach[e.target]?.[t]?.[step] === true)
  for (const id of [...order].reverse()) {
    const node = byId.get(id)!
    const spec = COMPONENTS[node.kind]
    reach[id] = chapter.requestTypes.map((rt, t) =>
      rt.needs.map((need, step) => {
        if (spec.partial && serves(node.kind, need)) return childCan(id, t, step + 1) && childCan(id, t, step)
        return childCan(id, t, advance(node.kind, rt.needs, step))
      }),
    )
  }
  return { order, outEdges, lbFed, reach }
}

export function initSim(graph: Graph, chapter: Chapter, stageIndex: number): SimState {
  return {
    tick: 0,
    graph,
    chapter,
    stageIndex,
    ...topology(graph, chapter),
    runtime: {},
    nodeStats: {},
    edgeRps: {},
    window: [],
    totals: emptyStats(),
    rng: chapter.seed,
  }
}

/** Swap in an edited graph mid-run. Queues of nodes that still exist are kept. */
export function withGraph(state: SimState, graph: Graph): SimState {
  const ids = new Set(graph.nodes.map((n) => n.id))
  const runtime: Record<string, NodeRuntime> = {}
  for (const [id, rt] of Object.entries(state.runtime)) if (ids.has(id)) runtime[id] = rt
  return { ...state, graph, ...topology(graph, state.chapter), runtime }
}

export function stageFinished(state: SimState): boolean {
  return state.tick >= currentStage(state).durationS * TICKS_PER_SEC
}

/** Result of serving the inflow (+ backlog) at one node for one tick. */
interface Served {
  served: Flows
  queue: Flows
  dropped: number
  load: number
  latencyMs: number
  stale: number
}

/** Generic node: one capacity pool in weighted units, optional backlog. */
function serveGeneric(node: SimNode, instances: number, inflow: Flows, backlog: Flows, weights: number[]): Served {
  const spec = COMPONENTS[node.kind]
  const tierMult = spec.tiered ? TIER_CAPACITY[node.config.tier] : 1
  const capTick = (spec.capacityRps * instances * tierMult) / TICKS_PER_SEC
  const units = (f: Flows) =>
    Object.entries(f).reduce((s, [k, p]) => s + p.count * (weights[parseKey(k)[0]] ?? 1), 0)

  const all: Flows = {}
  for (const [k, p] of Object.entries(backlog)) addFlow(all, k, p.count, p.latencyMs)
  for (const [k, p] of Object.entries(inflow)) addFlow(all, k, p.count, p.latencyMs)

  const demand = units(all) / capTick
  const serveScale = demand > spec.maxUtil ? spec.maxUtil / demand : 1
  const leftoverUtil = (demand - demand * serveScale) || 0
  const keepScale = leftoverUtil > spec.queueTicks ? spec.queueTicks / leftoverUtil : 1

  const served: Flows = {}
  const queue: Flows = {}
  let dropped = 0
  for (const [k, p] of Object.entries(all)) {
    addFlow(served, k, p.count * serveScale, p.latencyMs)
    const left = p.count * (1 - serveScale)
    addFlow(queue, k, left * keepScale, p.latencyMs)
    dropped += left * (1 - keepScale)
  }
  const queueWaitMs = (units(backlog) / capTick / spec.maxUtil) * TICK_MS
  return {
    served,
    queue,
    dropped,
    load: units(inflow) / capTick,
    latencyMs: spec.baseLatencyMs * (1 + Math.min(demand, 2) ** 4) + queueWaitMs,
    stale: 0,
  }
}

/** SQL DB: a primary (reads + writes) plus read replicas, routed by the read-routing setting. */
function serveDb(node: SimNode, inflow: Flows, chapter: Chapter): Served {
  const spec = COMPONENTS.sqldb
  const m = TIER_CAPACITY[node.config.tier]
  const readCap = (DB_READ_RPS * m) / TICKS_PER_SEC
  const writeCap = (DB_WRITE_RPS * m) / TICKS_PER_SEC
  const replicas = node.config.replicas

  // Share of each read flow that goes to replicas.
  const replicaShare = (t: number) => {
    if (replicas === 0) return 0
    const routing = node.config.readRouting
    if (routing === 'replicas') return replicas / (1 + replicas)
    if (routing === 'ryw') return chapter.requestTypes[t]!.consistency === 'ryw' ? 0 : 1
    return 0
  }

  let primaryReads = 0
  let replicaReads = 0
  let writes = 0
  const entries = Object.entries(inflow).map(([k, p]) => {
    const [t, step] = parseKey(k)
    const need = chapter.requestTypes[t]!.needs[step]
    const share = need === 'lookup' ? replicaShare(t) : 0
    if (need === 'lookup') {
      primaryReads += p.count * (1 - share)
      replicaReads += p.count * share
    } else writes += p.count
    return { k, t, p, share }
  })

  const primaryUtil = primaryReads / readCap + writes / writeCap
  const replicaUtil = replicas > 0 ? replicaReads / (readCap * replicas) : 0
  const sp = primaryUtil > spec.maxUtil ? spec.maxUtil / primaryUtil : 1
  const sr = replicaUtil > spec.maxUtil ? spec.maxUtil / replicaUtil : 1

  const served: Flows = {}
  let dropped = 0
  let stale = 0
  for (const { k, t, p, share } of entries) {
    const ok = p.count * ((1 - share) * sp + share * sr)
    addFlow(served, k, ok, p.latencyMs)
    dropped += p.count - ok
    // Replicas lag the primary: a user reading their own write there may not see it.
    if (chapter.requestTypes[t]!.consistency === 'ryw') stale += p.count * share * sr
  }
  const load = Math.max(primaryUtil, replicaUtil)
  return {
    served,
    queue: {},
    dropped,
    load,
    latencyMs: spec.baseLatencyMs * (1 + Math.min(load, 2) ** 4),
    stale,
  }
}

/** One tick (100 ms of game time). Pure: never mutates `state`. */
export function step(state: SimState): SimState {
  const { chapter, outEdges, reach } = state
  const stage = currentStage(state)
  const types = chapter.requestTypes
  const weights = types.map((rt) => rt.weight)
  const nodesById = new Map<string, SimNode>(state.graph.nodes.map((n) => [n.id, n]))
  const inbox: Record<string, Flows> = {}
  const runtime: Record<string, NodeRuntime> = {}
  const nodeStats: Record<string, NodeTickStats> = {}
  const edgeRps: Record<string, number> = {}
  const stats: TickStats = emptyStats()
  const seconds = state.tick / TICKS_PER_SEC

  // Crash events knock one instance off the first node of the target kind.
  const crashed = new Set<string>()
  for (const ev of stage.events) {
    if (seconds < ev.t || seconds >= ev.t + ev.durationS) continue
    const target = state.order.find((id) => nodesById.get(id)?.kind === ev.target)
    if (target) crashed.add(target)
  }

  const fail = (count: number) => {
    stats.errors += count
  }

  for (const id of state.order) {
    const node = nodesById.get(id)!
    const spec = COMPONENTS[node.kind]

    const route = (t: number, stepIdx: number, count: number, latencyMs: number) => {
      if (count <= EPSILON) return
      const valid = (outEdges[id] ?? []).filter((e) => reach[e.target]?.[t]?.[stepIdx] === true)
      if (valid.length === 0) {
        stats.deadEnds += count
        fail(count)
        return
      }
      const share = count / valid.length
      for (const e of valid) {
        addFlow((inbox[e.target] ??= {}), flowKey(t, stepIdx), share, latencyMs)
        edgeRps[e.id] = (edgeRps[e.id] ?? 0) + share * TICKS_PER_SEC
      }
    }
    const finishOrRoute = (t: number, stepIdx: number, count: number, latencyMs: number) => {
      const rt = types[t]!
      if (stepIdx < rt.needs.length) return route(t, stepIdx, count, latencyMs)
      if (count <= EPSILON) return
      const total = latencyMs + (node.kind === 'cdn' ? 0 : rt.distanceMs)
      stats.success += count
      const b = bucketIndex(total)
      stats.latencyHist[b] = (stats.latencyHist[b] ?? 0) + count
    }

    if (node.kind === 'traffic') {
      const perTick = trafficRpsAt(stage, seconds) / TICKS_PER_SEC
      stats.emitted += perTick
      types.forEach((rt, t) => route(t, 0, perTick * (stage.mix[rt.id] ?? 0), 0))
      nodeStats[id] = { load: 0, processedRps: perTick * TICKS_PER_SEC, droppedRps: 0, queued: 0, latencyMs: 0, down: false, staticShare: 0 }
      continue
    }

    const inflow = inbox[id] ?? {}
    const backlog = state.runtime[id]?.queue ?? {}

    // Without a load balancer in front, users can only reach one of the instances.
    let instances = isCompute(node.kind) && !state.lbFed[id] ? Math.min(node.instances, 1) : node.instances
    if (crashed.has(id)) instances -= 1
    if (instances <= 0) {
      const lost = [...Object.values(inflow), ...Object.values(backlog)].reduce((s, p) => s + p.count, 0)
      fail(lost)
      nodeStats[id] = { load: 0, processedRps: 0, droppedRps: lost * TICKS_PER_SEC, queued: 0, latencyMs: 0, down: true, staticShare: 0 }
      continue
    }

    const res = node.kind === 'sqldb' ? serveDb(node, inflow, chapter) : serveGeneric(node, instances, inflow, backlog, weights)
    fail(res.dropped)
    stats.stale += res.stale

    const h = hitRate(node)
    let staticUnits = 0
    let allUnits = 0
    for (const [k, p] of Object.entries(res.served)) {
      const [t, stepIdx] = parseKey(k)
      const rt = types[t]!
      const latencyMs = p.latencyMs + res.latencyMs
      const units = p.count * rt.weight
      allUnits += units
      if (rt.needs[stepIdx] === 'static') staticUnits += units

      if (spec.partial && serves(node.kind, rt.needs[stepIdx])) {
        const hits = p.count * h
        // Cache-aside can hand back a value from before the user's own write.
        if (node.kind === 'cache' && rt.consistency === 'ryw' && node.config.writeStrategy === 'aside') stats.stale += hits
        finishOrRoute(t, stepIdx + 1, hits, latencyMs)
        route(t, stepIdx, p.count - hits, latencyMs)
      } else {
        finishOrRoute(t, advance(node.kind, rt.needs, stepIdx), p.count, latencyMs)
      }
    }

    runtime[id] = { queue: res.queue }
    nodeStats[id] = {
      load: res.load,
      processedRps: Object.values(res.served).reduce((s, p) => s + p.count, 0) * TICKS_PER_SEC,
      droppedRps: res.dropped * TICKS_PER_SEC,
      queued: Object.values(res.queue).reduce((s, p) => s + p.count, 0),
      latencyMs: res.latencyMs,
      down: false,
      staticShare: allUnits > 0 ? staticUnits / allUnits : 0,
      ...(spec.partial ? { hitRate: h } : {}),
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
