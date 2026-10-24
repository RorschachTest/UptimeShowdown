import { addFlow, parseKey, TICKS_PER_SEC } from '../flows'
import type { Flows, Quorum } from '../types'
import { defineComponent, fmtInt, type OptionDef } from './shared'

const NODE_OPS = 2500
const NODE_COST = 15
/** Share of reads that come right after the same user's write (a cart viewed just after adding to it). */
const RECENT_READ = 0.1
/** Latency multiplier for waiting on more replicas: the slowest one sets the pace. */
const WAIT: Record<Quorum, number> = { one: 1, quorum: 1.5, all: 3 }

export const acks = (q: Quorum, n: number) => (q === 'one' ? 1 : q === 'all' ? n : Math.floor(n / 2) + 1)

const choose = (n: number, k: number): number => {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return r
}

/** Chance that fewer than `need` of a key's `copies` replicas are reachable when `cut` of `nodes` are cut off. */
export function unreachable(copies: number, need: number, nodes: number, cut: number): number {
  if (cut <= 0) return 0
  let p = 0
  for (let u = copies - need + 1; u <= copies; u++) p += (choose(cut, u) * choose(nodes - cut, copies - u)) / choose(nodes, copies)
  return p
}

/** Chance a read of R replicas misses all W that took the latest write (no overlap when R + W ≤ N). */
export const staleChance = (n: number, w: number, r: number) => choose(n - w, r) / choose(n, r)

const quorumOptions = (verb: string): OptionDef<Quorum>[] => [
  { value: 'one', label: 'One', solves: `Fastest, and ${verb}s keep working while replicas are cut off.`, worsens: 'Unless the other side waits for enough replicas, reads can miss the latest write.' },
  { value: 'quorum', label: 'Quorum', solves: `Waits for a majority: survives a minority of replicas being unreachable.`, worsens: `A little slower than one; ${verb}s fail if most replicas are cut off.` },
  { value: 'all', label: 'All', solves: 'Every replica has it before you answer.', worsens: `Slowest, and one unreachable replica makes the ${verb} fail.` },
]

/** A Dynamo-style store: keys spread over nodes on a ring, each kept on N replicas, with tunable quorums. */
export const kvstore = defineComponent({
  kind: 'kvstore',
  label: 'Key-Value Store',
  blurb: 'A cluster that spreads keys over nodes and keeps several copies of each.',
  solves: 'Scales reads and writes by adding nodes; copies survive failures.',
  worsens: 'You choose between consistency and availability when the network splits.',
  capacityRps: NODE_OPS,
  baseLatencyMs: 2,
  costPerMin: NODE_COST,
  serves: ['lookup', 'write'],
  bound: 'storage',
  count: {
    field: 'instances',
    label: 'Nodes',
    min: 1,
    max: 20,
    scrollHint: 'Scroll to add or remove nodes',
    solves: `Each node adds ${fmtInt(NODE_OPS)} replica operations a second.`,
    worsens: `${NODE_COST}/min each.`,
  },
  choices: [
    {
      field: 'kvCopies',
      label: 'Copies (N)',
      options: [
        { value: 1, label: '1', solves: 'Cheapest: every operation touches one node.', worsens: 'Lose that node and its keys are gone.' },
        { value: 3, label: '3', solves: 'Survives losing a node or a rack.', worsens: 'Every write is done three times.' },
        { value: 5, label: '5', solves: 'Survives two nodes or racks failing at once.', worsens: 'Every write is done five times.' },
      ],
    },
    { field: 'kvWrite', label: 'Writes wait for (W)', options: quorumOptions('write') },
    { field: 'kvRead', label: 'Reads wait for (R)', options: quorumOptions('read') },
    {
      field: 'kvConflict',
      label: 'Concurrent writes',
      options: [
        { value: 'lww', label: 'Last write wins', solves: 'Simple: keep the newest timestamp.', worsens: 'The other write is silently thrown away.' },
        { value: 'vclock', label: 'Vector clocks', solves: 'Detects concurrent versions and keeps both for the app to merge.', worsens: 'Bigger values and a merge step on read.' },
      ],
    },
  ],
  summary: ({ instances, config }) => {
    const n = config.kvCopies
    return `${instances} nodes · N=${n} W=${acks(config.kvWrite, n)} R=${acks(config.kvRead, n)}`
  },
  validate: ({ instances, config }) =>
    config.kvCopies > instances ? `Key-Value Store: ${config.kvCopies} copies need at least ${config.kvCopies} nodes, one per copy.` : null,
  review: ({ config }) => {
    const n = config.kvCopies
    const w = acks(config.kvWrite, n)
    const r = acks(config.kvRead, n)
    const notes: string[] = []
    if (n > 1 && r + w <= n) notes.push(`R + W = ${r + w} is not more than N = ${n}: a read can miss the latest write.`)
    if (n > 1 && (config.kvWrite === 'all' || config.kvRead === 'all')) notes.push('Waiting for all replicas: one unreachable replica fails the request.')
    if (config.kvConflict === 'lww') notes.push('Last write wins silently drops one of two concurrent writes.')
    return notes
  },
  serve: (node, { instances, inflow, chapter, active }) => {
    const { kvCopies: n, kvWrite, kvRead, kvConflict } = node.config
    const copies = Math.min(n, instances)
    const w = acks(kvWrite, copies)
    const r = acks(kvRead, copies)
    const cut = Math.min(
      instances - 1,
      active.filter((e) => e.kind === 'partition').reduce((s, e) => s + (e.count ?? 1), 0),
    )
    const live = instances - cut
    const failRead = unreachable(copies, r, instances, cut)
    const failWrite = unreachable(copies, w, instances, cut)
    const stale = staleChance(copies, w, r)

    const isRead = (k: string) => {
      const [t, step] = parseKey(k)
      return chapter.requestTypes[t]!.needs[step] === 'lookup'
    }
    let work = 0
    let reads = 0
    let all = 0
    for (const [k, p] of Object.entries(inflow)) {
      const read = isRead(k)
      work += p.count * (read ? r : copies)
      if (read) reads += p.count
      all += p.count
    }
    const cap = (NODE_OPS * live) / TICKS_PER_SEC
    const load = work / cap
    const scale = load > 1 ? 1 / load : 1

    const served: Flows = {}
    const dropped: Record<number, number> = {}
    let staleCount = 0
    let lost = 0
    for (const [k, p] of Object.entries(inflow)) {
      const [t] = parseKey(k)
      const rt = chapter.requestTypes[t]!
      const read = isRead(k)
      const ok = p.count * scale * (1 - (read ? failRead : failWrite))
      addFlow(served, k, ok, p.latencyMs)
      dropped[t] = (dropped[t] ?? 0) + p.count - ok
      if (read && rt.consistency === 'ryw') staleCount += ok * RECENT_READ * stale
      if (!read && kvConflict === 'lww') lost += ok * (rt.conflicts ?? 0)
    }
    const readShare = all > 0 ? reads / all : 0
    const wait = readShare * WAIT[kvRead] + (1 - readShare) * WAIT[kvWrite]
    const latencyMs = 2 * wait * (1 + Math.min(load, 2) ** 4) + (kvConflict === 'vclock' ? 1 : 0)
    return { served, queue: {}, dropped, load, latencyMs, stale: staleCount, violations: lost > 0 ? { lostWrite: lost } : undefined, state: { live } }
  },
})
