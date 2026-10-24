import { describe, expect, it } from 'vitest'
import type { CacheSize, Tier } from '../engine/types'
import { chapter16 } from './chapter16'
import { blockers, playJudged, type N } from './test-suite'

const wires = ['u>cdn', 'cdn>lb', 'lb>web', 'web>c', 'c>kv', 'web>q', 'q>w']
const KV = { kvCopies: 3, kvWrite: 'quorum', kvRead: 'quorum', kvConflict: 'vclock' } as const
const design = (apps: number, appTier: Tier, cacheNodes: number, size: CacheSize, kv: number, workers: number): N[] => [
  ['u', 'traffic'],
  ['cdn', 'cdn'],
  ['lb', 'lb'],
  ['web', 'app', apps, { tier: appTier }],
  ['c', 'cache', cacheNodes, { cacheSize: size, cacheHashing: 'vnodes' }],
  ['kv', 'kvstore', kv, KV],
  ['q', 'queue'],
  ['w', 'worker', workers],
]
const REFERENCE: [stage: number, nodes: N[]][] = [
  [0, design(5, 0, 1, 'S', 3, 1)],
  [1, design(24, 0, 2, 'M', 4, 2)],
  [2, design(10, 3, 4, 'M', 12, 6)],
]

describe('Chapter 16: the grand tour', () => {
  for (const [stage, nodes] of REFERENCE) {
    it(`stage ${stage + 1} reference earns three stars at the reference cost`, () => {
      const r = playJudged(chapter16, stage, nodes, wires)
      expect(r.missed).toEqual([])
      expect(r.stars).toBe(3)
      expect(r.cost).toBe(chapter16.stages[stage]!.referenceCost)
      expect(blockers(chapter16, stage, nodes, wires)).toEqual([])
    })
  }

  it('one cache node takes every read down with it when it crashes', () =>
    expect(playJudged(chapter16, 1, design(24, 0, 1, 'M', 4, 2), wires).metrics.uptime).toBeLessThan(0.99))

  it('one big SQL primary can take growth-stage writes, but only by blowing the budget', () => {
    const nodes: N[] = [...design(24, 0, 2, 'M', 4, 2).filter(([id]) => id !== 'kv'), ['db', 'sqldb', 1, { tier: 3 }]]
    expect(playJudged(chapter16, 1, nodes, wires.map((w) => w.replace('kv', 'db'))).stars).toBeLessThan(2)
  })

  it('four servers have no room for a crash at launch', () => expect(playJudged(chapter16, 0, design(4, 0, 1, 'S', 3, 1), wires).stars).toBe(0))

  it('pieces from specialised chapters stay locked', () =>
    expect(blockers(chapter16, 0, [...design(5, 0, 1, 'S', 3, 1), ['g', 'idgen']], [...wires, 'web>g']).join(' ')).toMatch(/ID Generator isn't available/))
})
