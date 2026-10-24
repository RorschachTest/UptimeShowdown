import { describe, expect, it } from 'vitest'
import { changedPieces, reviewDesign } from '../engine/interview'
import { initSim } from '../engine/simulator'
import type { NodeConfig } from '../engine/types'
import { chapter12 } from './chapter12'
import { blockers, graph, playJudged, type N } from './test-suite'

const ch = chapter12.chapter
const wires = ['u>ws', 'ws>g', 'g>kv', 'u>lb', 'lb>api', 'api>kv']
const KV = { kvCopies: 3, kvWrite: 'quorum', kvRead: 'quorum', kvConflict: 'vclock' } as const
const WS = { wsAssign: 'leastConn', wsReconnect: 'jitter' } as const
const design = (ws = 9, kv = 8, wsc: Partial<NodeConfig> = WS, ids: Partial<NodeConfig> = { idScheme: 'snowflake', idClock: 'wait' }, apps = 4): N[] => [
  ['u', 'traffic'],
  ['ws', 'wsgateway', ws, wsc],
  ['g', 'idgen', 2, ids],
  ['kv', 'kvstore', kv, KV],
  ['lb', 'lb'],
  ['api', 'app', apps],
]
const play = (stage: number, nodes: N[], w = wires) => playJudged(ch, stage, nodes, w)

describe('Chapter 12 main run', () => {
  it('nine chat servers with service discovery and jittered reconnects earn three stars', () => {
    const r = play(0, design())
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
    expect(r.cost).toBe(ch.stages[0]!.referenceCost)
  })
  it('reconnecting at once causes a storm, even with spare servers', () => {
    for (const n of [9, 12]) expect(play(0, design(n, 8, { ...WS, wsReconnect: 'immediate' })).metrics.uptime).toBeLessThan(0.99)
  })
  it('random placement overfills some servers', () => expect(play(0, design(9, 8, { ...WS, wsAssign: 'random' })).stars).toBe(0))
  it('eight servers have no room for the crashed one’s users', () => expect(play(0, design(8)).stars).toBe(0))
  it('UUID message IDs are not ordered', () => expect(play(0, design(9, 8, WS, { idScheme: 'uuid' })).missed.join(' ')).toMatch(/out of order/))
})

describe('Chapter 12 curveball', () => {
  it('New Year overwhelms the main design', () => expect(play(1, design()).stars).toBe(0))

  it('more chat servers and a bigger message store fix it in two changes', () => {
    const fixed = design(17, 20)
    expect(changedPieces(graph(design(), wires), graph(fixed, wires))).toBeLessThanOrEqual(chapter12.editBudget)
    const r = play(1, fixed)
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
  })

  it('more chat servers alone leave the store short', () => expect(play(1, design(17, 8)).stars).toBe(0))

  it('the interviewer flags immediate reconnects and random placement', () => {
    const notes = reviewDesign(initSim(graph(design(9, 8, { wsAssign: 'random', wsReconnect: 'immediate' }), wires), ch, 0), chapter12, [])
    const text = notes.map((n) => n.text).join('\n')
    expect(text).toMatch(/hammer the surviving servers/)
    expect(text).toMatch(/much fuller/)
  })
})

describe('Chapter 12 rules', () => {
  it('the reference designs are legal', () => {
    expect(blockers(ch, 0, design(), wires)).toEqual([])
    expect(blockers(ch, 1, design(17, 20), wires)).toEqual([])
  })
  it('blocks a design with no WebSocket servers', () =>
    expect(blockers(ch, 0, design().filter(([id]) => id !== 'ws'), ['g>kv', 'u>lb', 'lb>api', 'api>kv']).join(' ')).toMatch(/live WebSocket connection/))
  it('blocks messages without IDs', () => expect(blockers(ch, 0, design(), ['u>ws', 'ws>kv', 'u>lb', 'lb>api', 'api>kv', 'g>kv']).join(' ')).toMatch(/Nothing in your design can serve "Message"/))
})
