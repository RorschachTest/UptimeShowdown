import { describe, expect, it } from 'vitest'
import { changedPieces } from '../engine/interview'
import type { NodeConfig } from '../engine/types'
import { blockers, graph, playJudged, type N } from './test-suite'
import { v2chapter8 } from './v2chapter8'

const ch = v2chapter8.chapter
const wires = ['u>lb', 'lb>web', 'web>c', 'c>kv', 'web>q', 'u>q', 'q>w', 'w>p', 'w>kv']
const KV = { kvCopies: 3, kvWrite: 'quorum', kvRead: 'quorum', kvConflict: 'vclock' } as const
const P = { providerRetry: 'retry', providerDedupe: true } as const
const design = (kv = 4, workers = 2, kvc: Partial<NodeConfig> = KV, p: Partial<NodeConfig> = P, apps = 7): N[] => [
  ['u', 'traffic'],
  ['lb', 'lb'],
  ['web', 'app', apps],
  ['c', 'cache'],
  ['q', 'queue'],
  ['w', 'worker', workers],
  ['p', 'provider', 1, p],
  ['kv', 'kvstore', kv, kvc],
]
const play = (stage: number, nodes: N[], w = wires) => playJudged(ch, stage, nodes, w)
const missed = (stage: number, nodes: N[]) => play(stage, nodes).missed.join(' ')

describe('V2 Chapter 8 main run', () => {
  it('seven web servers, a quorum mailbox store on four nodes and retrying SMTP workers earn three stars', () => {
    const r = play(0, design())
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
    expect(r.cost).toBe(ch.stages[0]!.referenceCost)
  })
  it('giving up on a down mail server loses email', () => expect(missed(0, design(4, 2, KV, { providerRetry: 'drop' }))).toMatch(/emails were lost/))
  it('retrying without message IDs delivers some twice', () => expect(missed(0, design(4, 2, KV, { providerRetry: 'retry' }))).toMatch(/delivered twice/))
  it('three mailbox nodes have no headroom when one is cut off', () => expect(missed(0, design(3))).toMatch(/emails were lost/))
  it('waiting for every copy fails writes during the cut-off', () => expect(play(0, design(4, 2, { ...KV, kvWrite: 'all' })).stars).toBe(0))
  it('six web servers cannot open every inbox', () => expect(play(0, design(4, 2, KV, P, 6)).metrics.uptime).toBeLessThan(0.99))
})

describe('V2 Chapter 8 curveball', () => {
  it('newsletter Monday overwhelms the main design', () => expect(play(1, design()).stars).toBe(0))

  it('more mailbox nodes and more SMTP workers fix it in two changes', () => {
    const fixed = design(9, 7)
    expect(changedPieces(graph(design(), wires), graph(fixed, wires))).toBeLessThanOrEqual(v2chapter8.editBudget)
    const r = play(1, fixed)
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
  })

  it('more workers alone overload the mailbox store', () => expect(play(1, design(4, 7)).stars).toBe(0))
})

describe('V2 Chapter 8 rules', () => {
  it('the reference designs are legal', () => {
    expect(blockers(ch, 0, design(), wires)).toEqual([])
    expect(blockers(ch, 1, design(9, 7), wires)).toEqual([])
  })
  it('incoming mail never goes through the web servers', () => {
    // Without the direct SMTP wire, incoming mail has no path: web servers don't relay it.
    expect(blockers(ch, 0, design(), wires.filter((w) => w !== 'u>q')).join(' ')).toMatch(/Nothing in your design can serve "Incoming email"/)
  })
  it('blocks inbox reads that skip the cache', () => expect(blockers(ch, 0, design(), [...wires, 'web>kv']).join(' ')).toMatch(/check a cache before the mailbox store/))
  it('blocks a design with no mailbox store', () => {
    const nodes = design().filter(([id]) => id !== 'kv')
    expect(blockers(ch, 0, nodes, wires.filter((w) => !w.includes('kv'))).join(' ')).toMatch(/replicated store/)
  })
})
