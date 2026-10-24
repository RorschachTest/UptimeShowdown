import { describe, expect, it } from 'vitest'
import { changedPieces, reviewDesign } from '../engine/interview'
import { initSim } from '../engine/simulator'
import type { BlobDurability, NodeConfig } from '../engine/types'
import { chapter15 } from './chapter15'
import { blockers, graph, playJudged, type N } from './test-suite'

const ch = chapter15.chapter
const wires = ['u>lb', 'lb>bs', 'bs>blob', 'lb>api', 'api>db']
const delta = { blockDelta: true, blockCompress: false }
const design = (bs = 5, blob = 5, bsc: Partial<NodeConfig> = delta, db: Partial<NodeConfig> = { tier: 1 }, dur: BlobDurability = 'erasure'): N[] => [
  ['u', 'traffic'],
  ['lb', 'lb'],
  ['bs', 'blocksrv', bs, bsc],
  ['blob', 'blob', blob, { blobDurability: dur }],
  ['api', 'app', 3],
  ['db', 'sqldb', 1, db],
]
const play = (stage: number, nodes: N[], w = wires) => playJudged(ch, stage, nodes, w)

describe('Chapter 15 main run', () => {
  it('delta sync, erasure-coded block storage and a strongly consistent metadata DB earn three stars', () => {
    const r = play(0, design())
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
    expect(r.cost).toBe(ch.stages[0]!.referenceCost)
  })
  it('compression trades block-server CPU for fewer storage nodes', () => expect(play(0, design(7, 4, { blockDelta: true, blockCompress: true })).stars).toBe(3))
  it('uploading whole files needs four times the storage bandwidth', () => expect(play(0, design(5, 20, { blockDelta: false })).stars).toBeLessThan(2))
  it('reading folder listings from replicas shows stale versions', () =>
    expect(play(0, design(5, 5, delta, { tier: 1, replicas: 2, readRouting: 'replicas' })).missed.join(' ')).toMatch(/stale/))
  it('one copy loses files when a node dies', () => expect(play(0, design(5, 5, delta, { tier: 1 }, 'single')).missed.join(' ')).toMatch(/lost files for good/))
  it('four storage nodes have no room for a failure', () => expect(play(0, design(5, 4)).stars).toBe(0))
})

describe('Chapter 15 curveball', () => {
  it('term start overwhelms the main design', () => expect(play(1, design()).stars).toBe(0))

  it('more block servers and storage nodes fix it in two changes', () => {
    const fixed = design(14, 8)
    expect(changedPieces(graph(design(), wires), graph(fixed, wires))).toBeLessThanOrEqual(chapter15.editBudget)
    const r = play(1, fixed)
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
  })

  it('the interviewer flags whole-file uploads', () => {
    const notes = reviewDesign(initSim(graph(design(5, 5, { blockDelta: false }), wires), ch, 0), chapter15, [])
    expect(notes.map((n) => n.text).join('\n')).toMatch(/whole files/)
  })
})

describe('Chapter 15 rules', () => {
  it('the reference designs are legal', () => {
    expect(blockers(ch, 0, design(), wires)).toEqual([])
    expect(blockers(ch, 1, design(14, 8), wires)).toEqual([])
  })
  it('blocks files sent straight to storage', () =>
    expect(blockers(ch, 0, design().filter(([id]) => id !== 'bs'), ['u>lb', 'lb>blob', 'lb>api', 'api>db']).join(' ')).toMatch(/through block servers/))
})
