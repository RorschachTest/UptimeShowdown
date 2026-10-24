import { describe, expect, it } from 'vitest'
import { changedPieces, reviewDesign } from '../engine/interview'
import { initSim } from '../engine/simulator'
import type { CacheHashing, CacheSize } from '../engine/types'
import { chapter5 } from './chapter5'
import { blockers, graph, playJudged, type N } from './test-suite'

const ch = chapter5.chapter
const cluster = (nodes: number, cacheSize: CacheSize, cacheHashing: CacheHashing): N[] => [
  ['u', 'traffic'],
  ['c', 'cache', nodes, { cacheSize, cacheHashing }],
  ['db', 'sqldb', 1, { tier: 2 }],
]
const wires = ['u>c', 'c>db']
const play = (stage: number, nodes: N[], w = wires) => playJudged(ch, stage, nodes, w)

describe('Chapter 5 main run', () => {
  it('nine small nodes on a ring with virtual nodes earn three stars at the reference cost', () => {
    const r = play(0, cluster(9, 'S', 'vnodes'))
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
    expect(r.cost).toBe(ch.stages[0]!.referenceCost)
  })

  it('key mod N: losing one node remaps almost every key and the misses flatten the database', () => {
    const r = play(0, cluster(9, 'S', 'mod'))
    expect(r.stars).toBe(0)
    expect(r.metrics.uptime).toBeLessThan(0.99)
  })

  it('a plain ring without spare nodes is too lumpy to hold the data', () => {
    expect(play(0, cluster(9, 'S', 'ring')).stars).toBe(0)
  })

  it('two big nodes: losing one loses half the cache, whatever the hashing', () => {
    expect(play(0, cluster(2, 'L', 'vnodes')).stars).toBe(0)
  })

  it('one cache node cannot hold 120 GB', () => {
    expect(play(0, cluster(1, 'L', 'mod')).stars).toBe(0)
  })
})

describe('Chapter 5 curveball', () => {
  it('the main design runs out of memory at season launch', () => {
    expect(play(1, cluster(9, 'S', 'vnodes')).stars).toBe(0)
  })

  it('seven medium nodes fix it with one change', () => {
    const before = graph(cluster(9, 'S', 'vnodes'), wires)
    const after = graph(cluster(7, 'M', 'vnodes'), wires)
    expect(changedPieces(before, after)).toBeLessThanOrEqual(chapter5.editBudget)
    const r = play(1, cluster(7, 'M', 'vnodes'))
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
  })

  it('key mod N still stampedes when a node is added', () => {
    expect(play(1, cluster(10, 'M', 'mod')).stars).toBe(0)
  })

  it('the interviewer flags key mod N on a cluster', () => {
    const notes = reviewDesign(initSim(graph(cluster(9, 'S', 'mod'), wires), ch, 0), chapter5, [])
    expect(notes.map((n) => n.text).join('\n')).toMatch(/almost every key moves/)
  })
})

describe('Chapter 5 rules', () => {
  it('the reference designs are legal', () => {
    expect(blockers(ch, 0, cluster(9, 'S', 'vnodes'), wires)).toEqual([])
    expect(blockers(ch, 1, cluster(7, 'M', 'vnodes'), wires)).toEqual([])
  })

  it('blocks a design with no cache', () => {
    expect(blockers(ch, 0, [['u', 'traffic'], ['db', 'sqldb', 1, { tier: 3 }]], ['u>db']).join(' ')).toMatch(/must be served from a cache/)
  })

  it('blocks a side wire that skips the cache', () => {
    expect(blockers(ch, 0, cluster(9, 'S', 'vnodes'), [...wires, 'u>db']).join(' ')).toMatch(/must ask the cache first\. Right now Profile read can go around it/)
  })

  it('blocks pieces this chapter has not unlocked', () => {
    const nodes: N[] = [...cluster(9, 'S', 'vnodes'), ['lb', 'lb']]
    expect(blockers(ch, 0, nodes, ['u>lb', 'lb>c', 'c>db']).join(' ')).toMatch(/Load Balancer isn't available/)
  })

  it('blocks a second cache nobody reads from', () => {
    const nodes: N[] = [...cluster(9, 'S', 'vnodes'), ['c2', 'cache']]
    expect(blockers(ch, 0, nodes, wires).join(' ')).toMatch(/isn't on any request's path/)
  })
})
