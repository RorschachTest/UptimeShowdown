import { describe, expect, it } from 'vitest'
import { changedPieces, reviewDesign } from '../engine/interview'
import { initSim } from '../engine/simulator'
import type { NodeConfig } from '../engine/types'
import { chapter13 } from './chapter13'
import { blockers, graph, playJudged, type N } from './test-suite'

const ch = chapter13.chapter
const wires = ['u>t', 'u>q', 'q>w']
const ok = { trieTopK: true, trieBuild: 'weekly', trieShard: 'map', trieBrowserCache: true } as const
const design = (shards = 2, t: Partial<NodeConfig> = ok, workers = 1, workSample: 'all' | 'tenth' = 'tenth'): N[] => [
  ['u', 'traffic'],
  ['t', 'trie', shards, t],
  ['q', 'queue'],
  ['w', 'worker', workers, { workSample }],
]
const play = (stage: number, nodes: N[], w = wires) => playJudged(ch, stage, nodes, w)

describe('Chapter 13 main run', () => {
  it('two trie shards with cached top 5, weekly rebuilds and a sampled aggregator earn three stars', () => {
    const r = play(0, design())
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
    expect(r.cost).toBe(ch.stages[0]!.referenceCost)
  })
  it('walking subtrees on every keystroke is far too slow', () => expect(play(0, design(2, { ...ok, trieTopK: false })).metrics.uptime).toBeLessThan(0.9))
  it('without browser caching two shards are not enough', () => expect(play(0, design(2, { ...ok, trieBrowserCache: false })).stars).toBe(0))
  it('one shard falls over when it crashes', () => expect(play(0, design(1)).stars).toBe(0))
  it('live updates need twice the shards', () => expect(play(0, design(4, { ...ok, trieBuild: 'live' })).stars).toBeLessThan(3))
  it('too few aggregators fall behind on every log line', () => expect(play(1, design(5, ok, 1, 'all')).missed.join(' ')).toMatch(/Background work took|logs were dropped/))
})

describe('Chapter 13 curveball', () => {
  it('two shards cannot take five times the traffic', () => expect(play(1, design()).stars).toBe(0))

  it('five shards with a shard map fix it with one change', () => {
    expect(changedPieces(graph(design(), wires), graph(design(5), wires))).toBeLessThanOrEqual(chapter13.editBudget)
    const r = play(1, design(5))
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
  })

  it('sharding by first letter needs so many shards it blows the budget', () => {
    for (const n of [8, 9]) expect(play(1, design(n, { ...ok, trieShard: 'letter' })).stars).toBeLessThan(2)
  })

  it('the interviewer flags first-letter shards and live updates', () => {
    const notes = reviewDesign(initSim(graph(design(3, { ...ok, trieShard: 'letter', trieBuild: 'live' }), wires), ch, 0), chapter13, [])
    const text = notes.map((n) => n.text).join('\n')
    expect(text).toMatch(/overloads the shards for common letters/)
    expect(text).toMatch(/fight writes/)
  })
})

describe('Chapter 13 rules', () => {
  it('the reference designs are legal', () => {
    expect(blockers(ch, 0, design(), wires)).toEqual([])
    expect(blockers(ch, 1, design(5), wires)).toEqual([])
  })
  it('blocks a design with no trie', () => expect(blockers(ch, 0, design().filter(([id]) => id !== 't'), ['u>q', 'q>w']).join(' ')).toMatch(/trie of popular searches/))
  it('blocks logs with nowhere to go', () => expect(blockers(ch, 0, design().filter(([id]) => id !== 'q'), ['u>t']).join(' ')).toMatch(/Nothing in your design can serve "Search log"/))
  it('blocks pieces this chapter has not unlocked', () => expect(blockers(ch, 0, [...design(), ['c', 'cache']], [...wires, 'u>c']).join(' ')).toMatch(/Cache isn't available/))
})
