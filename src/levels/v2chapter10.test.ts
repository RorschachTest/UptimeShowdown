import { describe, expect, it } from 'vitest'
import { changedPieces, reviewDesign } from '../engine/interview'
import { initSim } from '../engine/simulator'
import type { NodeConfig } from '../engine/types'
import { blockers, graph, playJudged, type N } from './test-suite'
import { v2chapter10 } from './v2chapter10'

const ch = v2chapter10.chapter
const ok = { boardStore: 'zset', boardShard: 'score', boardReplica: true } as const
const board = (shards: number, cfg: Partial<NodeConfig> = ok): N[] => [['u', 'traffic'], ['b', 'leaderboard', shards, cfg]]
const play = (stage: number, nodes: N[], w = ['u>b']) => playJudged(ch, stage, nodes, w)

describe('V2 Chapter 10 main run', () => {
  it('one sorted set with a replica earns three stars', () => {
    const r = play(0, board(1))
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
    expect(r.cost).toBe(ch.stages[0]!.referenceCost)
  })

  it('without a replica the crash wipes the scores', () => expect(play(0, board(2, { ...ok, boardReplica: false })).missed.join(' ')).toMatch(/wiped scores/))
  it('SQL ORDER BY cannot keep up even on ten shards', () => expect(play(0, board(10, { ...ok, boardStore: 'sql' })).metrics.uptime).toBeLessThan(0.5))
})

describe('V2 Chapter 10 curveball', () => {
  it('one shard cannot hold 150 GB or take 90,000 requests', () => expect(play(1, board(1)).stars).toBe(0))

  it('five shards split by score range fix it with one change', () => {
    expect(changedPieces(graph(board(1), ['u>b']), graph(board(5), ['u>b']))).toBeLessThanOrEqual(v2chapter10.editBudget)
    const r = play(1, board(5))
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
  })

  it('player-hash shards drown in scatter-gather reads', () => {
    for (const n of [5, 8, 10]) expect(play(1, board(n, { ...ok, boardShard: 'hash' })).stars).toBe(0)
  })

  it('the interviewer flags hash shards and a missing replica', () => {
    const notes = reviewDesign(initSim(graph(board(3, { ...ok, boardShard: 'hash', boardReplica: false }), ['u>b']), ch, 0), v2chapter10, [])
    const text = notes.map((n) => n.text).join('\n')
    expect(text).toMatch(/must ask every shard/)
    expect(text).toMatch(/No replica/)
  })
})

describe('V2 Chapter 10 rules', () => {
  it('the reference designs are legal', () => {
    expect(blockers(ch, 0, board(1), ['u>b'])).toEqual([])
    expect(blockers(ch, 1, board(5), ['u>b'])).toEqual([])
  })
  it('blocks a design with no leaderboard store', () => expect(blockers(ch, 0, [['u', 'traffic']], []).join(' ')).toMatch(/leaderboard store itself/))
  it('blocks pieces this chapter has not unlocked', () =>
    expect(blockers(ch, 0, [...board(1), ['db', 'sqldb']], ['u>b', 'u>db']).join(' ')).toMatch(/SQL Database isn't available/))
  it('blocks a second store nobody uses', () => expect(blockers(ch, 0, [...board(1), ['b2', 'leaderboard']], ['u>b']).join(' ')).toMatch(/isn't on any request's path/))
})
