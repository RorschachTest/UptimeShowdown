import { describe, expect, it } from 'vitest'
import { changedPieces, reviewDesign } from '../engine/interview'
import { initSim } from '../engine/simulator'
import type { NodeConfig } from '../engine/types'
import { blockers, graph, playJudged, type N } from './test-suite'
import { v2chapter5 } from './v2chapter5'

const ch = v2chapter5.chapter
const wires = ['u>q', 'q>w', 'w>db', 'u>lb', 'lb>web', 'web>c', 'c>db']
const ok = { tsEngine: 'timeseries', tsRetention: 'downsample' } as const
const design = (workers = 2, nodes = 2, db: Partial<NodeConfig> = ok, apps = 2): N[] => [
  ['u', 'traffic'],
  ['q', 'queue'],
  ['w', 'worker', workers],
  ['db', 'tsdb', nodes, db],
  ['lb', 'lb'],
  ['web', 'app', apps],
  ['c', 'cache'],
]
const play = (stage: number, nodes: N[], w = wires) => playJudged(ch, stage, nodes, w)
const missed = (stage: number, nodes: N[]) => play(stage, nodes).missed.join(' ')

describe('V2 Chapter 5 main run', () => {
  it('a queue, two consumers and a downsampled time-series DB on two nodes earn three stars', () => {
    const r = play(0, design())
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
    expect(r.cost).toBe(ch.stages[0]!.referenceCost)
  })
  it('a row table drowns in index updates', () => expect(missed(0, design(2, 4, { ...ok, tsEngine: 'rows' }))).toMatch(/metric points were lost/))
  it('keeping raw points forever blows the budget', () => expect(play(0, design(2, 2, { ...ok, tsRetention: 'raw' })).stars).toBeLessThan(2))
  it('one database node loses points when it crashes', () => expect(missed(0, design(2, 1))).toMatch(/metric points were lost/))
  it('one consumer falls behind', () => expect(missed(0, design(1))).toMatch(/Background work took/))
})

describe('V2 Chapter 5 curveball', () => {
  it('the incident overwhelms the main design', () => expect(play(1, design()).stars).toBe(0))

  it('more consumers and more query servers fix it in two changes', () => {
    const fixed = design(9, 2, ok, 9)
    expect(changedPieces(graph(design(), wires), graph(fixed, wires))).toBeLessThanOrEqual(v2chapter5.editBudget)
    const r = play(1, fixed)
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
  })

  it('more consumers alone leave dashboards failing', () => expect(missed(1, design(10, 2, ok, 2))).toMatch(/Uptime/))

  it('the interviewer flags a row table and raw retention', () => {
    const notes = reviewDesign(initSim(graph(design(2, 2, { tsEngine: 'rows', tsRetention: 'raw' }), wires), ch, 0), v2chapter5, [])
    const text = notes.map((n) => n.text).join('\n')
    expect(text).toMatch(/updates an index for every metric point/)
    expect(text).toMatch(/raw points forever/)
  })
})

describe('V2 Chapter 5 rules', () => {
  it('the reference designs are legal', () => {
    expect(blockers(ch, 0, design(), wires)).toEqual([])
    expect(blockers(ch, 1, design(9, 2, ok, 9), wires)).toEqual([])
  })
  it('blocks a design with no time-series DB', () => {
    const nodes = design().filter(([id]) => id !== 'db')
    expect(blockers(ch, 0, nodes, ['u>q', 'q>w', 'u>lb', 'lb>web', 'web>c']).join(' ')).toMatch(/time-series database/)
  })
  it('blocks pieces this chapter has not unlocked', () => expect(blockers(ch, 0, [...design(), ['k', 'kvstore', 3]], [...wires, 'web>k']).join(' ')).toMatch(/Key-Value Store isn't available/))
})
