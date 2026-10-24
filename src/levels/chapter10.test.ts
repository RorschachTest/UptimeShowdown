import { describe, expect, it } from 'vitest'
import { changedPieces, reviewDesign } from '../engine/interview'
import { initSim } from '../engine/simulator'
import type { NodeConfig } from '../engine/types'
import { chapter10 } from './chapter10'
import { blockers, graph, playJudged, type N } from './test-suite'

const ch = chapter10.chapter
const wires = ['u>lb', 'lb>web', 'web>q', 'q>w', 'w>p']
const ok = { providerRetry: 'retry', providerDedupe: true } as const
const design = (apps = 6, workers = 3, p: Partial<NodeConfig> = ok): N[] => [
  ['u', 'traffic'],
  ['lb', 'lb'],
  ['web', 'app', apps],
  ['q', 'queue'],
  ['w', 'worker', workers],
  ['p', 'provider', 1, p],
]
const play = (stage: number, nodes: N[], w = wires) => playJudged(ch, stage, nodes, w)
const missed = (stage: number, nodes: N[]) => play(stage, nodes).missed.join(' ')

describe('async engine', () => {
  it('answers the caller at the queue and counts delivery as background lag', () => {
    const r = play(0, design())
    expect(r.metrics.p95Ms).toBeLessThan(100)
    expect(r.metrics.lagP95Ms).toBeGreaterThan(1000)
  })

  it('losses after the queue are lost messages, not caller errors', () => {
    const r = play(0, design(6, 3, { providerRetry: 'drop' }))
    expect(r.metrics.uptime).toBe(1)
    expect(r.metrics.violations.lostMessages).toBeGreaterThan(0)
  })
})

describe('Chapter 10 main run', () => {
  it('six API servers, three workers and retries with idempotency keys earn three stars', () => {
    const r = play(0, design())
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
    expect(r.cost).toBe(ch.stages[0]!.referenceCost)
  })

  it('giving up during the outage loses notifications', () => expect(missed(0, design(6, 3, { providerRetry: 'drop' }))).toMatch(/notifications were lost/))
  it('retrying without idempotency keys sends some twice', () => expect(missed(0, design(6, 3, { providerRetry: 'retry' }))).toMatch(/sent twice/))
  it('two workers fall behind', () => expect(missed(0, design(6, 2))).toMatch(/Background work took/))
  it('five API servers cannot answer the callers', () => expect(play(0, design(5)).metrics.uptime).toBeLessThan(0.99))
})

describe('Chapter 10 curveball', () => {
  it('the blast overwhelms the main design', () => expect(play(1, design()).stars).toBe(0))

  it('more API servers and more workers fix it in two changes', () => {
    const fixed = design(18, 8)
    expect(changedPieces(graph(design(), wires), graph(fixed, wires))).toBeLessThanOrEqual(chapter10.editBudget)
    const r = play(1, fixed)
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
  })

  it('more API servers alone leave delivery too slow', () => expect(missed(1, design(18, 4))).toMatch(/Background work took/))

  it('the interviewer flags retries without idempotency keys', () => {
    const notes = reviewDesign(initSim(graph(design(6, 3, { providerRetry: 'retry' }), wires), ch, 0), chapter10, [])
    expect(notes.map((n) => n.text).join('\n')).toMatch(/notify people twice/)
  })
})

describe('Chapter 10 rules', () => {
  it('the reference designs are legal', () => {
    expect(blockers(ch, 0, design(), wires)).toEqual([])
    expect(blockers(ch, 1, design(18, 8), wires)).toEqual([])
  })

  it('blocks a design with no queue', () => {
    const nodes = design().filter(([id]) => id !== 'q')
    const text = blockers(ch, 0, nodes, ['u>lb', 'lb>web', 'web>w', 'w>p']).join(' ')
    expect(text).toMatch(/put a message queue/)
    expect(text).toMatch(/Nothing in your design can serve "Notification"/)
  })

  it('blocks pieces this chapter has not unlocked', () =>
    expect(blockers(ch, 0, [...design(), ['c', 'cache']], [...wires, 'web>c']).join(' ')).toMatch(/Cache isn't available/))

  it('blocks a second queue nobody uses', () => expect(blockers(ch, 0, [...design(), ['q2', 'queue']], wires).join(' ')).toMatch(/isn't on any request's path/))
})
