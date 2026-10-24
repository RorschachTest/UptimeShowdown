import { describe, expect, it } from 'vitest'
import { changedPieces } from '../engine/interview'
import type { DbConcurrency, Tier } from '../engine/types'
import { blockers, graph, playJudged, type N } from './test-suite'
import { v2chapter7 } from './v2chapter7'

const ch = v2chapter7.chapter
const wires = ['u>lb', 'lb>api', 'api>c', 'c>db']
const design = (apps = 7, tier: Tier = 1, cc: DbConcurrency = 'optimistic', idem = true): N[] => [
  ['u', 'traffic'],
  ['lb', 'lb'],
  ['api', 'app', apps, { appIdempotent: idem }],
  ['c', 'cache'],
  ['db', 'sqldb', 1, { tier, dbConcurrency: cc }],
]
const play = (stage: number, nodes: N[]) => playJudged(ch, stage, nodes, wires)
const missed = (stage: number, nodes: N[]) => play(stage, nodes).missed.join(' ')

describe('V2 Chapter 7 main run', () => {
  it('version checks and idempotency keys earn three stars', () => {
    const r = play(0, design())
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
    expect(r.cost).toBe(ch.stages[0]!.referenceCost)
  })
  it('no concurrency control sells rooms twice', () => expect(missed(0, design(7, 1, 'none'))).toMatch(/sold twice/))
  it('no idempotency key turns double clicks into two reservations', () => expect(missed(0, design(7, 1, 'optimistic', false))).toMatch(/two reservations/))
  it('row locks halve write throughput', () => {
    expect(play(0, design(7, 1, 'pessimistic')).stars).toBe(0)
    expect(play(0, design(7, 2, 'pessimistic')).stars).toBeLessThan(2)
  })
})

describe('V2 Chapter 7 curveball', () => {
  it('the concert overwhelms the main design', () => expect(play(1, design()).stars).toBe(0))

  it('the biggest database and more servers fix it in two changes', () => {
    const fixed = design(8, 3)
    expect(changedPieces(graph(design(), wires), graph(fixed, wires))).toBeLessThanOrEqual(v2chapter7.editBudget)
    const r = play(1, fixed)
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
  })

  it('heavy contention makes optimistic retries pile up on a medium database', () => expect(play(1, design(9, 2)).stars).toBe(0))
})

describe('V2 Chapter 7 rules', () => {
  it('the reference designs are legal', () => {
    expect(blockers(ch, 0, design(), wires)).toEqual([])
    expect(blockers(ch, 1, design(8, 3), wires)).toEqual([])
  })
  it('the booking settings stay locked in other chapters', async () => {
    const { chapter3 } = await import('./chapter3')
    const nodes: N[] = [['u', 'traffic'], ['lb', 'lb'], ['web', 'app', 2, { appIdempotent: true }], ['db', 'sqldb', 1, { dbConcurrency: 'optimistic' }]]
    const text = blockers(chapter3.chapter, 0, nodes, ['u>lb', 'lb>web', 'web>db']).join(' ')
    expect(text).toMatch(/Idempotency key" isn't unlocked/)
    expect(text).toMatch(/Racing writes" isn't unlocked/)
  })
})
