import { addFlow, parseKey, TICKS_PER_SEC } from '../flows'
import type { Flows } from '../types'
import { defineComponent, fmtInt, TIER_CAPACITY, TIER_COST, tierSetting, type ChoiceSetting } from './shared'

const READ_RPS = 1000
const WRITE_RPS = 200
const REPLICA_COST = 30
/** Row locks hold writes in line: each costs about twice as much throughput, plus waiting. */
const LOCK_COST = 2
const LOCK_WAIT_MS = 20
/** Each lost race is retried: extra work grows with how often writes collide. */
const RETRY_COST = 3

const readRouting: ChoiceSetting<'readRouting'> = {
  field: 'readRouting',
  label: 'Send reads to',
  gate: 'readRouting',
  options: [
    { value: 'primary', label: 'Primary', solves: 'Everyone sees the latest data.', worsens: 'Replicas sit idle; the primary takes every read.' },
    { value: 'replicas', label: 'Replicas', solves: 'Spreads all reads across the replicas.', worsens: 'Replicas lag: people may not see the post they just wrote.' },
    {
      value: 'ryw',
      label: 'Own writes → primary',
      solves: "Reads of a user's own posts stay on the primary; everything else uses replicas.",
      worsens: 'The primary still takes those reads plus every write.',
    },
  ],
}

/** A primary (reads + writes) plus read replicas, routed by the read-routing setting. */
export const sqldb = defineComponent({
  kind: 'sqldb',
  label: 'SQL Database',
  blurb: 'The durable home for users and posts.',
  solves: 'Data survives restarts. One source of truth.',
  worsens: 'About 1,000 reads/s and 200 writes/s per box, and every write hits the primary.',
  capacityRps: 0,
  baseLatencyMs: 10,
  costPerMin: 40,
  maxUtil: 1.2,
  serves: ['lookup', 'write'],
  tiered: true,
  bound: 'storage',
  choices: [
    tierSetting,
    readRouting,
    {
      field: 'dbConcurrency',
      label: 'Racing writes',
      gate: 'booking',
      options: [
        { value: 'none', label: 'No control', solves: 'No extra work.', worsens: 'Two people can both take the last room: double bookings.' },
        { value: 'pessimistic', label: 'Lock rows', solves: 'SELECT … FOR UPDATE: the second booking waits for the first.', worsens: 'Locked rows halve write throughput and add waiting.' },
        { value: 'optimistic', label: 'Version check', solves: 'Update only if the version is unchanged (or a constraint holds); the loser retries.', worsens: 'Under heavy contention, retries pile up.' },
      ],
    },
  ],
  count: {
    field: 'replicas',
    label: 'Read replicas',
    min: 0,
    max: 5,
    gate: 'replicas',
    scrollHint: 'Scroll to add or remove read replicas',
    solves: 'Read-only copies of the database that take reads off the primary.',
    worsens: 'They lag behind the primary. 30/min each (× size).',
  },
  summary: ({ config }) => {
    const m = TIER_CAPACITY[config.tier]
    const r = config.replicas
    return `${fmtInt(READ_RPS * m)} reads, ${fmtInt(WRITE_RPS * m)} writes/s${r ? ` + ${r} replica${r > 1 ? 's' : ''}` : ''}`
  },
  cost: ({ config }) => Math.round((40 + config.replicas * REPLICA_COST) * TIER_COST[config.tier]),
  serve: (node, { inflow, chapter }) => {
    const m = TIER_CAPACITY[node.config.tier]
    const readCap = (READ_RPS * m) / TICKS_PER_SEC
    const writeCap = (WRITE_RPS * m) / TICKS_PER_SEC
    const { replicas, readRouting: routing } = node.config

    // Share of each read flow that goes to replicas.
    const replicaShare = (t: number) => {
      if (replicas === 0) return 0
      if (routing === 'replicas') return replicas / (1 + replicas)
      if (routing === 'ryw') return chapter.requestTypes[t]!.consistency === 'ryw' ? 0 : 1
      return 0
    }

    let primaryReads = 0
    let replicaReads = 0
    let writes = 0
    const entries = Object.entries(inflow).map(([k, p]) => {
      const [t, step] = parseKey(k)
      const isRead = chapter.requestTypes[t]!.needs[step] === 'lookup'
      const share = isRead ? replicaShare(t) : 0
      if (isRead) {
        primaryReads += p.count * (1 - share)
        replicaReads += p.count * share
      } else writes += p.count
      return { k, t, p, share }
    })

    // Concurrency control turns racing writes into extra work instead of double bookings.
    const conflicts = Math.max(0, ...chapter.requestTypes.map((rt) => rt.conflicts ?? 0))
    const cc = node.config.dbConcurrency
    const writeWork = cc === 'pessimistic' ? LOCK_COST : cc === 'optimistic' ? 1 + RETRY_COST * conflicts : 1
    const primaryUtil = primaryReads / readCap + (writes * writeWork) / writeCap
    const replicaUtil = replicas > 0 ? replicaReads / (readCap * replicas) : 0
    const sp = primaryUtil > 1.2 ? 1.2 / primaryUtil : 1
    const sr = replicaUtil > 1.2 ? 1.2 / replicaUtil : 1

    const served: Flows = {}
    const dropped: Record<number, number> = {}
    let stale = 0
    for (const { k, t, p, share } of entries) {
      const ok = p.count * ((1 - share) * sp + share * sr)
      addFlow(served, k, ok, p.latencyMs)
      dropped[t] = (dropped[t] ?? 0) + p.count - ok
      // Replicas lag the primary: a user reading their own write there may not see it.
      if (chapter.requestTypes[t]!.consistency === 'ryw') stale += p.count * share * sr
    }
    const load = Math.max(primaryUtil, replicaUtil)
    // Without control, racing bookings for the same last room both succeed.
    let doubled = 0
    if (cc === 'none') for (const { k, t } of entries) if (chapter.requestTypes[t]!.needs[parseKey(k)[1]] === 'write') doubled += (served[k]?.count ?? 0) * (chapter.requestTypes[t]!.conflicts ?? 0)
    return {
      served,
      queue: {},
      dropped,
      load,
      latencyMs: 10 * (1 + Math.min(load, 2) ** 4) + (cc === 'pessimistic' ? LOCK_WAIT_MS : 0),
      stale,
      violations: doubled > 0 ? { doubleBooked: doubled } : undefined,
    }
  },
})
