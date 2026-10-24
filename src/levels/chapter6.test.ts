import { describe, expect, it } from 'vitest'
import { staleChance, unreachable } from '../engine/components/kvstore'
import { changedPieces, reviewDesign } from '../engine/interview'
import { initSim } from '../engine/simulator'
import type { NodeConfig } from '../engine/types'
import { chapter6 } from './chapter6'
import { blockers, graph, playJudged, type N } from './test-suite'

const ch = chapter6.chapter
const ok = { kvCopies: 3, kvWrite: 'quorum', kvRead: 'quorum', kvConflict: 'vclock' } as const
const store = (nodes: number, cfg: Partial<NodeConfig> = ok): N[] => [['u', 'traffic'], ['kv', 'kvstore', nodes, cfg]]
const play = (stage: number, nodes: N[], wires = ['u>kv']) => playJudged(ch, stage, nodes, wires)

describe('quorum maths', () => {
  it('a quorum of 3 survives one unreachable node, waiting for all does not', () => {
    expect(unreachable(3, 2, 7, 1)).toBe(0)
    expect(unreachable(3, 3, 7, 1)).toBeCloseTo(3 / 7)
    expect(unreachable(5, 3, 15, 2)).toBe(0)
    expect(unreachable(3, 2, 15, 2)).toBeCloseTo(13 / 455)
  })

  it('reads overlap writes only when R + W > N', () => {
    expect(staleChance(3, 2, 2)).toBe(0)
    expect(staleChance(3, 1, 1)).toBeCloseTo(2 / 3)
  })
})

describe('Chapter 6 main run', () => {
  it('seven nodes, N=3 with quorum reads and writes and vector clocks earn three stars', () => {
    const r = play(0, store(7))
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
    expect(r.cost).toBe(ch.stages[0]!.referenceCost)
  })

  it('last write wins silently loses concurrent cart writes', () => {
    expect(play(0, store(7, { ...ok, kvConflict: 'lww' })).missed.join(' ')).toMatch(/concurrent cart writes were silently lost/)
  })

  it('W=1, R=1 is fast but shoppers miss their own writes', () => {
    expect(play(0, store(7, { ...ok, kvWrite: 'one', kvRead: 'one' })).missed.join(' ')).toMatch(/stale/)
  })

  it('waiting for all replicas fails writes while a node is cut off', () => {
    expect(play(0, store(7, { ...ok, kvWrite: 'all', kvRead: 'one' })).metrics.uptime).toBeLessThan(0.99)
  })

  it('a single copy loses the keys on the cut-off node', () => {
    expect(play(0, store(7, { ...ok, kvCopies: 1 })).stars).toBe(0)
  })

  it('six nodes have no headroom once one is cut off', () => {
    expect(play(0, store(6)).stars).toBe(0)
  })
})

describe('Chapter 6 curveball', () => {
  it('N=3 cannot keep a quorum when two nodes are cut off', () => {
    expect(play(1, store(7)).stars).toBe(0)
    expect(play(1, store(15)).stars).toBe(0)
  })

  it('five copies on fifteen nodes fix it with one change', () => {
    const after = store(15, { ...ok, kvCopies: 5 })
    expect(changedPieces(graph(store(7), ['u>kv']), graph(after, ['u>kv']))).toBeLessThanOrEqual(chapter6.editBudget)
    const r = play(1, after)
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
  })

  it('the interviewer flags R + W ≤ N and last write wins', () => {
    const notes = reviewDesign(initSim(graph(store(7, { ...ok, kvWrite: 'one', kvRead: 'one', kvConflict: 'lww' }), ['u>kv']), ch, 0), chapter6, [])
    const text = notes.map((n) => n.text).join('\n')
    expect(text).toMatch(/R \+ W = 2 is not more than N = 3/)
    expect(text).toMatch(/silently drops/)
  })
})

describe('Chapter 6 rules', () => {
  it('the reference designs are legal', () => {
    expect(blockers(ch, 0, store(7), ['u>kv'])).toEqual([])
    expect(blockers(ch, 1, store(15, { ...ok, kvCopies: 5 }), ['u>kv'])).toEqual([])
  })

  it('blocks more copies than nodes', () => {
    expect(blockers(ch, 0, store(2), ['u>kv']).join(' ')).toMatch(/3 copies need at least 3 nodes/)
  })

  it('blocks a design with no store', () => {
    expect(blockers(ch, 0, [['u', 'traffic']], []).join(' ')).toMatch(/building the key-value store itself/)
  })

  it('blocks pieces this chapter has not unlocked', () => {
    expect(blockers(ch, 0, [...store(7), ['db', 'sqldb']], ['u>kv', 'u>db']).join(' ')).toMatch(/SQL Database isn't available/)
  })

  it('blocks a second store nobody uses', () => {
    expect(blockers(ch, 0, [...store(7), ['kv2', 'kvstore', 3, ok]], ['u>kv']).join(' ')).toMatch(/isn't on any request's path/)
  })
})
