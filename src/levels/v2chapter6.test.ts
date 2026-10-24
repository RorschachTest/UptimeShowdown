import { describe, expect, it } from 'vitest'
import { changedPieces, reviewDesign } from '../engine/interview'
import { initSim } from '../engine/simulator'
import type { NodeConfig } from '../engine/types'
import { blockers, graph, playJudged, type N } from './test-suite'
import { v2chapter6 } from './v2chapter6'

const ch = v2chapter6.chapter
const wires = ['u>q', 'q>agg', 'agg>db', 'u>lb', 'lb>api', 'api>db']
const ok = { aggLate: 'watermark', aggDedupe: true, aggKeys: 'split' } as const
const design = (nodes = 4, cfg: Partial<NodeConfig> = ok): N[] => [
  ['u', 'traffic'],
  ['q', 'queue'],
  ['agg', 'aggregator', nodes, cfg],
  ['db', 'tsdb', 1, { tsEngine: 'timeseries', tsRetention: 'downsample' }],
  ['lb', 'lb'],
  ['api', 'app'],
]
const play = (stage: number, nodes: N[]) => playJudged(ch, stage, nodes, wires)
const missed = (stage: number, nodes: N[]) => play(stage, nodes).missed.join(' ')

describe('V2 Chapter 6 main run', () => {
  it('watermarks, dedupe and split hot keys on four nodes earn three stars', () => {
    const r = play(0, design())
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
    expect(r.cost).toBe(ch.stages[0]!.referenceCost)
  })
  it('dropping late clicks miscounts them', () => expect(missed(0, design(4, { ...ok, aggLate: 'drop' }))).toMatch(/miscounted/))
  it('without dedupe, retried clicks are counted twice', () => expect(missed(0, design(4, { ...ok, aggDedupe: false }))).toMatch(/miscounted/))
  it('partitioning only by ad needs far more nodes for the viral ad', () => expect(play(0, design(9, { ...ok, aggKeys: 'byAd' })).stars).toBeLessThan(2))
  it('three nodes fall behind when one crashes', () => expect(missed(0, design(3))).toMatch(/Background work took/))
})

describe('V2 Chapter 6 curveball', () => {
  it('the final overwhelms the main design', () => expect(play(1, design()).stars).toBe(0))

  it('more aggregator nodes fix it in one change', () => {
    const fixed = design(10)
    expect(changedPieces(graph(design(), wires), graph(fixed, wires))).toBeLessThanOrEqual(v2chapter6.editBudget)
    const r = play(1, fixed)
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
  })

  it('the interviewer flags the counting mistakes', () => {
    const notes = reviewDesign(initSim(graph(design(4, { aggLate: 'drop', aggDedupe: false, aggKeys: 'byAd' }), wires), ch, 0), v2chapter6, [])
    const text = notes.map((n) => n.text).join('\n')
    expect(text).toMatch(/late events/)
    expect(text).toMatch(/counted twice/)
    expect(text).toMatch(/viral ad/)
  })
})

describe('V2 Chapter 6 rules', () => {
  it('the reference designs are legal', () => {
    expect(blockers(ch, 0, design(), wires)).toEqual([])
    expect(blockers(ch, 1, design(10), wires)).toEqual([])
  })
  it('blocks a design with no aggregator', () =>
    expect(blockers(ch, 0, design().filter(([id]) => id !== 'agg'), ['u>q', 'q>db', 'u>lb', 'lb>api', 'api>db']).join(' ')).toMatch(/stream aggregator/))
})
