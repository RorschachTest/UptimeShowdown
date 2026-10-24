import { parseKey, TICKS_PER_SEC } from '../flows'
import { serveGeneric } from '../serve'
import type { WalletTx } from '../types'
import { defineComponent, fmtInt } from './shared'

const SHARD_TPS = 10_000
/** Throughput per shard by how cross-shard transfers are kept atomic. */
const SPEED: Record<WalletTx, number> = { none: 1, twoPhase: 0.4, saga: 0.66, eventSourcing: 1 }
const EXTRA_MS: Record<WalletTx, number> = { none: 0, twoPhase: 30, saga: 10, eventSourcing: 5 }
/** Seconds of cross-shard transfers in flight when a shard dies. */
const IN_FLIGHT_S = 1

/** Account balances sharded across databases, with a policy for transfers that touch two shards. */
export const wallet = defineComponent({
  kind: 'wallet',
  label: 'Wallet Ledger',
  blurb: 'Holds every account’s balance, sharded by account, and moves money between accounts.',
  solves: 'Scales balance transfers by adding shards.',
  worsens: 'A transfer between accounts on different shards is no longer one local transaction.',
  capacityRps: SHARD_TPS,
  baseLatencyMs: 5,
  costPerMin: 30,
  serves: ['write', 'lookup'],
  needsRouter: true,
  bound: 'storage',
  count: {
    field: 'instances',
    label: 'Shards',
    min: 1,
    max: 20,
    scrollHint: 'Scroll to add or remove shards',
    solves: `Each handles about ${fmtInt(SHARD_TPS)} balance updates a second.`,
    worsens: '30/min each. More shards, more transfers cross shards.',
  },
  choices: [
    {
      field: 'walletTx',
      label: 'Cross-shard transfers',
      options: [
        { value: 'none', label: 'Two separate updates', solves: 'Fast and simple.', worsens: 'If a shard dies between the debit and the credit, money vanishes or appears.' },
        { value: 'twoPhase', label: 'Two-phase commit', solves: 'Both shards commit or neither does.', worsens: 'Locks held across shards: much slower, and a dead participant blocks transfers.' },
        { value: 'saga', label: 'Saga (compensate)', solves: 'Each step commits locally; a failed step runs a compensating step.', worsens: 'Briefly inconsistent; compensation logic for every step.' },
        { value: 'eventSourcing', label: 'Event sourcing', solves: 'Validated commands go to an append-only log; balances are rebuilt by replaying it. Crash = replay.', worsens: 'A different way of thinking; reads need snapshots.' },
      ],
    },
  ],
  summary: ({ instances, config }) => `${instances} shard${instances > 1 ? 's' : ''} · ${{ none: 'no atomicity', twoPhase: '2PC', saga: 'saga', eventSourcing: 'event sourcing' }[config.walletTx]}`,
  review: ({ config }) => (config.walletTx === 'none' ? ['Two independent updates per transfer: a crash in between creates or destroys money.'] : []),
  serve: (node, ctx) => {
    const tx = node.config.walletTx
    const res = serveGeneric(node, { ...ctx, instances: ctx.instances * SPEED[tx] })
    // Most transfers touch two shards when accounts are spread over many.
    const cross = node.instances > 1 ? 1 - 1 / node.instances : 0
    let transfers = 0
    for (const [k, p] of Object.entries(res.served)) {
      const [t, step] = parseKey(k)
      if (ctx.chapter.requestTypes[t]!.needs[step] === 'write') transfers += p.count
    }
    const v: Record<string, number> = {}
    if (ctx.fired.some((e) => e.kind === 'crash') && tx === 'none') v.moneyImbalance = transfers * TICKS_PER_SEC * IN_FLIGHT_S * cross
    // Two-phase commit blocks transfers involving the dead shard until it returns.
    if (tx === 'twoPhase' && ctx.active.some((e) => e.kind === 'crash')) {
      for (const [k, p] of Object.entries(res.served)) {
        const [t, step] = parseKey(k)
        if (ctx.chapter.requestTypes[t]!.needs[step] !== 'write') continue
        const blocked = p.count * (2 / node.instances)
        p.count -= blocked
        res.dropped[t] = (res.dropped[t] ?? 0) + blocked
      }
    }
    return { ...res, latencyMs: res.latencyMs + EXTRA_MS[tx], violations: v }
  },
})
