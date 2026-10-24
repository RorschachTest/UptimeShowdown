import { describe, expect, it } from 'vitest'
import { changedPieces } from '../engine/interview'
import type { CdnTtl } from '../engine/types'
import { blockers, graph, playJudged, type N } from './test-suite'
import { v2chapter3 } from './v2chapter3'

const ch = v2chapter3.chapter
const wires = ['u>cdn', 'cdn>tiles', 'u>lb', 'lb>route', 'route>c', 'c>g', 'u>q', 'q>w', 'w>h']
const design = (apps = 7, workers = 4, history = 2, ttl: CdnTtl = 'long'): N[] => [
  ['u', 'traffic'],
  ['cdn', 'cdn', 1, { cdnTtl: ttl }],
  ['tiles', 'blob', 2, { blobDurability: 'erasure' }],
  ['lb', 'lb'],
  ['route', 'app', apps],
  ['c', 'cache'],
  ['g', 'kvstore', 3, { kvCopies: 3, kvWrite: 'quorum', kvRead: 'quorum', kvConflict: 'lww' }],
  ['q', 'queue'],
  ['w', 'worker', workers],
  ['h', 'tsdb', history, { tsEngine: 'timeseries', tsRetention: 'downsample' }],
]
const play = (stage: number, nodes: N[], w = wires) => playJudged(ch, stage, nodes, w)
const missed = (stage: number, nodes: N[]) => play(stage, nodes).missed.join(' ')

describe('V2 Chapter 3 main run', () => {
  it('a tile CDN, seven routing servers and four traffic updaters earn three stars', () => {
    const r = play(0, design())
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
    expect(r.cost).toBe(ch.stages[0]!.referenceCost)
  })
  it('one history node loses location updates when it crashes', () => expect(missed(0, design(7, 4, 1))).toMatch(/location updates were lost/))
  it('three traffic updaters fall behind', () => expect(missed(0, design(7, 3))).toMatch(/Background work took/))
  it('a short CDN TTL sends worldwide tile traffic home', () => expect(play(0, design(7, 4, 2, 'short')).stars).toBeLessThan(3))
})

describe('V2 Chapter 3 curveball', () => {
  it('the holiday rush overwhelms the main design', () => expect(play(1, design()).stars).toBe(0))

  it('more routing servers and traffic updaters fix it in two changes', () => {
    const fixed = design(22, 11)
    expect(changedPieces(graph(design(), wires), graph(fixed, wires))).toBeLessThanOrEqual(v2chapter3.editBudget)
    const r = play(1, fixed)
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
  })

  it('more updaters alone leave routes failing', () => expect(play(1, design(7, 12)).metrics.uptime).toBeLessThan(0.99))
})

describe('V2 Chapter 3 rules', () => {
  it('the reference designs are legal', () => {
    expect(blockers(ch, 0, design(), wires)).toEqual([])
    expect(blockers(ch, 1, design(22, 11), wires)).toEqual([])
  })
  it('blocks tiles without a CDN', () => expect(blockers(ch, 0, design().filter(([id]) => id !== 'cdn'), ['u>tiles', ...wires.slice(2)]).join(' ')).toMatch(/CDN near them/))
})
