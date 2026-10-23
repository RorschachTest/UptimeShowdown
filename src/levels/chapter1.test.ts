import { describe, expect, it } from 'vitest'
import { stageResult } from '../engine/scoring'
import { initSim, TICKS_PER_SEC } from '../engine/simulator'
import { graph, run, type N } from '../engine/test-helpers'
import { chapter1 } from './chapter1'

/** Play a whole stage with a design and score it. */
function play(stageIndex: number, nodes: N[], wires: string[]) {
  const stage = chapter1.stages[stageIndex]!
  const s = run(initSim(graph(nodes, wires), chapter1, stageIndex), stage.durationS * TICKS_PER_SEC)
  return stageResult(s)
}

const through = { writeStrategy: 'through' } as const

// Known-good designs: each must earn ★★★, which also proves the stage is winnable.
const reference: [N[], string[]][] = [
  [[['u', 'traffic'], ['box', 'allinone']], ['u>box']],
  [[['u', 'traffic'], ['web', 'app'], ['db', 'sqldb']], ['u>web', 'web>db']],
  [[['u', 'traffic'], ['lb', 'lb'], ['web', 'app', 3], ['db', 'sqldb']], ['u>lb', 'lb>web', 'web>db']],
  [
    [['u', 'traffic'], ['lb', 'lb'], ['web', 'app', 7], ['c', 'cache', 1, through], ['db', 'sqldb']],
    ['u>lb', 'lb>web', 'web>c', 'c>db'],
  ],
  [
    [['u', 'traffic'], ['cdn', 'cdn'], ['lb', 'lb'], ['web', 'app', 7], ['c', 'cache', 1, through], ['db', 'sqldb']],
    ['u>cdn', 'cdn>lb', 'lb>web', 'web>c', 'c>db'],
  ],
]

describe('Chapter 1 reference designs', () => {
  reference.forEach(([nodes, wires], i) => {
    it(`stage ${i + 1} (${chapter1.stages[i]!.title}) earns three stars at the reference cost`, () => {
      const r = play(i, nodes, wires)
      expect(r.missed).toEqual([])
      expect(r.stars).toBe(3)
      expect(r.cost).toBe(chapter1.stages[i]!.referenceCost)
    })
  })
})

describe('Chapter 1 traps fail the stage', () => {
  it('stage 2: one single server can no longer keep up', () => {
    expect(play(1, ...reference[0]!).stars).toBe(0)
  })

  it('stage 3: a bigger single server dies with the crash', () => {
    const r = play(2, [['u', 'traffic'], ['web', 'app', 1, { tier: 1 }], ['db', 'sqldb']], ['u>web', 'web>db'])
    expect(r.stars).toBe(0)
  })

  it('stage 3: two servers are not enough to lose one', () => {
    const r = play(2, [['u', 'traffic'], ['lb', 'lb'], ['web', 'app', 2], ['db', 'sqldb']], ['u>lb', 'lb>web', 'web>db'])
    expect(r.stars).toBe(0)
  })

  it('stage 3: extra servers without a load balancer do nothing', () => {
    const r = play(2, [['u', 'traffic'], ['web', 'app', 3], ['db', 'sqldb']], ['u>web', 'web>db'])
    expect(r.stars).toBe(0)
  })

  it('stage 4: the stage 3 design is overwhelmed by reads', () => {
    expect(play(3, ...reference[2]!).stars).toBe(0)
  })

  it('stage 4: a cache-aside cache serves people stale copies of their own posts', () => {
    const r = play(3, [['u', 'traffic'], ['lb', 'lb'], ['web', 'app', 7], ['c', 'cache'], ['db', 'sqldb']], ['u>lb', 'lb>web', 'web>c', 'c>db'])
    expect(r.stars).toBe(0)
    expect(r.missed.join(' ')).toMatch(/stale/)
  })

  it('stage 4: replicas with read-your-writes routing also work', () => {
    const r = play(
      3,
      [['u', 'traffic'], ['lb', 'lb'], ['web', 'app', 7], ['db', 'sqldb', 1, { replicas: 3, readRouting: 'ryw' }]],
      ['u>lb', 'lb>web', 'web>db'],
    )
    expect(r.stars).toBeGreaterThanOrEqual(2)
  })

  it('stage 5: without a CDN, distant users wait too long for images', () => {
    const r = play(
      4,
      [['u', 'traffic'], ['lb', 'lb'], ['web', 'app', 20], ['c', 'cache', 1, through], ['db', 'sqldb']],
      ['u>lb', 'lb>web', 'web>c', 'c>db'],
    )
    expect(r.stars).toBe(0)
    expect(r.missed.join(' ')).toMatch(/p95/)
  })

  it('stage 5: a short-TTL CDN misses too often', () => {
    const [nodes, wires] = reference[4]!
    const short = nodes.map((n) => (n[1] === 'cdn' ? (['cdn', 'cdn', 1, { cdnTtl: 'short' }] as N) : n))
    expect(play(4, short, wires).stars).toBe(0)
  })

  it('over-building costs the third star', () => {
    const r = play(1, [['u', 'traffic'], ['web', 'app'], ['db', 'sqldb', 1, { replicas: 1 }]], ['u>web', 'web>db'])
    expect(r.stars).toBeLessThan(3)
  })
})
