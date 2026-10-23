import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, nodeCostPerMin } from './components'
import { diagnose, percentile, summarize } from './scoring'
import { initSim, step, trafficRpsAt, withGraph } from './simulator'
import { graph, run } from './test-helpers'
import type { Chapter, NodeConfig } from './types'

const testChapter = (rps: number, mix: Record<string, number>, events: Chapter['stages'][number]['events'] = []): Chapter => ({
  id: 'test',
  title: 'Test',
  seed: 42,
  requestTypes: [
    { id: 'page', label: 'Page', needs: ['compute', 'lookup'], weight: 1, consistency: 'any', distanceMs: 0 },
    { id: 'write', label: 'Write', needs: ['compute', 'write'], weight: 1, consistency: 'any', distanceMs: 0 },
    { id: 'ryw', label: 'Own', needs: ['compute', 'lookup'], weight: 1, consistency: 'ryw', distanceMs: 0 },
    { id: 'static', label: 'Static', needs: ['static'], weight: 2, consistency: 'any', distanceMs: 250 },
  ],
  stages: [
    {
      id: 's',
      title: 'S',
      story: '',
      durationS: 60,
      traffic: [{ t: 0, rps }],
      mix,
      unlocks: { kinds: [], settings: [] },
      events,
      budget: 1000,
      referenceCost: 100,
      goals: { uptime: 0.99, p95Ms: 200, maxStaleRate: 0.001 },
    },
  ],
})

const PAGES = { page: 1 }

describe('capability routing', () => {
  it('completes page views through web server → database', () => {
    const g = graph([['u', 'traffic'], ['web', 'app'], ['db', 'sqldb']], ['u>web', 'web>db'])
    const s = run(initSim(g, testChapter(300, PAGES), 0), 20)
    expect(s.totals.errors).toBe(0)
    expect(s.totals.success).toBeCloseTo(s.totals.emitted)
  })

  it('dead-ends page views at a web server with no database', () => {
    const g = graph([['u', 'traffic'], ['web', 'app']], ['u>web'])
    const s0 = initSim(g, testChapter(300, PAGES), 0)
    // Static check: the users node can't complete a page view at all, so it isn't routed.
    expect(s0.reach.u![0]![0]).toBe(false)
    const s = run(s0, 10)
    expect(s.totals.deadEnds).toBeCloseTo(s.totals.emitted)
    expect(s.totals.success).toBe(0)
  })

  it('lets one single server do everything', () => {
    const g = graph([['u', 'traffic'], ['box', 'allinone']], ['u>box'])
    const s = run(initSim(g, testChapter(100, { page: 0.5, write: 0.3, static: 0.2 }), 0), 20)
    expect(s.totals.errors).toBe(0)
  })

  it('passes requests a node cannot serve through to one that can', () => {
    // Writes go through the cache untouched and land on the database.
    const g = graph([['u', 'traffic'], ['web', 'app'], ['c', 'cache'], ['db', 'sqldb']], ['u>web', 'web>c', 'c>db'])
    const s = run(initSim(g, testChapter(100, { write: 1 }), 0), 10)
    expect(s.totals.errors).toBe(0)
    expect(s.edgeRps['c>db']).toBeCloseTo(100)
  })

  it('routes only along wires that can finish the request', () => {
    // Static files go to the server that can serve them, not the database.
    const g = graph([['u', 'traffic'], ['web', 'app'], ['db', 'sqldb']], ['u>web', 'u>db', 'web>db'])
    const s = run(initSim(g, testChapter(100, { static: 1 }), 0), 5)
    expect(s.edgeRps['u>web']).toBeCloseTo(100)
    expect(s.edgeRps['u>db']).toBeUndefined()
  })
})

describe('load balancer and instances', () => {
  it('reaches only one instance without a load balancer', () => {
    const g = graph([['u', 'traffic'], ['web', 'app', 3], ['db', 'sqldb', 1, { tier: 2 }]], ['u>web', 'web>db'])
    const s = run(initSim(g, testChapter(1000, PAGES), 0), 30)
    expect(s.nodeStats.web!.load).toBeCloseTo(2)
    expect(s.totals.errors).toBeGreaterThan(0)
  })

  it('spreads load across all instances behind a load balancer', () => {
    const g = graph([['u', 'traffic'], ['lb', 'lb'], ['web', 'app', 3], ['db', 'sqldb', 1, { tier: 2 }]], ['u>lb', 'lb>web', 'web>db'])
    const s = run(initSim(g, testChapter(1000, PAGES), 0), 30)
    expect(s.nodeStats.web!.load).toBeCloseTo(2 / 3)
    expect(s.totals.errors).toBe(0)
  })

  it('takes a single web server fully down during a crash', () => {
    const ch = testChapter(300, PAGES, [{ t: 1, durationS: 1, kind: 'crash', target: 'app' }])
    const g = graph([['u', 'traffic'], ['web', 'app'], ['db', 'sqldb']], ['u>web', 'web>db'])
    // Ticks 10–19 are the crash window (1 s–2 s); tick 24 is after it.
    const s = run(initSim(g, ch, 0), 25)
    expect(s.nodeStats.web!.down).toBe(false)
    expect(run(initSim(g, ch, 0), 12).nodeStats.web!.down).toBe(true)
    expect(s.totals.errors).toBeGreaterThan(0)
  })

  it('survives a crash with spare instances behind a load balancer', () => {
    const ch = testChapter(700, PAGES, [{ t: 1, durationS: 1, kind: 'crash', target: 'app' }])
    const g = graph([['u', 'traffic'], ['lb', 'lb'], ['web', 'app', 3], ['db', 'sqldb', 1, { tier: 1 }]], ['u>lb', 'lb>web', 'web>db'])
    const s = run(initSim(g, ch, 0), 30)
    expect(s.totals.errors).toBe(0)
  })
})

describe('tiers', () => {
  it('doubles capacity per tier while cost rises faster', () => {
    const g = (tier: 0 | 1) => graph([['u', 'traffic'], ['web', 'app', 1, { tier }], ['db', 'sqldb', 1, { tier: 2 }]], ['u>web', 'web>db'])
    expect(run(initSim(g(0), testChapter(800, PAGES), 0), 5).nodeStats.web!.load).toBeCloseTo(1.6)
    expect(run(initSim(g(1), testChapter(800, PAGES), 0), 5).nodeStats.web!.load).toBeCloseTo(0.8)
    const web = (tier: 0 | 1 | 3) => nodeCostPerMin({ id: 'w', kind: 'app', instances: 1, config: { ...DEFAULT_CONFIG, tier } })
    expect(web(1)).toBe(22)
    expect(web(3)).toBe(120)
  })
})

describe('database replicas', () => {
  const dbGraph = (config: Partial<NodeConfig>) =>
    graph([['u', 'traffic'], ['lb', 'lb'], ['web', 'app', 10], ['db', 'sqldb', 1, config]], ['u>lb', 'lb>web', 'web>db'])

  it('drops reads above 120% of one primary', () => {
    const s = run(initSim(dbGraph({}), testChapter(2000, PAGES), 0), 10)
    expect(s.nodeStats.db!.load).toBeCloseTo(2)
    expect(s.nodeStats.db!.droppedRps).toBeCloseTo(800)
  })

  it('spreads reads across replicas', () => {
    const s = run(initSim(dbGraph({ replicas: 3, readRouting: 'replicas' }), testChapter(2000, PAGES), 0), 10)
    expect(s.nodeStats.db!.load).toBeCloseTo(0.5)
    expect(s.totals.errors).toBe(0)
  })

  it('serves stale answers when own-post reads hit lagging replicas', () => {
    const s = run(initSim(dbGraph({ replicas: 1, readRouting: 'replicas' }), testChapter(400, { ryw: 1 }), 0), 10)
    expect(s.totals.stale / s.totals.success).toBeCloseTo(0.5)
  })

  it('keeps own-post reads on the primary with read-your-writes routing', () => {
    const s = run(initSim(dbGraph({ replicas: 2, readRouting: 'ryw' }), testChapter(1000, { ryw: 0.2, page: 0.8 }), 0), 10)
    expect(s.totals.stale).toBe(0)
    // 800 page reads over 2 replicas; 200 own-post reads on the primary.
    expect(s.nodeStats.db!.load).toBeCloseTo(0.4)
  })

  it('charges for replicas and tiers', () => {
    const db = (config: Partial<NodeConfig>) => nodeCostPerMin({ id: 'd', kind: 'sqldb', instances: 1, config: { ...DEFAULT_CONFIG, ...config } })
    expect(db({})).toBe(40)
    expect(db({ replicas: 2 })).toBe(100)
    expect(db({ replicas: 2, tier: 1 })).toBe(220)
  })
})

describe('cache', () => {
  const cacheGraph = (config: Partial<NodeConfig>) =>
    graph([['u', 'traffic'], ['web', 'app', 1, { tier: 2 }], ['c', 'cache', 1, config], ['db', 'sqldb']], ['u>web', 'web>c', 'c>db'])

  it('answers the hit fraction and sends misses to the database', () => {
    const s = run(initSim(cacheGraph({ cacheSize: 'M' }), testChapter(1000, PAGES), 0), 10)
    expect(s.edgeRps['c>db']).toBeCloseTo(150)
    expect(s.totals.errors).toBe(0)
  })

  it('dead-ends misses without a database behind it', () => {
    const g = graph([['u', 'traffic'], ['web', 'app'], ['c', 'cache']], ['u>web', 'web>c'])
    expect(initSim(g, testChapter(100, PAGES), 0).reach.u![0]![0]).toBe(false)
  })

  it('serves stale own-post reads with cache-aside, not with write-through', () => {
    const aside = run(initSim(cacheGraph({ writeStrategy: 'aside' }), testChapter(200, { ryw: 1 }), 0), 10)
    const through = run(initSim(cacheGraph({ writeStrategy: 'through' }), testChapter(200, { ryw: 1 }), 0), 10)
    expect(aside.totals.stale / aside.totals.success).toBeCloseTo(0.85)
    expect(through.totals.stale).toBe(0)
  })
})

describe('CDN', () => {
  it('serves static hits at the edge, without the distance penalty', () => {
    const g = graph([['u', 'traffic'], ['cdn', 'cdn'], ['web', 'app', 1, { tier: 1 }]], ['u>cdn', 'cdn>web'])
    const s = run(initSim(g, testChapter(1000, { static: 1 }), 0), 20)
    expect(s.edgeRps['cdn>web']).toBeCloseTo(50)
    expect(summarize(s.window).p50Ms).toBeLessThan(20)
  })

  it('passes dynamic requests through to the servers behind it', () => {
    const g = graph([['u', 'traffic'], ['cdn', 'cdn'], ['web', 'app'], ['db', 'sqldb']], ['u>cdn', 'cdn>web', 'web>db'])
    const s = run(initSim(g, testChapter(200, PAGES), 0), 10)
    expect(s.totals.errors).toBe(0)
    expect(s.edgeRps['cdn>web']).toBeCloseTo(200)
  })

  it('acts like a separate static hostname when wired beside the load balancer', () => {
    // Static URLs go only to the CDN; dynamic requests skip it; misses are pulled from its origin.
    const g = graph(
      [['u', 'traffic'], ['cdn', 'cdn'], ['lb', 'lb'], ['web', 'app', 4], ['db', 'sqldb']],
      ['u>cdn', 'u>lb', 'cdn>web', 'lb>web', 'web>db'],
    )
    const s = run(initSim(g, testChapter(1000, { static: 0.5, page: 0.5 }), 0), 10)
    expect(s.edgeRps['u>cdn']).toBeCloseTo(500)
    expect(s.edgeRps['u>lb']).toBeCloseTo(500)
    expect(s.edgeRps['cdn>web']).toBeCloseTo(25)
    expect(s.totals.errors).toBe(0)
  })

  it('tracks each wire’s traffic by request type', () => {
    // Static goes only to the CDN; page views skip it; CDN misses reach the web server.
    const g = graph(
      [['u', 'traffic'], ['cdn', 'cdn'], ['lb', 'lb'], ['web', 'app', 4], ['db', 'sqldb']],
      ['u>cdn', 'u>lb', 'cdn>web', 'lb>web', 'web>db'],
    )
    const s = run(initSim(g, testChapter(1000, { static: 0.5, page: 0.5 }), 0), 10)
    const PAGE = 0
    const STATIC = 3
    expect(s.edgeTypes['u>cdn']![STATIC]).toBeCloseTo(500)
    expect(s.edgeTypes['u>cdn']![PAGE]).toBeUndefined()
    expect(s.edgeTypes['u>lb']![PAGE]).toBeCloseTo(500)
    expect(s.edgeTypes['cdn>web']![STATIC]).toBeCloseTo(25)
  })

  it('adds the distance penalty to static files served from the origin', () => {
    const g = graph([['u', 'traffic'], ['web', 'app', 1, { tier: 1 }]], ['u>web'])
    const s = run(initSim(g, testChapter(100, { static: 1 }), 0), 10)
    expect(summarize(s.window).p50Ms).toBeGreaterThan(250)
  })
})

describe('diagnosis', () => {
  it('names a saturated database as storage-bound', () => {
    const g = graph([['u', 'traffic'], ['lb', 'lb'], ['web', 'app', 10], ['db', 'sqldb']], ['u>lb', 'lb>web', 'web>db'])
    const d = diagnose(run(initSim(g, testChapter(2000, PAGES), 0), 5))
    expect(d?.bound).toBe('storage')
    expect(d?.nodeId).toBe('db')
  })

  it('names a web server busy with static files as network-bound', () => {
    const g = graph([['u', 'traffic'], ['web', 'app']], ['u>web'])
    expect(diagnose(run(initSim(g, testChapter(300, { static: 1 }), 0), 5))?.bound).toBe('network')
  })

  it('reports nothing when every node is comfortable', () => {
    const g = graph([['u', 'traffic'], ['web', 'app'], ['db', 'sqldb']], ['u>web', 'web>db'])
    expect(diagnose(run(initSim(g, testChapter(100, PAGES), 0), 5))).toBeNull()
  })
})

describe('engine contract', () => {
  const g = graph([['u', 'traffic'], ['lb', 'lb'], ['web', 'app', 2], ['c', 'cache'], ['db', 'sqldb', 1, { replicas: 1, readRouting: 'ryw' }]], ['u>lb', 'lb>web', 'web>c', 'c>db'])
  const ch = testChapter(1500, { page: 0.7, ryw: 0.2, write: 0.1 })

  it('step() does not mutate its input', () => {
    const before = run(initSim(g, ch, 0), 5)
    const snapshot = structuredClone(before)
    step(before)
    expect(before).toEqual(snapshot)
  })

  it('is deterministic', () => {
    expect(run(initSim(g, ch, 0), 40)).toEqual(run(initSim(g, ch, 0), 40))
  })

  it('keeps backlogs of surviving nodes when the graph is edited mid-run', () => {
    const small = graph([['u', 'traffic'], ['web', 'app'], ['db', 'sqldb', 1, { tier: 2 }]], ['u>web', 'web>db'])
    const s = run(initSim(small, testChapter(1000, PAGES), 0), 5)
    expect(Object.values(s.runtime.web!.queue)[0]?.count).toBeCloseTo(100)
    const edited = withGraph(s, graph([['u', 'traffic'], ['web', 'app', 1, { tier: 1 }], ['db', 'sqldb', 1, { tier: 2 }]], ['u>web', 'web>db']))
    expect(Object.values(edited.runtime.web!.queue)[0]?.count).toBeCloseTo(100)
  })

  it('interpolates traffic and holds the last value', () => {
    const stage = { ...ch.stages[0]!, traffic: [{ t: 0, rps: 100 }, { t: 10, rps: 300 }] }
    expect(trafficRpsAt(stage, 5)).toBe(200)
    expect(trafficRpsAt(stage, 60)).toBe(300)
  })

  it('returns 0 for an empty latency histogram', () => {
    expect(percentile([0, 0, 0], 0.95)).toBe(0)
  })
})
