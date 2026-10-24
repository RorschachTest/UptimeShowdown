import { addFlow, parseKey, TICKS_PER_SEC } from '../flows'
import type { Flows, TsEngine, TsRetention } from '../types'
import { defineComponent } from './shared'

/** Work units per second, per node. */
const NODE_UNITS = 20_000
const NODE_COST = 25
/** A general row store pays an index update per point; a time-series engine appends compressed blocks. */
const WRITE_COST: Record<TsEngine, number> = { rows: 30, timeseries: 1 }
/** Dashboard queries over raw points scan far more data than over downsampled rollups. */
const READ_COST: Record<TsRetention, number> = { raw: 3, downsample: 1 }
/** Keeping every raw point for a year costs much more disk. */
const RETENTION_COST: Record<TsRetention, number> = { raw: 2.5, downsample: 1 }

/** A database for metrics: (series, time) → value, built for heavy writes and range reads. */
export const tsdb = defineComponent({
  kind: 'tsdb',
  label: 'Time-Series DB',
  blurb: 'Stores metric points by series and time, and answers range queries for dashboards.',
  solves: 'Absorbs huge write volumes and reads time ranges fast.',
  worsens: 'Data grows forever unless you downsample and expire it.',
  capacityRps: NODE_UNITS,
  baseLatencyMs: 8,
  costPerMin: NODE_COST,
  serves: ['lookup', 'write'],
  bound: 'storage',
  count: {
    field: 'instances',
    label: 'Nodes',
    min: 1,
    max: 12,
    scrollHint: 'Scroll to add or remove database nodes',
    solves: 'Series are sharded across nodes: more write and read capacity, and a crash loses only a share.',
    worsens: `${NODE_COST}/min each (more with raw retention).`,
  },
  choices: [
    {
      field: 'tsEngine',
      label: 'Engine',
      options: [
        { value: 'rows', label: 'Row table', solves: 'Any SQL database will do.', worsens: 'Every point updates an index: about 30× the write work.' },
        {
          value: 'timeseries',
          label: 'Time-series',
          solves: 'Appends compressed blocks per series: cheap writes, fast time ranges.',
          worsens: 'A specialised database to run.',
        },
      ],
    },
    {
      field: 'tsRetention',
      label: 'Old data',
      options: [
        { value: 'raw', label: 'Keep raw', solves: 'Every point, forever.', worsens: 'Dashboards over weeks scan millions of points; 2.5× the disk.' },
        {
          value: 'downsample',
          label: 'Downsample',
          solves: 'Roll up to 1-minute, then 1-hour points as data ages: small and fast.',
          worsens: 'Old data loses detail.',
        },
      ],
    },
  ],
  summary: ({ instances, config }) =>
    `${instances} node${instances > 1 ? 's' : ''} · ${config.tsEngine === 'timeseries' ? 'time-series engine' : 'row table'} · ${config.tsRetention === 'raw' ? 'raw kept' : 'downsampled'}`,
  cost: ({ instances, config }) => Math.round(NODE_COST * instances * RETENTION_COST[config.tsRetention]),
  review: ({ config }) => {
    const notes: string[] = []
    if (config.tsEngine === 'rows') notes.push('A row table updates an index for every metric point: writes will dominate.')
    if (config.tsRetention === 'raw') notes.push('Keeping raw points forever makes long dashboards slow and storage expensive.')
    return notes
  },
  serve: (node, { instances, inflow, backlog, chapter, buffered }) => {
    const writeCost = WRITE_COST[node.config.tsEngine]
    const readCost = READ_COST[node.config.tsRetention]
    const all: Flows = {}
    for (const [k, p] of Object.entries(backlog)) addFlow(all, k, p.count, p.latencyMs)
    for (const [k, p] of Object.entries(inflow)) addFlow(all, k, p.count, p.latencyMs)
    const isWrite = (k: string) => {
      const [t, step] = parseKey(k)
      return chapter.requestTypes[t]!.needs[step] === 'write'
    }
    const unit = (k: string) => chapter.requestTypes[parseKey(k)[0]]!.weight * (isWrite(k) ? writeCost : readCost)
    const cap = (NODE_UNITS * instances) / TICKS_PER_SEC
    // Dashboard reads first (someone is waiting); writes take the rest and wait when a queue feeds them.
    const entries = Object.entries(all).sort(([a], [b]) => Number(isWrite(a)) - Number(isWrite(b)))
    let left = cap
    let work = 0
    const served: Flows = {}
    const queue: Flows = {}
    const dropped: Record<number, number> = {}
    for (const [k, p] of entries) {
      const u = unit(k)
      work += p.count * u
      const ok = Math.min(p.count, left / u)
      left -= ok * u
      addFlow(served, k, ok, p.latencyMs)
      const rest = p.count - ok
      if (rest <= 0) continue
      if (isWrite(k) && buffered) addFlow(queue, k, rest, p.latencyMs + 100)
      else dropped[parseKey(k)[0]] = (dropped[parseKey(k)[0]] ?? 0) + rest
    }
    const load = work / cap
    return { served, queue, dropped, load, latencyMs: 8 * readCost * (1 + Math.min(load, 2) ** 4), stale: 0 }
  },
})
