import { describe, expect, it } from 'vitest'
import { changedPieces } from '../engine/interview'
import type { NodeConfig } from '../engine/types'
import { blockers, graph, playJudged, type N } from './test-suite'
import { v2chapter11 } from './v2chapter11'

const ch = v2chapter11.chapter
const wires = ['u>lb', 'lb>api', 'api>q', 'q>w', 'w>l', 'l>psp']
const KV = { kvCopies: 3, kvWrite: 'quorum', kvRead: 'quorum', kvConflict: 'vclock' } as const
const P = { providerRetry: 'retry', providerDedupe: true } as const
const design = (apps = 2, workers = 1, ledger = 3, p: Partial<NodeConfig> = P, idem = true): N[] => [
  ['u', 'traffic'],
  ['lb', 'lb'],
  ['api', 'app', apps, { appIdempotent: idem }],
  ['q', 'queue'],
  ['w', 'worker', workers],
  ['l', 'kvstore', ledger, KV],
  ['psp', 'provider', 1, p],
]
const play = (stage: number, nodes: N[]) => playJudged(ch, stage, nodes, wires)
const missed = (stage: number, nodes: N[]) => play(stage, nodes).missed.join(' ')

describe('V2 Chapter 11 main run', () => {
  it('idempotent API, queued executors, a quorum ledger and retries with keys earn three stars', () => {
    const r = play(0, design())
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
    expect(r.cost).toBe(ch.stages[0]!.referenceCost)
  })
  it('giving up during the PSP outage loses payments', () => expect(missed(0, design(2, 1, 3, { providerRetry: 'drop' }))).toMatch(/payments were lost/))
  it('retrying without an idempotency key charges twice', () => expect(missed(0, design(2, 1, 3, { providerRetry: 'retry' }))).toMatch(/charged twice by retries/))
  it('no idempotency key on the API charges double submits twice', () => expect(missed(0, design(2, 1, 3, P, false))).toMatch(/double submits/))
})

describe('V2 Chapter 11 curveball', () => {
  it('Black Friday overwhelms the main design', () => expect(play(1, design()).stars).toBe(0))

  it('more servers, executors and ledger nodes fix it in three changes', () => {
    const fixed = design(6, 3, 4)
    expect(changedPieces(graph(design(), wires), graph(fixed, wires))).toBeLessThanOrEqual(v2chapter11.editBudget)
    const r = play(1, fixed)
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
  })
})

describe('V2 Chapter 11 rules', () => {
  it('the reference designs are legal', () => {
    expect(blockers(ch, 0, design(), wires)).toEqual([])
    expect(blockers(ch, 1, design(6, 3, 4), wires)).toEqual([])
  })
  it('blocks a design with no payment provider', () =>
    expect(blockers(ch, 0, design().filter(([id]) => id !== 'psp'), wires.slice(0, 5)).join(' ')).toMatch(/outside payment provider/))
  it('blocks charging before the payment is recorded', () =>
    expect(blockers(ch, 0, design(), ['u>lb', 'lb>api', 'api>q', 'q>w', 'w>psp', 'psp>l']).join(' ')).toMatch(/Nothing in your design can serve "Payment"/))
})
