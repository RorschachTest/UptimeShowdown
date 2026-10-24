import { TICKS_PER_SEC } from '../flows'
import { serveGeneric } from '../serve'
import type { CacheHashing, CacheSize } from '../types'
import { defineComponent } from './shared'

const SIZES: Record<CacheSize, { hitRate: number; cost: number; gb: number }> = {
  S: { hitRate: 0.6, cost: 10, gb: 16 },
  M: { hitRate: 0.85, cost: 20, gb: 32 },
  L: { hitRate: 0.95, cost: 40, gb: 64 },
}
/** Hit rate when the whole working set fits in the cluster. */
const FULL_HIT = 0.97
/** Seconds for a cooled cache to win back most of its hits (time constant). */
const WARM_TAU_S = 5

/**
 * How each scheme spreads keys. `skew`: the busiest node's share over the average (it fills and saturates first).
 * `moved(n, d)`: share of keys that land on a different node when the cluster goes from n to n + d nodes.
 */
const HASHING: Record<CacheHashing, { name: string; skew: number; moved: (n: number, d: number) => number }> = {
  mod: { name: 'key mod N', skew: 1, moved: (n, d) => 1 - 1 / Math.max(n, n + d) },
  ring: { name: 'hash ring', skew: 1.3, moved: (n, d) => 1 / Math.max(n, n + d) },
  vnodes: { name: 'ring + virtual nodes', skew: 1.02, moved: (n, d) => 1 / Math.max(n, n + d) },
}

export const cache = defineComponent({
  kind: 'cache',
  label: 'Cache',
  blurb: 'Keeps hot data in memory, between your servers and the database.',
  solves: 'Answers most reads in about 1 ms and shields the database.',
  worsens: 'A second copy of the data that can be out of date.',
  capacityRps: 50_000,
  baseLatencyMs: 1,
  costPerMin: 0,
  serves: ['lookup'],
  partial: true,
  bound: 'storage',
  count: {
    field: 'instances',
    label: 'Nodes',
    min: 1,
    max: 10,
    gate: 'cacheNodes',
    scrollHint: 'Scroll to add or remove cache nodes',
    solves: 'Split the data across nodes: more memory and throughput, and losing one loses only its share.',
    worsens: 'Each node costs its memory size. Clients must agree which node holds each key.',
  },
  choices: [
    {
      field: 'cacheSize',
      label: 'Memory',
      options: [
        { value: 'S', label: 'S', solves: '16 GB. About 60% of reads answered alone. 10/min.', worsens: 'The least memory per node.' },
        { value: 'M', label: 'M', solves: '32 GB. About 85% of reads answered alone. 20/min.', worsens: 'Costs twice as much as S.' },
        { value: 'L', label: 'L', solves: '64 GB. About 95% of reads answered alone: the hot set fits. 40/min.', worsens: 'Costs four times S, and losing one big node loses more.' },
      ],
    },
    {
      field: 'writeStrategy',
      label: 'On write',
      options: [
        {
          value: 'aside',
          label: 'Cache-aside',
          solves: 'Simple; if the cache dies, reads just get slower.',
          worsens: "Can return an old copy right after a user's own write.",
        },
        { value: 'through', label: 'Write-through', solves: 'Writes update the cache too, so reads stay fresh.', worsens: 'Every write does extra work.' },
      ],
    },
    {
      field: 'cacheHashing',
      label: 'Find the node by',
      gate: 'hashing',
      options: [
        { value: 'mod', label: 'Key mod N', solves: 'Simple and perfectly even.', worsens: 'Add or lose one node and almost every key moves: the database gets every read at once.' },
        { value: 'ring', label: 'Hash ring', solves: 'A node joining or leaving moves only its neighbour’s share of keys (about 1/N).', worsens: 'With few points on the ring, some nodes own far more keys than others.' },
        { value: 'vnodes', label: 'Ring + vnodes', solves: 'Each node takes many points on the ring: even shares and only ~1/N keys move.', worsens: 'A bigger ring table to keep in sync on every client.' },
      ],
    },
  ],
  hitRate: (c) => SIZES[c.cacheSize].hitRate,
  summary: ({ instances, config }) =>
    instances > 1
      ? `${instances} × ${config.cacheSize} (${instances * SIZES[config.cacheSize].gb} GB) · ${HASHING[config.cacheHashing].name}`
      : `${config.cacheSize} · ~${Math.round(SIZES[config.cacheSize].hitRate * 100)}% hits · ${config.writeStrategy === 'through' ? 'write-through' : 'cache-aside'}`,
  cost: ({ instances, config }) => SIZES[config.cacheSize].cost * instances,
  review: ({ instances, config }) => {
    if (instances < 2) return []
    if (config.cacheHashing === 'mod') return ['Key mod N: when a cache node joins or leaves, almost every key moves and the database takes every read at once.']
    if (config.cacheHashing === 'ring') return ['A plain hash ring with few nodes is lumpy: one node can own far more keys than the rest.']
    return []
  },
  serve: (node, ctx) => {
    const size = SIZES[node.config.cacheSize]
    const scheme = HASHING[node.config.cacheHashing]
    let live = ctx.state?.live ?? node.instances
    let warm = ctx.state?.warm ?? 1
    // Nodes joining or leaving remap keys; remapped keys miss until they're loaded again.
    for (const ev of ctx.fired) {
      const d = ev.kind === 'nodeLeave' ? -1 : ev.kind === 'nodeJoin' ? 1 : 0
      if (d === 0) continue
      warm *= 1 - scheme.moved(live, d)
      live = Math.max(1, live + d)
    }
    warm += (1 - warm) / (WARM_TAU_S * TICKS_PER_SEC)

    const skew = live > 1 ? scheme.skew : 1
    const ws = ctx.stage.workingSetGb
    const coverage = ws ? Math.min(1, (live * size.gb) / (ws * skew)) : 1
    const hitRate = (ws ? FULL_HIT * coverage : size.hitRate) * warm
    // The busiest node saturates first, so lumpy hashing wastes capacity.
    const instances = Math.max(1, live - (node.instances - ctx.instances)) / skew
    return { ...serveGeneric(node, { ...ctx, instances }), hitRate, state: { live, warm } }
  },
})
