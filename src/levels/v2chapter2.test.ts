import { describe, expect, it } from 'vitest'
import { changedPieces, reviewDesign } from '../engine/interview'
import { initSim } from '../engine/simulator'
import type { PubsubHashing } from '../engine/types'
import { blockers, graph, playJudged, type N } from './test-suite'
import { v2chapter2 } from './v2chapter2'

const ch = v2chapter2.chapter
const wires = ['u>ws', 'ws>ps', 'ps>db', 'u>lb', 'lb>api', 'api>c', 'c>db']
const design = (ws = 7, ps = 4, pubsubHashing: PubsubHashing = 'ring', db = 1): N[] => [
  ['u', 'traffic'],
  ['ws', 'wsgateway', ws, { wsAssign: 'leastConn', wsReconnect: 'jitter' }],
  ['ps', 'pubsub', ps, { pubsubHashing }],
  ['db', 'tsdb', db, { tsEngine: 'timeseries', tsRetention: 'downsample' }],
  ['lb', 'lb'],
  ['api', 'app', 2],
  ['c', 'cache'],
]
const play = (stage: number, nodes: N[], w = wires) => playJudged(ch, stage, nodes, w)
const missed = (stage: number, nodes: N[]) => play(stage, nodes).missed.join(' ')

describe('V2 Chapter 2 main run', () => {
  it('seven WebSocket servers and four ring-placed pub/sub servers earn three stars', () => {
    const r = play(0, design())
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
    expect(r.cost).toBe(ch.stages[0]!.referenceCost)
  })
  it('key mod N moves almost every channel when a server is added', () => expect(missed(0, design(7, 4, 'mod'))).toMatch(/missed while channels moved/))
  it('three pub/sub servers cannot deliver 40 copies of every update', () => expect(missed(0, design(7, 3))).toMatch(/updates were lost/))
  it('six WebSocket servers cannot hold everyone', () => expect(play(0, design(6)).metrics.uptime).toBeLessThan(0.99))
})

describe('V2 Chapter 2 curveball', () => {
  it('the festival overwhelms the main design', () => expect(play(1, design()).stars).toBe(0))

  it('more WebSocket servers, pub/sub servers and history nodes fix it in three changes', () => {
    const fixed = design(13, 8, 'ring', 2)
    expect(changedPieces(graph(design(), wires), graph(fixed, wires))).toBeLessThanOrEqual(v2chapter2.editBudget)
    const r = play(1, fixed)
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
  })

  it('the interviewer flags key mod N', () => {
    const notes = reviewDesign(initSim(graph(design(7, 4, 'mod'), wires), ch, 0), v2chapter2, [])
    expect(notes.map((n) => n.text).join('\n')).toMatch(/moves almost all of them/)
  })
})

describe('V2 Chapter 2 rules', () => {
  it('the reference designs are legal', () => {
    expect(blockers(ch, 0, design(), wires)).toEqual([])
    expect(blockers(ch, 1, design(13, 8, 'ring', 2), wires)).toEqual([])
  })
  it('blocks a design with no pub/sub', () => expect(blockers(ch, 0, design().filter(([id]) => id !== 'ps'), ['u>ws', 'ws>db', 'u>lb', 'lb>api', 'api>c', 'c>db']).join(' ')).toMatch(/pub\/sub channel per user/))
  it('blocks location updates with no live connection', () =>
    expect(blockers(ch, 0, design().filter(([id]) => id !== 'ws'), ['ps>db', 'u>lb', 'lb>api', 'api>c', 'c>db']).join(' ')).toMatch(/Nothing in your design can serve "Location update"/))
})
