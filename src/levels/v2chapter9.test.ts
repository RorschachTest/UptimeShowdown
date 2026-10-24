import { describe, expect, it } from 'vitest'
import { changedPieces, reviewDesign } from '../engine/interview'
import { initSim } from '../engine/simulator'
import type { BlobDurability } from '../engine/types'
import { blockers, graph, playJudged, type N } from './test-suite'
import { v2chapter9 } from './v2chapter9'

const ch = v2chapter9.chapter
const wires = ['u>lb', 'lb>api', 'api>meta', 'meta>data']
const design = (data = 9, dur: BlobDurability = 'erasure', meta = 6, apps = 3): N[] => [
  ['u', 'traffic'],
  ['lb', 'lb'],
  ['api', 'app', apps],
  ['meta', 'kvstore', meta, { kvCopies: 3, kvWrite: 'quorum', kvRead: 'quorum', kvConflict: 'lww' }],
  ['data', 'blob', data, { blobDurability: dur }],
]
const play = (stage: number, nodes: N[], w = wires) => playJudged(ch, stage, nodes, w)

describe('V2 Chapter 9 main run', () => {
  it('erasure-coded data nodes with a quorum metadata store earn three stars', () => {
    const r = play(0, design())
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
    expect(r.cost).toBe(ch.stages[0]!.referenceCost)
  })
  it('one copy loses objects when disks fail', () => expect(play(0, design(6, 'single')).missed.join(' ')).toMatch(/lost objects for good/))
  it('three full copies blow the budget', () => expect(play(0, design(16, 'replicas')).stars).toBeLessThan(2))
  it('a small metadata store cannot keep up', () => expect(play(0, design(9, 'erasure', 5)).stars).toBe(0))
})

describe('V2 Chapter 9 curveball', () => {
  it('twice the data does not fit', () => expect(play(1, design()).stars).toBe(0))

  it('more erasure-coded data nodes fix it in one change', () => {
    const fixed = design(16)
    expect(changedPieces(graph(design(), wires), graph(fixed, wires))).toBeLessThanOrEqual(v2chapter9.editBudget)
    const r = play(1, fixed)
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
  })

  it('three copies of a petabyte cost far too much', () => expect(play(1, design(31, 'replicas')).stars).toBeLessThan(2))

  it('the interviewer flags single copies', () => {
    const notes = reviewDesign(initSim(graph(design(6, 'single'), wires), ch, 0), v2chapter9, [])
    expect(notes.map((n) => n.text).join('\n')).toMatch(/loses data permanently/)
  })
})

describe('V2 Chapter 9 rules', () => {
  it('the reference designs are legal', () => {
    expect(blockers(ch, 0, design(), wires)).toEqual([])
    expect(blockers(ch, 1, design(16), wires)).toEqual([])
  })
  it('blocks objects that skip the metadata store', () =>
    expect(blockers(ch, 0, design().filter(([id]) => id !== 'meta'), ['u>lb', 'lb>api', 'api>data']).join(' ')).toMatch(/Nothing in your design can serve|through the metadata store/))
})
