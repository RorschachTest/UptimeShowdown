import { addFlow, parseKey, TICKS_PER_SEC } from '../flows'
import type { BoardStore, Flows } from '../types'
import { defineComponent } from './shared'

/** Memory per shard, GB. */
const SHARD_GB = 32
const SHARD_COST = 30
const STORES: Record<BoardStore, { name: string; ops: number; rankCost: number; latencyMs: number }> = {
  // A rank is ORDER BY over every player: each one costs about 100 simple reads.
  sql: { name: 'SQL table', ops: 2000, rankCost: 100, latencyMs: 40 },
  zset: { name: 'sorted set', ops: 40_000, rankCost: 1, latencyMs: 1 },
}
/** With shards by score range, most players sit in the low-score shards: the busiest gets this × its share of writes. */
const SCORE_SHARD_SKEW = 1.5

/** Keeps every player's score in order, so top-10 and "my rank" are cheap. */
export const leaderboard = defineComponent({
  kind: 'leaderboard',
  label: 'Leaderboard Store',
  blurb: 'Keeps every player’s score sorted, for the top 10 and each player’s rank.',
  solves: 'Answers “top 10” and “what’s my rank?” without sorting everyone each time.',
  worsens: 'All scores must fit in memory and stay correct when a node dies.',
  capacityRps: 40_000,
  baseLatencyMs: 1,
  costPerMin: SHARD_COST,
  serves: ['lookup', 'write'],
  bound: 'storage',
  failover: (node) => node.config.boardReplica,
  crashLoses: 'lostScores',
  count: {
    field: 'instances',
    label: 'Shards',
    min: 1,
    max: 10,
    scrollHint: 'Scroll to add or remove shards',
    solves: `Each shard adds ${SHARD_GB} GB of memory and its own throughput.`,
    worsens: `${SHARD_COST}/min each (twice that with a replica). Ranks now span several shards.`,
  },
  choices: [
    {
      field: 'boardStore',
      label: 'Store',
      options: [
        { value: 'sql', label: 'SQL + ORDER BY', solves: 'Familiar; scores are on disk.', worsens: 'Every rank sorts millions of rows: slow and expensive.' },
        { value: 'zset', label: 'Sorted set', solves: 'An in-memory skip list: add a score or get a rank in O(log n).', worsens: 'Lives in memory: size it for every player, and keep a copy.' },
      ],
    },
    {
      field: 'boardShard',
      label: 'Split shards by',
      options: [
        { value: 'hash', label: 'Player hash', solves: 'Even spread of players and writes.', worsens: 'Top 10 and every rank must ask all shards and merge (scatter-gather).' },
        { value: 'score', label: 'Score range', solves: 'Top 10 reads only the top shard; a rank is one shard plus the counts above it.', worsens: 'Low-score shards are busier, and a player moves shard as their score grows.' },
      ],
    },
    {
      field: 'boardReplica',
      label: 'Replica',
      options: [
        { value: false, label: 'None', solves: 'Half the price.', worsens: 'If a shard dies, its scores are gone.' },
        { value: true, label: 'With failover', solves: 'A replica takes over in seconds with every score intact.', worsens: 'Twice the price.' },
      ],
    },
  ],
  summary: ({ instances, config }) =>
    `${STORES[config.boardStore].name} · ${instances} × ${SHARD_GB} GB${config.boardReplica ? ' + replicas' : ''}`,
  cost: ({ instances, config }) => SHARD_COST * instances * (config.boardReplica ? 2 : 1),
  review: ({ instances, config }) => {
    const notes: string[] = []
    if (config.boardStore === 'sql') notes.push('Ranking with ORDER BY sorts every player on every request.')
    if (!config.boardReplica) notes.push('No replica: a dead shard takes its scores with it.')
    if (instances > 1 && config.boardShard === 'hash') notes.push('With player-hash shards, every top-10 and rank query must ask every shard.')
    return notes
  },
  serve: (node, { instances, inflow, chapter, stage }) => {
    const store = STORES[node.config.boardStore]
    const { boardShard } = node.config
    const shards = instances
    const scatter = node.instances > 1 && boardShard === 'hash' ? node.instances : 1
    const skew = node.instances > 1 && boardShard === 'score' ? SCORE_SHARD_SKEW : 1
    // In-memory sorted sets refuse writes for players that don't fit.
    const ws = stage.workingSetGb
    const fits = node.config.boardStore === 'zset' && ws ? Math.min(1, (shards * SHARD_GB) / ws) : 1

    let work = 0
    for (const [k, p] of Object.entries(inflow)) {
      const [t, step] = parseKey(k)
      const read = chapter.requestTypes[t]!.needs[step] === 'lookup'
      work += p.count * (read ? store.rankCost * scatter : skew)
    }
    const cap = (store.ops * shards) / TICKS_PER_SEC
    const load = work / cap
    const scale = (load > 1 ? 1 / load : 1) * fits

    const served: Flows = {}
    const dropped: Record<number, number> = {}
    for (const [k, p] of Object.entries(inflow)) {
      const t = parseKey(k)[0]
      addFlow(served, k, p.count * scale, p.latencyMs)
      dropped[t] = (dropped[t] ?? 0) + p.count * (1 - scale)
    }
    const latencyMs = store.latencyMs * (1 + Math.min(load, 2) ** 4) + (scatter > 1 ? 2 * scatter : 0)
    return { served, queue: {}, dropped, load, latencyMs, stale: 0 }
  },
})

