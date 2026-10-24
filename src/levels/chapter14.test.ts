import { describe, expect, it } from 'vitest'
import { changedPieces, reviewDesign } from '../engine/interview'
import { initSim } from '../engine/simulator'
import type { BlobDurability, CdnTtl } from '../engine/types'
import { chapter14 } from './chapter14'
import { blockers, graph, playJudged, type N } from './test-suite'

const ch = chapter14.chapter
const wires = ['u>cdn', 'cdn>tr', 'u>lb', 'lb>api', 'api>orig', 'orig>q', 'q>w', 'w>tr']
const design = (orig = 5, tr = 5, workers = 10, dur: BlobDurability = 'erasure', ttl: CdnTtl = 'long', apps = 2): N[] => [
  ['u', 'traffic'],
  ['cdn', 'cdn', 1, { cdnTtl: ttl }],
  ['tr', 'blob', tr, { blobDurability: dur }],
  ['lb', 'lb'],
  ['api', 'app', apps],
  ['orig', 'blob', orig, { blobDurability: dur }],
  ['q', 'queue'],
  ['w', 'worker', workers],
]
const play = (stage: number, nodes: N[], w = wires) => playJudged(ch, stage, nodes, w)
const missed = (stage: number, nodes: N[]) => play(stage, nodes).missed.join(' ')

describe('Chapter 14 main run', () => {
  it('a CDN, erasure-coded stores and ten transcoders earn three stars', () => {
    const r = play(0, design())
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
    expect(r.cost).toBe(ch.stages[0]!.referenceCost)
  })
  it('one copy loses videos when a disk dies', () => expect(missed(0, design(3, 3, 10, 'single'))).toMatch(/lost videos for good/))
  it('three copies of everything blow the budget', () => expect(play(0, design(9, 9, 10, 'replicas')).stars).toBeLessThan(2))
  it('a short CDN TTL sends too many chunks to storage', () => expect(play(0, design(5, 5, 10, 'erasure', 'short')).stars).toBe(0))
  it('too few transcoders fall behind', () => expect(missed(0, design(5, 5, 6))).toMatch(/Background work took|never transcoded/))
})

describe('Chapter 14 curveball', () => {
  it('the festival upload spike overwhelms the transcoders', () => expect(missed(1, design())).toMatch(/Background work took|never transcoded/))

  it('more transcoders fix it in one change', () => {
    const fixed = design(5, 5, 18)
    expect(changedPieces(graph(design(), wires), graph(fixed, wires))).toBeLessThanOrEqual(chapter14.editBudget)
    const r = play(1, fixed)
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
  })

  it('the interviewer flags single-copy storage', () => {
    const notes = reviewDesign(initSim(graph(design(3, 3, 10, 'single'), wires), ch, 0), chapter14, [])
    expect(notes.map((n) => n.text).join('\n')).toMatch(/loses data permanently/)
  })
})

describe('Chapter 14 rules', () => {
  it('the reference designs are legal', () => {
    expect(blockers(ch, 0, design(), wires)).toEqual([])
    expect(blockers(ch, 1, design(5, 5, 18), wires)).toEqual([])
  })
  it('blocks streaming without a CDN', () => {
    const nodes = design().filter(([id]) => id !== 'cdn')
    expect(blockers(ch, 0, nodes, ['u>tr', 'u>lb', 'lb>api', 'api>orig', 'orig>q', 'q>w', 'w>tr']).join(' ')).toMatch(/put a CDN in front/)
  })
  it('blocks uploads that are never transcoded', () =>
    expect(blockers(ch, 0, design(), ['u>cdn', 'cdn>tr', 'u>lb', 'lb>api', 'api>orig', 'q>w', 'w>tr']).join(' ')).toMatch(/Nothing in your design can serve "Upload chunk"|isn't on any request's path/))
})
