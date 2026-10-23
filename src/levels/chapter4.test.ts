import { describe, expect, it } from 'vitest'
import { changedPieces, reviewDesign } from '../engine/interview'
import { stageResult } from '../engine/scoring'
import { initSim, TICKS_PER_SEC } from '../engine/simulator'
import { graph, run, type N } from '../engine/test-helpers'
import type { NodeConfig } from '../engine/types'
import { chapter4 } from './chapter4'

const ch = chapter4.chapter
const through = { writeStrategy: 'through' } as const
const backend: N[] = [
  ['web', 'app', 6],
  ['c', 'cache', 1, through],
  ['db', 'sqldb'],
]
const backendWires = ['web>c', 'c>db']

function limited(rl: Partial<NodeConfig>, instances = 1, withLb = false) {
  const nodes: N[] = [['u', 'traffic'], ['rl', 'ratelimit', instances, rl], ...backend]
  const wires = [...backendWires, 'rl>web']
  if (withLb) {
    nodes.push(['lb', 'lb'])
    wires.push('u>lb', 'lb>rl')
  } else wires.push('u>rl')
  return graph(nodes, wires)
}

function play(stage: number, g: ReturnType<typeof graph>) {
  return stageResult(run(initSim(g, ch, stage), ch.stages[stage]!.durationS * TICKS_PER_SEC))
}

const reference = { rlAlgorithm: 'token', rlLimit: 'medium', rlCounters: 'local' } as const

describe('Chapter 4 main run', () => {
  it('the reference design earns three stars at the reference cost', () => {
    const r = play(0, limited(reference))
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
    expect(r.cost).toBe(ch.stages[0]!.referenceCost)
  })

  it('without a rate limiter the scrapers get everything and swamp the backend', () => {
    const r = play(0, graph([['u', 'traffic'], ['lb', 'lb'], ...backend], ['u>lb', 'lb>web', ...backendWires]))
    expect(r.stars).toBe(0)
    expect(r.missed.join(' ')).toMatch(/scraper requests got through/)
    expect(r.metrics.uptime).toBeLessThan(0.99)
  })

  it('a high limit lets too many scraper requests through', () => {
    const r = play(0, limited({ ...reference, rlLimit: 'high' }))
    expect(r.missed.join(' ')).toMatch(/scraper requests got through/)
  })

  it('a low limit that rejects bursts throttles real users', () => {
    const r = play(0, limited({ ...reference, rlAlgorithm: 'slidingLog', rlLimit: 'low' }))
    expect(r.missed.join(' ')).toMatch(/real users' requests were rate-limited/)
  })

  it('a token bucket absorbs real users’ bursts even at a low limit', () => {
    const r = play(0, limited({ ...reference, rlLimit: 'low' }))
    expect(r.missed).toEqual([])
  })

  it('a leaking bucket at a low limit queues bursts instead of rejecting them', () => {
    const r = play(0, limited({ ...reference, rlAlgorithm: 'leaky', rlLimit: 'low' }))
    expect(r.metrics.throttledRate).toBe(0)
    expect(r.metrics.p50Ms).toBeGreaterThan(play(0, limited(reference)).metrics.p50Ms)
  })
})

describe('Chapter 4 curveball', () => {
  const fix = { rlAlgorithm: 'token', rlLimit: 'low', rlCounters: 'shared' } as const

  it('the main design is overwhelmed when the scrapers multiply', () => {
    expect(play(1, limited(reference)).stars).toBe(0)
  })

  it('an LB plus four limiters with shared counters and a low limit fixes it in two changes', () => {
    const before = limited(reference)
    const after = limited(fix, 4, true)
    expect(changedPieces(before, after)).toBe(2)
    const r = play(1, after)
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
  })

  it('local counters on four limiters let 4× the limit through', () => {
    const r = play(1, limited({ ...fix, rlCounters: 'local' }, 4, true))
    expect(r.stars).toBe(0)
  })

  it('the interviewer flags local counters on several limiters', () => {
    const s = initSim(limited({ ...fix, rlCounters: 'local' }, 4, true), ch, 1)
    expect(reviewDesign(s, chapter4, []).map((n) => n.text).join('\n')).toMatch(/each keep their own counts/)
  })
})
