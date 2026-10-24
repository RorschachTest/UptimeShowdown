import { describe, expect, it } from 'vitest'
import { changedPieces, reviewDesign } from '../engine/interview'
import { initSim } from '../engine/simulator'
import type { NodeConfig } from '../engine/types'
import { chapter7 } from './chapter7'
import { blockers, graph, playJudged, type N } from './test-suite'

const ch = chapter7.chapter
const snowflake = { idScheme: 'snowflake', idClock: 'wait' } as const
const ids = (servers: number, cfg: Partial<NodeConfig> = snowflake): N[] => [['u', 'traffic'], ['g', 'idgen', servers, cfg]]
const play = (stage: number, nodes: N[], wires = ['u>g']) => playJudged(ch, stage, nodes, wires)
const missed = (stage: number, nodes: N[]) => play(stage, nodes).missed.join(' ')

describe('Chapter 7 main run', () => {
  it('two Snowflake servers that wait out clock jumps earn three stars', () => {
    const r = play(0, ids(2))
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
    expect(r.cost).toBe(ch.stages[0]!.referenceCost)
  })

  it('one ticket server is far too slow', () => expect(play(0, ids(1, { idScheme: 'ticket' })).metrics.uptime).toBeLessThan(0.5))
  it('several ticket servers hand out the same IDs', () => expect(missed(0, ids(10, { idScheme: 'ticket' }))).toMatch(/duplicate IDs/))
  it('multi-master IDs are not in time order', () => expect(missed(0, ids(10, { idScheme: 'multimaster' }))).toMatch(/out of time order/))
  it('UUIDs are too long and unordered', () => expect(missed(0, ids(2, { idScheme: 'uuid' }))).toMatch(/too long for 64 bits/))
  it('trusting a clock that jumps back repeats IDs', () => expect(missed(0, ids(2, { ...snowflake, idClock: 'trust' }))).toMatch(/duplicate IDs/))
  it('one server is a single point of failure', () => expect(play(0, ids(1)).metrics.uptime).toBeLessThan(0.99))
})

describe('Chapter 7 curveball', () => {
  it('two servers cannot issue 120,000 IDs a second', () => expect(play(1, ids(2)).stars).toBe(0))

  it('four servers fix it with one change', () => {
    expect(changedPieces(graph(ids(2), ['u>g']), graph(ids(4), ['u>g']))).toBeLessThanOrEqual(chapter7.editBudget)
    const r = play(1, ids(4))
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
  })

  it('the interviewer flags several ticket servers', () => {
    const notes = reviewDesign(initSim(graph(ids(3, { idScheme: 'ticket' }), ['u>g']), ch, 0), chapter7, [])
    expect(notes.map((n) => n.text).join('\n')).toMatch(/each count from 1/)
  })
})

describe('Chapter 7 rules', () => {
  it('the reference designs are legal', () => {
    expect(blockers(ch, 0, ids(2), ['u>g'])).toEqual([])
    expect(blockers(ch, 1, ids(4), ['u>g'])).toEqual([])
  })
  it('blocks a design with no ID generator', () => expect(blockers(ch, 0, [['u', 'traffic']], []).join(' ')).toMatch(/needs an ID from your ID generator/))
  it('blocks pieces this chapter has not unlocked', () =>
    expect(blockers(ch, 0, [...ids(2), ['db', 'sqldb']], ['u>g', 'g>db']).join(' ')).toMatch(/SQL Database isn't available/))
  it('blocks a second generator nobody uses', () => expect(blockers(ch, 0, [...ids(2), ['g2', 'idgen']], ['u>g']).join(' ')).toMatch(/isn't on any request's path/))
})
