import { describe, expect, it } from 'vitest'
import { percentile, summarize } from './scoring'
import { initSim, step, trafficRpsAt, withGraph } from './simulator'
import type { ComponentKind, Flow, Graph, Level, SimState } from './types'

function level(rps: number, mix: Flow = { read: 1, write: 0 }): Level {
  return {
    id: 'test',
    title: 'Test',
    description: '',
    budget: 1000,
    traffic: [{ t: 0, rps }],
    mix,
    goals: { uptime: 0.99, p95Ms: 300 },
    seed: 42,
  }
}

/** A straight chain: traffic → kinds[0] → kinds[1] … */
function chain(...nodes: [ComponentKind, number][]): Graph {
  const all: [ComponentKind, number][] = [['traffic', 1], ...nodes]
  return {
    nodes: all.map(([kind, instances], i) => ({ id: `n${i}`, kind, instances })),
    edges: all.slice(1).map((_, i) => ({ id: `e${i}`, source: `n${i}`, target: `n${i + 1}`, mode: 'sync' })),
  }
}

function run(state: SimState, ticks: number): SimState {
  for (let i = 0; i < ticks; i++) state = step(state)
  return state
}

describe('traffic source', () => {
  it('counts every request as an error when it has no outgoing wire', () => {
    const s = run(initSim(chain(), level(1000)), 10)
    expect(s.totals.emitted).toBeCloseTo(1000)
    expect(s.totals.errors).toBeCloseTo(1000)
    expect(s.totals.success).toBe(0)
  })

  it('interpolates traffic between points and holds the last value', () => {
    const l = { ...level(0), traffic: [{ t: 0, rps: 100 }, { t: 10, rps: 300 }] }
    expect(trafficRpsAt(l, 0)).toBe(100)
    expect(trafficRpsAt(l, 5)).toBe(200)
    expect(trafficRpsAt(l, 60)).toBe(300)
  })
})

describe('app server', () => {
  it('serves everything under capacity with no queue and no drops', () => {
    const s = run(initSim(chain(['app', 1]), level(400)), 20)
    expect(s.totals.errors).toBe(0)
    expect(s.totals.success).toBeCloseTo(s.totals.emitted)
    expect(s.nodeStats.n1!.queued).toBe(0)
    expect(s.nodeStats.n1!.load).toBeCloseTo(0.8)
  })

  it('queues up to 2× tick capacity, then drops the excess', () => {
    // 1000 rps into 500 rps capacity: 100 req/tick in, 50 served, backlog limit 100.
    // Run past the 50-tick window so it no longer holds the ticks before the backlog filled.
    const s = run(initSim(chain(['app', 1]), level(1000)), 80)
    const app = s.nodeStats.n1!
    expect(app.queued).toBeCloseTo(100)
    expect(app.processedRps).toBeCloseTo(500)
    expect(app.droppedRps).toBeCloseTo(500)
    expect(app.load).toBeCloseTo(2)
    expect(summarize(s.window).uptime).toBeCloseTo(0.5)
  })

  it('has no drops while the backlog is still filling', () => {
    // Backlog grows by 50/tick and holds 100, so the first two ticks only queue.
    const s = run(initSim(chain(['app', 1]), level(1000)), 2)
    expect(s.totals.errors).toBe(0)
    expect(s.nodeStats.n1!.queued).toBeCloseTo(100)
  })

  it('stops dropping when scaled out', () => {
    const s = run(initSim(chain(['app', 2]), level(1000)), 30)
    expect(s.totals.errors).toBe(0)
    expect(s.nodeStats.n1!.load).toBeCloseTo(1)
  })

  it('adds queue wait to latency when backlogged', () => {
    const calm = run(initSim(chain(['app', 2]), level(500)), 10)
    const busy = run(initSim(chain(['app', 1]), level(1000)), 30)
    expect(busy.nodeStats.n1!.latencyMs).toBeGreaterThan(calm.nodeStats.n1!.latencyMs + 100)
  })
})

describe('SQL database', () => {
  it('serves reads up to 120% load without dropping', () => {
    const s = run(initSim(chain(['sqldb', 1]), level(1200)), 10)
    expect(s.totals.errors).toBeCloseTo(0)
  })

  it('drops reads above 120% load', () => {
    // 1500 reads/s against 1000 capacity: serves 1200/s, drops 300/s, never queues.
    const s = run(initSim(chain(['sqldb', 1]), level(1500)), 10)
    const db = s.nodeStats.n1!
    expect(db.processedRps).toBeCloseTo(1200)
    expect(db.droppedRps).toBeCloseTo(300)
    expect(db.queued).toBe(0)
  })

  it('treats writes as 5× more expensive than reads', () => {
    // 100 writes/s = 50% of the 200 write capacity.
    const s = run(initSim(chain(['sqldb', 1]), level(100, { read: 0, write: 1 })), 1)
    expect(s.nodeStats.n1!.load).toBeCloseTo(0.5)
  })

  it('gets much slower as load rises past 80%', () => {
    const at = (rps: number) => run(initSim(chain(['sqldb', 1]), level(rps)), 1).nodeStats.n1!.latencyMs
    expect(at(400)).toBeLessThan(11)
    expect(at(1000)).toBeCloseTo(20)
    expect(at(1200)).toBeGreaterThan(30)
  })
})

describe('full M1 chain', () => {
  it('reports end-to-end latency through traffic → app → db', () => {
    const s = run(initSim(chain(['app', 2], ['sqldb', 1]), level(500, { read: 0.9, write: 0.1 })), 20)
    const m = summarize(s.window)
    expect(m.uptime).toBe(1)
    // app at 50% load ≈ 21.25 ms, db at 70% load ≈ 12.4 ms.
    expect(m.p50Ms).toBeGreaterThan(30)
    expect(m.p50Ms).toBeLessThan(40)
  })

  it('splits traffic evenly across multiple outgoing wires', () => {
    const g: Graph = {
      nodes: [
        { id: 'src', kind: 'traffic', instances: 1 },
        { id: 'a', kind: 'app', instances: 1 },
        { id: 'b', kind: 'app', instances: 1 },
      ],
      edges: [
        { id: 'ea', source: 'src', target: 'a', mode: 'sync' },
        { id: 'eb', source: 'src', target: 'b', mode: 'sync' },
      ],
    }
    const s = run(initSim(g, level(800)), 5)
    expect(s.edgeRps.ea).toBeCloseTo(400)
    expect(s.edgeRps.eb).toBeCloseTo(400)
    expect(s.totals.errors).toBe(0)
  })

  it('skips nodes on a cycle instead of looping forever', () => {
    const g = chain(['app', 1], ['app', 1])
    g.edges.push({ id: 'back', source: 'n2', target: 'n1', mode: 'sync' })
    const s = run(initSim(g, level(100)), 3)
    expect(s.order).toEqual(['n0'])
  })
})

describe('engine contract', () => {
  it('step() does not mutate its input', () => {
    const before = run(initSim(chain(['app', 1], ['sqldb', 1]), level(1000)), 5)
    const snapshot = structuredClone(before)
    step(before)
    expect(before).toEqual(snapshot)
  })

  it('is deterministic', () => {
    const a = run(initSim(chain(['app', 1], ['sqldb', 1]), level(900)), 40)
    const b = run(initSim(chain(['app', 1], ['sqldb', 1]), level(900)), 40)
    expect(a).toEqual(b)
  })

  it('keeps queues of surviving nodes when the graph is edited mid-run', () => {
    const s = run(initSim(chain(['app', 1]), level(1000)), 5)
    const g = chain(['app', 3])
    const edited = withGraph(s, g)
    expect(edited.runtime.n1!.queue.read).toBeCloseTo(100)
    const next = step(edited)
    // 3 instances = 150 req/tick capacity: drains the backlog right away.
    expect(next.nodeStats.n1!.queued).toBeCloseTo(50)
  })
})

describe('percentile', () => {
  it('returns 0 for an empty histogram', () => {
    expect(percentile([0, 0, 0], 0.95)).toBe(0)
  })
})
