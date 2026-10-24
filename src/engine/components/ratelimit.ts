import { addFlow, parseKey, TICKS_PER_SEC } from '../flows'
import { serveGeneric } from '../serve'
import type { Flows, RlAlgorithm, RlLimit } from '../types'
import { defineComponent } from './shared'

/** Requests per second each client may send. */
export const RL_LIMITS: Record<RlLimit, number> = { low: 2, medium: 10, high: 50 }
const SHARED_COUNTER_COST = 10
const SHARED_COUNTER_MS = 1
/** Share of a bursty client's requests that arrive in its bursts. */
const BURST_SHARE = 0.3
/** Extra wait a leaking bucket adds when a client bursts far over its limit. */
const LEAKY_MAX_DELAY_MS = 400

/** How each algorithm treats a client: how far over the limit leaks through, and whether bursts are absorbed. */
const ALGORITHMS: Record<RlAlgorithm, { name: string; leak: number; burstFriendly: boolean; extraCost: number }> = {
  token: { name: 'token bucket', leak: 1, burstFriendly: true, extraCost: 0 },
  leaky: { name: 'leaking bucket', leak: 1, burstFriendly: true, extraCost: 0 },
  fixed: { name: 'fixed window', leak: 1.5, burstFriendly: false, extraCost: 0 },
  slidingLog: { name: 'sliding log', leak: 1, burstFriendly: false, extraCost: 10 },
  slidingCounter: { name: 'sliding counter', leak: 1.05, burstFriendly: false, extraCost: 0 },
}

export const ratelimit = defineComponent({
  kind: 'ratelimit',
  label: 'Rate Limiter',
  blurb: 'Caps how many requests each client may send, before they reach your servers.',
  solves: 'Stops scrapers and floods cheaply, and spreads the rest across the servers behind it.',
  worsens: 'Set it too tight and real users get "429 Too Many Requests".',
  capacityRps: 20_000,
  baseLatencyMs: 1,
  costPerMin: 15,
  does: 'caps each client’s rate',
  serves: [],
  balances: true,
  bound: 'network',
  needsRouter: true,
  count: {
    field: 'instances',
    label: 'Instances',
    min: 1,
    max: 10,
    scrollHint: 'Scroll to add or remove limiter instances',
    solves: 'More limiters handle more traffic and survive one failing.',
    worsens: 'Each keeps its own counts unless counters are shared. 15/min each.',
  },
  choices: [
    {
      field: 'rlAlgorithm',
      label: 'Algorithm',
      options: [
        {
          value: 'token',
          label: 'Token bucket',
          solves: 'Allows short bursts up to the limit, then a steady rate. Simple and cheap.',
          worsens: 'Two knobs (bucket size, refill rate) to tune per client.',
        },
        {
          value: 'leaky',
          label: 'Leaking bucket',
          solves: 'Smooths bursts into a steady outflow; nothing over the limit is rejected straight away.',
          worsens: 'Bursty users wait in a queue: adds latency.',
        },
        {
          value: 'fixed',
          label: 'Fixed window',
          solves: 'The simplest counter: N requests per clock minute.',
          worsens: 'A burst at the edge of two windows lets up to 2× through.',
        },
        {
          value: 'slidingLog',
          label: 'Sliding log',
          solves: 'Exact: keeps a timestamp per request.',
          worsens: 'Memory-hungry: +10/min. Rejects real users who burst.',
        },
        {
          value: 'slidingCounter',
          label: 'Sliding counter',
          solves: 'Nearly exact and cheap: blends this window and the last.',
          worsens: 'An approximation, and still rejects real users who burst.',
        },
      ],
    },
    {
      field: 'rlLimit',
      label: 'Limit per client',
      options: [
        { value: 'low', label: '2/s', solves: 'Scrapers barely get through.', worsens: 'Bursty real users hit it unless bursts are allowed.' },
        { value: 'medium', label: '10/s', solves: 'Room for normal users and their bursts.', worsens: 'Many scrapers × 10/s still adds up.' },
        { value: 'high', label: '50/s', solves: 'Real users never notice it.', worsens: 'Scrapers get plenty through.' },
      ],
    },
    {
      field: 'rlCounters',
      label: 'Counters',
      options: [
        {
          value: 'local',
          label: 'In each instance',
          solves: 'No extra hop or store.',
          worsens: 'With N instances, each counts on its own: clients get N× the limit.',
        },
        {
          value: 'shared',
          label: 'Shared (Redis)',
          solves: 'One count per client across all instances, updated atomically.',
          worsens: '+1 ms per request and +10/min for the store.',
        },
      ],
    },
  ],
  summary: ({ instances, config }) =>
    `${RL_LIMITS[config.rlLimit]}/s per client · ${ALGORITHMS[config.rlAlgorithm].name}${
      instances > 1 ? ` · ${config.rlCounters === 'shared' ? 'shared' : 'local'} counters` : ''
    }`,
  cost: ({ instances, config }) =>
    15 * instances + ALGORITHMS[config.rlAlgorithm].extraCost + (config.rlCounters === 'shared' ? SHARED_COUNTER_COST : 0),
  serve: (node, ctx) => {
    // The limiter's own capacity first, then the per-client limit on what it handled.
    const base = serveGeneric(node, ctx)
    const alg = ALGORITHMS[node.config.rlAlgorithm]
    // Local counters: each instance sees 1/N of a client's requests, so the client gets N× the limit.
    const limit = RL_LIMITS[node.config.rlLimit] * (node.config.rlCounters === 'local' ? ctx.instances : 1)
    const served: Flows = {}
    const rejected: Record<number, number> = {}

    for (const [k, p] of Object.entries(base.served)) {
      const t = parseKey(k)[0]
      const rt = ctx.chapter.requestTypes[t]!
      const clients = ctx.stage.clients?.[rt.id]
      let pass = 1
      let delayMs = 0
      if (clients) {
        // Per-client rate of this type, from what reached the limiter this tick.
        const totalOfType = Object.entries(ctx.inflow).reduce((s, [kk, pp]) => (parseKey(kk)[0] === t ? s + pp.count : s), 0)
        const perClient = (totalOfType * TICKS_PER_SEC) / clients
        const peak = perClient * (rt.burst ?? 1)
        pass = Math.min(1, (limit * alg.leak) / perClient)
        if (peak > limit && pass >= 1) {
          if (alg.burstFriendly) {
            if (node.config.rlAlgorithm === 'leaky') delayMs = LEAKY_MAX_DELAY_MS * BURST_SHARE * (1 - limit / peak)
          } else pass = 1 - BURST_SHARE * (1 - limit / peak)
        }
      }
      addFlow(served, k, p.count * pass, p.latencyMs + delayMs + (node.config.rlCounters === 'shared' ? SHARED_COUNTER_MS : 0))
      rejected[t] = (rejected[t] ?? 0) + p.count * (1 - pass)
    }
    return { ...base, served, rejected }
  },
  review: (node) =>
    node.instances > 1 && node.config.rlCounters === 'local'
      ? [`${node.instances} rate limiters each keep their own counts, so every client effectively gets ${node.instances}× the limit.`]
      : [],
})
