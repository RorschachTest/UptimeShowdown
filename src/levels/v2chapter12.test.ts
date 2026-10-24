import { describe, expect, it } from 'vitest'
import { changedPieces, reviewDesign } from '../engine/interview'
import { initSim } from '../engine/simulator'
import type { WalletTx } from '../engine/types'
import { blockers, graph, playJudged, type N } from './test-suite'
import { v2chapter12 } from './v2chapter12'

const ch = v2chapter12.chapter
const wires = ['u>lb', 'lb>w']
const design = (shards = 4, walletTx: WalletTx = 'eventSourcing'): N[] => [['u', 'traffic'], ['lb', 'lb'], ['w', 'wallet', shards, { walletTx }]]
const play = (stage: number, nodes: N[]) => playJudged(ch, stage, nodes, wires)

describe('V2 Chapter 12 main run', () => {
  it('event sourcing on four shards earns three stars', () => {
    const r = play(0, design())
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
    expect(r.cost).toBe(ch.stages[0]!.referenceCost)
  })
  it('two separate updates create or destroy money when a shard crashes', () => expect(play(0, design(4, 'none')).missed.join(' ')).toMatch(/created or destroyed money/))
  it('sagas are correct but need more shards', () => expect(play(0, design(6, 'saga')).stars).toBeGreaterThanOrEqual(2))
  it('two-phase commit blocks transfers while a shard is down', () => expect(play(0, design(10, 'twoPhase')).metrics.uptime).toBeLessThan(0.99))
  it('three shards have no headroom', () => expect(play(0, design(3)).stars).toBe(0))
})

describe('V2 Chapter 12 curveball', () => {
  it('payday overwhelms the main design', () => expect(play(1, design()).stars).toBe(0))

  it('ten event-sourced shards fix it in one change', () => {
    const fixed = design(10)
    expect(changedPieces(graph(design(), wires), graph(fixed, wires))).toBeLessThanOrEqual(v2chapter12.editBudget)
    const r = play(1, fixed)
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
  })

  it('sagas at payday scale blow the budget', () => expect(play(1, design(16, 'saga')).stars).toBeLessThan(2))

  it('the interviewer flags non-atomic transfers', () => {
    const notes = reviewDesign(initSim(graph(design(4, 'none'), wires), ch, 0), v2chapter12, [])
    expect(notes.map((n) => n.text).join('\n')).toMatch(/creates or destroys money/)
  })
})

describe('V2 Chapter 12 rules', () => {
  it('the reference designs are legal', () => {
    expect(blockers(ch, 0, design(), wires)).toEqual([])
    expect(blockers(ch, 1, design(10), wires)).toEqual([])
  })
  it('blocks a design with no ledger', () => expect(blockers(ch, 0, [['u', 'traffic'], ['lb', 'lb']], ['u>lb']).join(' ')).toMatch(/wallet ledger/))
})
