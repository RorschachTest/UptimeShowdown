import { describe, expect, it } from 'vitest'
import { feedCost } from '../engine/components/feed'
import { changedPieces, reviewDesign } from '../engine/interview'
import { initSim } from '../engine/simulator'
import type { FanoutMode } from '../engine/types'
import { chapter11 } from './chapter11'
import { blockers, graph, playJudged, type N } from './test-suite'

const ch = chapter11.chapter
const wires = ['u>lb', 'lb>q', 'q>f', 'lb>f']
const design = (servers = 2, fanoutMode: FanoutMode = 'write'): N[] => [['u', 'traffic'], ['lb', 'lb'], ['q', 'queue'], ['f', 'feed', servers, { fanoutMode }]]
const play = (stage: number, nodes: N[], w = wires) => playJudged(ch, stage, nodes, w)

describe('fanout costs', () => {
  it('push makes reads cheap and celebrity posts enormous; hybrid pulls only celebrities', () => {
    expect(feedCost('write', 'feed', 1)).toBe(1)
    expect(feedCost('write', 'fanout', 20_000_000)).toBe(20_000_000)
    expect(feedCost('read', 'feed', 1)).toBe(100)
    expect(feedCost('hybrid', 'fanout', 20_000_000)).toBe(1)
    expect(feedCost('hybrid', 'fanout', 200)).toBe(200)
  })
})

describe('Chapter 11 main run', () => {
  it('two servers with fanout on write earn three stars', () => {
    const r = play(0, design())
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
    expect(r.cost).toBe(ch.stages[0]!.referenceCost)
  })

  it('fanout on read makes every feed open too slow', () => expect(play(0, design(4, 'read')).stars).toBe(0))
  it('one server cannot keep up', () => expect(play(0, design(1)).stars).toBe(0))
})

describe('Chapter 11 curveball', () => {
  it('pushing celebrity posts to 20 million feeds never finishes', () => {
    for (const n of [2, 6, 20]) expect(play(1, design(n)).missed.join(' ')).toMatch(/never reached their followers/)
  })

  it('switching to hybrid fanout (and one more server) fixes it', () => {
    const fixed = design(3, 'hybrid')
    expect(changedPieces(graph(design(), wires), graph(fixed, wires))).toBeLessThanOrEqual(chapter11.editBudget)
    const r = play(1, fixed)
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
  })

  it('the interviewer flags pull-on-read', () => {
    const notes = reviewDesign(initSim(graph(design(4, 'read'), wires), ch, 0), chapter11, [])
    expect(notes.map((n) => n.text).join('\n')).toMatch(/fetch from ~100 accounts/)
  })
})

describe('Chapter 11 rules', () => {
  it('the reference designs are legal', () => {
    expect(blockers(ch, 0, design(), wires)).toEqual([])
    expect(blockers(ch, 1, design(3, 'hybrid'), wires)).toEqual([])
  })

  it('blocks a design with no feed service', () => {
    expect(blockers(ch, 0, [['u', 'traffic'], ['lb', 'lb'], ['q', 'queue']], ['u>lb', 'lb>q']).join(' ')).toMatch(/news feed service/)
  })

  it('blocks posts that skip the queue', () => {
    // Without a queue there is no way to enqueue a post at all.
    const text = blockers(ch, 0, [['u', 'traffic'], ['lb', 'lb'], ['f', 'feed', 2]], ['u>lb', 'lb>f']).join(' ')
    expect(text).toMatch(/Nothing in your design can serve "New post"/)
  })

  it('blocks pieces this chapter has not unlocked', () =>
    expect(blockers(ch, 0, [...design(), ['c', 'cache']], [...wires, 'lb>c']).join(' ')).toMatch(/Cache isn't available/))
})
