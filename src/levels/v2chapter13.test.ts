import { describe, expect, it } from 'vitest'
import { changedPieces, reviewDesign } from '../engine/interview'
import { initSim } from '../engine/simulator'
import type { NodeConfig } from '../engine/types'
import { blockers, graph, playJudged, type N } from './test-suite'
import { v2chapter13 } from './v2chapter13'

const ch = v2chapter13.chapter
const wires = ['u>m', 'm>md']
const ok = { matchState: 'memory', matchOrder: 'sequencer', matchStandby: true } as const
const design = (engines = 1, cfg: Partial<NodeConfig> = ok, md = 2): N[] => [
  ['u', 'traffic'],
  ['m', 'matcher', engines, cfg],
  ['md', 'pubsub', md, { pubsubHashing: 'ring' }],
]
const play = (stage: number, nodes: N[]) => playJudged(ch, stage, nodes, wires)
const missed = (stage: number, nodes: N[]) => play(stage, nodes).missed.join(' ')

describe('V2 Chapter 13 main run', () => {
  it('an in-memory book, a sequencer and a hot standby earn three stars', () => {
    const r = play(0, design())
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
    expect(r.cost).toBe(ch.stages[0]!.referenceCost)
    expect(r.metrics.p95Ms).toBeLessThan(5)
  })
  it('without a standby a crash loses the order book', () => expect(missed(0, design(2, { ...ok, matchStandby: false }))).toMatch(/lost the order book/))
  it('without a sequencer orders are matched out of turn', () => expect(missed(0, design(1, { ...ok, matchOrder: 'arrival' }))).toMatch(/out of turn/))
  it('a database-backed order book is far too slow', () => expect(play(0, design(10, { ...ok, matchState: 'database' })).metrics.p95Ms).toBeGreaterThan(5))
})

describe('V2 Chapter 13 curveball', () => {
  it('the open overwhelms a single engine', () => expect(play(1, design()).stars).toBe(0))

  it('a second engine and more market-data servers fix it in two changes', () => {
    const fixed = design(2, ok, 3)
    expect(changedPieces(graph(design(), wires), graph(fixed, wires))).toBeLessThanOrEqual(v2chapter13.editBudget)
    const r = play(1, fixed)
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
  })

  it('the interviewer flags every shortcut', () => {
    const notes = reviewDesign(initSim(graph(design(1, { matchState: 'database', matchOrder: 'arrival', matchStandby: false }), wires), ch, 0), v2chapter13, [])
    const text = notes.map((n) => n.text).join('\n')
    expect(text).toMatch(/far too slow/)
    expect(text).toMatch(/out of turn/)
    expect(text).toMatch(/loses the order book/)
  })
})

describe('V2 Chapter 13 rules', () => {
  it('the reference designs are legal', () => {
    expect(blockers(ch, 0, design(), wires)).toEqual([])
    expect(blockers(ch, 1, design(2, ok, 3), wires)).toEqual([])
  })
  it('blocks a design with no matching engine', () => expect(blockers(ch, 0, [['u', 'traffic'], ['md', 'pubsub']], ['u>md']).join(' ')).toMatch(/matching engine/))
})
