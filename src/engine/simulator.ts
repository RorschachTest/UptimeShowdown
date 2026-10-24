import { COMPONENTS, hitRate, serves, type ServeContext } from './components'
import { addFlow, EPSILON, flowKey, parseKey, TICKS_PER_SEC } from './flows'
import { serveGeneric } from './serve'
import { addStats, bucketIndex, emptyStats } from './scoring'
import type { Capability, Chapter, ComponentKind, Flows, Graph, NodeRuntime, NodeTickStats, SimEdge, SimEvent, SimNode, SimState, Stage, TickStats } from './types'

export { TICK_MS, TICKS_PER_SEC } from './flows'
/** Rolling window for live metrics: 5 s of game time. */
export const WINDOW_TICKS = 50

/** Some pieces can only use more than one instance behind a router (load balancer, API gateway). */
const needsLb = (kind: ComponentKind) => COMPONENTS[kind].needsRouter

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
  buffered: Record<string, boolean>
  inEdges: Record<string, SimEdge[]>
  reach: Record<string, boolean[][]>
}

/** Topological order (Kahn), outgoing edges, LB-fed nodes, and which requests each node can complete. */
function topology(graph: Graph, chapter: Chapter): Topology {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const indegree: Record<string, number> = {}
  const outEdges: Record<string, SimEdge[]> = {}
  const lbFed: Record<string, boolean> = {}
  const buffered: Record<string, boolean> = {}
  const inEdges: Record<string, SimEdge[]> = {}
  for (const n of graph.nodes) {
    indegree[n.id] = 0
    outEdges[n.id] = []
  }
  for (const e of graph.edges) {
    const src = byId.get(e.source)
    if (!src || !byId.has(e.target) || e.source === e.target) continue
    outEdges[e.source]!.push(e)
    ;(inEdges[e.target] ??= []).push(e)
    indegree[e.target]! += 1
    if (COMPONENTS[src.kind].balances) lbFed[e.target] = true
    if (COMPONENTS[src.kind].buffers) buffered[e.target] = true
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
        if (!spec.relays && !serves(node.kind, need)) return false
        return childCan(id, t, advance(node.kind, rt.needs, step))
      }),
    )
  }
  return { order, outEdges, lbFed, buffered, inEdges, reach }
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
    edgeTypes: {},
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

/** Wires a request of type t at step `stepIdx` may take out of node `from`: those that can still complete it. */
export function validEdges(state: Pick<SimState, 'chapter' | 'outEdges' | 'reach'>, nodesById: Map<string, SimNode>, from: string, t: number, stepIdx: number): SimEdge[] {
  let valid = (state.outEdges[from] ?? []).filter((e) => state.reach[e.target]?.[t]?.[stepIdx] === true)
  // Edge pieces (CDN) work like a separate hostname: they get what they serve, and other
  // requests skip them when another path exists. As the only path they proxy everything.
  const need = state.chapter.requestTypes[t]!.needs[stepIdx]
  const kindOf = (e: SimEdge) => nodesById.get(e.target)!.kind
  const edgeServing = valid.filter((e) => COMPONENTS[kindOf(e)].edge && serves(kindOf(e), need))
  const nonEdge = valid.filter((e) => !COMPONENTS[kindOf(e)].edge)
  if (edgeServing.length > 0) valid = edgeServing
  else if (nonEdge.length > 0) valid = nonEdge
  return valid
}

/** Steps a full (non-partial) node completes in one visit, starting at `step`. */
export function stepsDone(kind: ComponentKind, needs: Capability[], step: number): number {
  return advance(kind, needs, step)
}

/** One tick (100 ms of game time). Pure: never mutates `state`. */
export function step(state: SimState): SimState {
  const { chapter } = state
  const stage = currentStage(state)
  const types = chapter.requestTypes
  const nodesById = new Map<string, SimNode>(state.graph.nodes.map((n) => [n.id, n]))
  const inbox: Record<string, Flows> = {}
  const runtime: Record<string, NodeRuntime> = {}
  const nodeStats: Record<string, NodeTickStats> = {}
  const edgeRps: Record<string, number> = {}
  const edgeTypes: Record<string, Record<number, number>> = {}
  const stats: TickStats = emptyStats()
  const seconds = state.tick / TICKS_PER_SEC

  // Events target the first node of their kind. Crashes knock one instance off while active;
  // other kinds are handed to the component (fired this tick, or in effect now).
  const crashed = new Set<string>()
  const fired: Record<string, SimEvent[]> = {}
  const active: Record<string, SimEvent[]> = {}
  for (const ev of stage.events) {
    const target = state.order.find((id) => nodesById.get(id)?.kind === ev.target)
    if (!target) continue
    const live = seconds >= ev.t && seconds < ev.t + (ev.durationS ?? Infinity)
    const spec = COMPONENTS[ev.target]
    const failsOver = spec.failover?.(nodesById.get(target)!) === true
    const firesNow = seconds >= ev.t && seconds < ev.t + 1 / TICKS_PER_SEC
    if (ev.kind === 'crash' && live && !failsOver) crashed.add(target)
    if (ev.kind === 'crash' && firesNow && !failsOver && spec.crashLoses) stats.violations[spec.crashLoses] = (stats.violations[spec.crashLoses] ?? 0) + 1
    if (firesNow) (fired[target] ??= []).push(ev)
    if (live) (active[target] ??= []).push(ev)
  }

  // Async types answer the user at their `asyncAfter` step; later steps are background work.
  const ackStep = types.map((rt) => (rt.asyncAfter ? rt.needs.indexOf(rt.asyncAfter) + 1 : Infinity))
  const isBg = (t: number, stepIdx: number) => stepIdx >= (ackStep[t] ?? Infinity)

  // Abusive traffic never counts toward uptime: a lost scraper request is a bot stopped.
  // Lost background work never reaches the user either: it's a lost message.
  const fail = (t: number, count: number, bg = false) => {
    if (types[t]?.abusive) stats.botStopped += count
    else if (bg) stats.violations.lostMessages = (stats.violations.lostMessages ?? 0) + count
    else stats.errors += count
  }

  for (const id of state.order) {
    const node = nodesById.get(id)!
    const spec = COMPONENTS[node.kind]

    const route = (t: number, stepIdx: number, count: number, latencyMs: number) => {
      if (count <= EPSILON) return
      const valid = validEdges(state, nodesById, id, t, stepIdx)
      if (valid.length === 0) {
        const bg = isBg(t, stepIdx)
        if (!types[t]!.abusive && !bg) stats.deadEnds += count
        fail(t, count, bg)
        return
      }
      const share = count / valid.length
      for (const e of valid) {
        addFlow((inbox[e.target] ??= {}), flowKey(t, stepIdx), share, latencyMs)
        edgeRps[e.id] = (edgeRps[e.id] ?? 0) + share * TICKS_PER_SEC
        const byType = (edgeTypes[e.id] ??= {})
        byType[t] = (byType[t] ?? 0) + share * TICKS_PER_SEC
      }
    }
    const answer = (t: number, count: number, latencyMs: number) => {
      const total = latencyMs + (node.kind === 'cdn' ? 0 : types[t]!.distanceMs)
      stats.success += count
      const b = bucketIndex(total)
      stats.latencyHist[b] = (stats.latencyHist[b] ?? 0) + count
    }
    const finishOrRoute = (t: number, from: number, stepIdx: number, count: number, latencyMs: number) => {
      const rt = types[t]!
      if (count <= EPSILON) return
      // Crossing the async boundary answers the user; the rest carries on in the background.
      if (!rt.abusive && from < (ackStep[t] ?? Infinity) && stepIdx >= (ackStep[t] ?? Infinity)) answer(t, count, latencyMs)
      if (stepIdx < rt.needs.length) return route(t, stepIdx, count, latencyMs)
      if (rt.abusive) {
        stats.botServed += count
        return
      }
      if (rt.asyncAfter) {
        stats.bgDone += count
        const b = bucketIndex(latencyMs)
        stats.bgLatencyHist[b] = (stats.bgLatencyHist[b] ?? 0) + count
        return
      }
      answer(t, count, latencyMs)
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
    let instances = needsLb(node.kind) && !state.lbFed[id] ? Math.min(node.instances, 1) : node.instances
    if (crashed.has(id)) instances -= 1
    if (instances <= 0) {
      let lost = 0
      for (const [k, p] of [...Object.entries(inflow), ...Object.entries(backlog)]) {
        const [t, s] = parseKey(k)
        fail(t, p.count, isBg(t, s))
        lost += p.count
      }
      nodeStats[id] = { load: 0, processedRps: 0, droppedRps: lost * TICKS_PER_SEC, queued: 0, latencyMs: 0, down: true, staticShare: 0 }
      continue
    }

    const prevState = state.runtime[id]?.state
    const ctx: ServeContext = {
      instances,
      inflow,
      backlog,
      chapter,
      stage,
      seconds,
      state: prevState,
      fired: fired[id] ?? [],
      active: active[id] ?? [],
      buffered: !!state.buffered[id],
      parents: (state.inEdges[id] ?? []).map((e) => nodesById.get(e.source)!),
    }
    const res = spec.serve ? spec.serve(node, ctx) : serveGeneric(node, ctx)
    // Drops are reported per type; split them between user-facing and background flows by what arrived.
    const bgShare: Record<number, [number, number]> = {}
    for (const [k, p] of [...Object.entries(inflow), ...Object.entries(backlog)]) {
      const [t, s] = parseKey(k)
      const share = (bgShare[t] ??= [0, 0])
      share[isBg(t, s) ? 0 : 1] += p.count
    }
    const failSplit = (t: number, n: number) => {
      const [bg, fg] = bgShare[t] ?? [0, 1]
      const f = bg + fg > 0 ? bg / (bg + fg) : 0
      if (f > 0) fail(t, n * f, true)
      if (f < 1) fail(t, n * (1 - f))
    }
    for (const [t, n] of Object.entries(res.dropped)) failSplit(Number(t), n)
    // Rejections are deliberate: scrapers stopped is good, real users throttled is a violation.
    for (const [t, n] of Object.entries(res.rejected ?? {})) {
      if (!types[Number(t)]?.abusive) stats.throttled += n
      failSplit(Number(t), n)
    }
    stats.stale += res.stale
    for (const [k, v] of Object.entries(res.violations ?? {})) stats.violations[k] = (stats.violations[k] ?? 0) + v
    const droppedTotal = Object.values(res.dropped).reduce((s, n) => s + n, 0)

    const h = res.hitRate ?? hitRate(node)
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
        finishOrRoute(t, stepIdx, stepIdx + 1, hits, latencyMs)
        route(t, stepIdx, p.count - hits, latencyMs)
      } else {
        finishOrRoute(t, stepIdx, advance(node.kind, rt.needs, stepIdx), p.count, latencyMs)
      }
    }

    runtime[id] = { queue: res.queue, state: res.state ?? prevState }
    nodeStats[id] = {
      load: res.load,
      processedRps: Object.values(res.served).reduce((s, p) => s + p.count, 0) * TICKS_PER_SEC,
      droppedRps: droppedTotal * TICKS_PER_SEC,
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
    edgeTypes,
    window: [...state.window, stats].slice(-WINDOW_TICKS),
    totals: addStats(state.totals, stats),
  }
}
