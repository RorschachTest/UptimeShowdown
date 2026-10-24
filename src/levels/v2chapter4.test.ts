import { describe, expect, it } from 'vitest'
import { changedPieces, reviewDesign } from '../engine/interview'
import { initSim } from '../engine/simulator'
import type { NodeConfig } from '../engine/types'
import { blockers, graph, playJudged, type N } from './test-suite'
import { v2chapter4 } from './v2chapter4'

const ch = v2chapter4.chapter
const wires = ['u>b', 'b>w']
const ok = { brokerReplicas: 3, brokerAcks: 'all', brokerCommit: 'after' } as const
const design = (brokers = 7, workers = 5, cfg: Partial<NodeConfig> = ok): N[] => [['u', 'traffic'], ['b', 'broker', brokers, cfg], ['w', 'worker', workers]]
const play = (stage: number, nodes: N[]) => playJudged(ch, stage, nodes, wires)
const missed = (stage: number, nodes: N[]) => play(stage, nodes).missed.join(' ')

describe('V2 Chapter 4 main run', () => {
  it('replication 3, acks=all and commit-after-processing earn three stars', () => {
    const r = play(0, design())
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
    expect(r.cost).toBe(ch.stages[0]!.referenceCost)
    expect(r.metrics.violations.processedTwice).toBeGreaterThan(0)
  })
  it('acks=1 loses the tail the followers had not copied', () => expect(missed(0, design(7, 5, { ...ok, brokerAcks: 'leader' }))).toMatch(/messages were lost/))
  it('replication factor 1 loses a dead broker’s partitions', () => expect(missed(0, design(3, 6, { ...ok, brokerReplicas: 1 }))).toMatch(/messages were lost/))
  it('committing before processing loses a crashed consumer’s batch', () => expect(missed(0, design(7, 5, { ...ok, brokerCommit: 'before' }))).toMatch(/messages were lost/))
  it('six brokers have no room for a failure', () => expect(play(0, design(6, 5)).stars).toBe(0))
})

describe('V2 Chapter 4 curveball', () => {
  it('the flash sale overwhelms the main design', () => expect(play(1, design()).stars).toBe(0))

  it('more brokers and consumers fix it in two changes', () => {
    const fixed = design(13, 11)
    expect(changedPieces(graph(design(), wires), graph(fixed, wires))).toBeLessThanOrEqual(v2chapter4.editBudget)
    const r = play(1, fixed)
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
  })

  it('the interviewer flags weak durability settings', () => {
    const notes = reviewDesign(initSim(graph(design(7, 5, { brokerReplicas: 1, brokerAcks: 'none', brokerCommit: 'before' }), wires), ch, 0), v2chapter4, [])
    const text = notes.map((n) => n.text).join('\n')
    expect(text).toMatch(/Replication factor 1/)
    expect(text).toMatch(/all replicas/)
    expect(text).toMatch(/Committing before processing/)
  })
})

describe('V2 Chapter 4 rules', () => {
  it('the reference designs are legal', () => {
    expect(blockers(ch, 0, design(), wires)).toEqual([])
    expect(blockers(ch, 1, design(13, 11), wires)).toEqual([])
  })
  it('blocks a design with no brokers', () => expect(blockers(ch, 0, [['u', 'traffic'], ['w', 'worker', 5]], ['u>w']).join(' ')).toMatch(/brokers themselves/))
})
