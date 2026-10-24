import { addFlow, parseKey, TICKS_PER_SEC } from '../flows'
import type { AggKeys, Flows } from '../types'
import { BUFFER_TICKS, defineComponent, fmtInt } from './shared'

const NODE_EVENTS = 20_000
/** Share of clicks that arrive after their minute closed (phones offline, slow networks). */
const LATE_SHARE = 0.05
/** Share of clicks delivered twice by the at-least-once pipeline upstream. */
const DUPLICATE_SHARE = 0.01
/** Holding windows open for late events delays results by this much. */
const WATERMARK_MS = 15_000
const DEDUPE_CPU = 1.2
/** The busiest node's share over the average: one viral ad lands on one node unless hot keys are split. */
const SKEW: Record<AggKeys, number> = { byAd: 3, split: 1.1 }

/** A stream processor that counts events per key in time windows (Flink-style). */
export const aggregator = defineComponent({
  kind: 'aggregator',
  label: 'Stream Aggregator',
  blurb: 'Reads a stream of events and keeps running counts per key per time window.',
  solves: 'Near-real-time totals without storing and scanning every raw event.',
  worsens: 'Late, duplicated and skewed events all threaten correct counts.',
  capacityRps: NODE_EVENTS,
  baseLatencyMs: 10,
  costPerMin: 20,
  serves: ['aggregate'],
  relays: false,
  bound: 'compute',
  count: {
    field: 'instances',
    label: 'Nodes',
    min: 1,
    max: 30,
    scrollHint: 'Scroll to add or remove aggregator nodes',
    solves: `Each counts about ${fmtInt(NODE_EVENTS)} events a second.`,
    worsens: '20/min each.',
  },
  choices: [
    {
      field: 'aggLate',
      label: 'Late events',
      options: [
        { value: 'drop', label: 'Drop them', solves: 'Each minute’s count is final as soon as the minute ends.', worsens: 'About 5% of clicks arrive late and are never counted.' },
        { value: 'watermark', label: 'Watermark (wait 15 s)', solves: 'Windows stay open a little longer, so late clicks still count.', worsens: 'Results come 15 seconds later.' },
      ],
    },
    {
      field: 'aggDedupe',
      label: 'Exactly-once',
      options: [
        { value: false, label: 'Off', solves: 'No extra work.', worsens: 'Retries upstream deliver about 1% of clicks twice: advertisers are over-billed.' },
        { value: true, label: 'Dedupe by click ID', solves: 'Each click is counted once, even if delivered twice.', worsens: 'About 20% more work per event.' },
      ],
    },
    {
      field: 'aggKeys',
      label: 'Partition by',
      options: [
        { value: 'byAd', label: 'Ad ID', solves: 'Simple: all of an ad’s clicks meet on one node.', worsens: 'A viral ad swamps its node while others idle.' },
        { value: 'split', label: 'Ad ID + salt for hot ads', solves: 'Hot ads are spread over several nodes, then their partial counts are summed.', worsens: 'An extra merge step for hot ads.' },
      ],
    },
  ],
  summary: ({ instances, config }) => `${instances} node${instances > 1 ? 's' : ''} · ${config.aggLate === 'watermark' ? 'watermark' : 'drops late'} · ${config.aggDedupe ? 'exactly-once' : 'at-least-once'}`,
  review: ({ config }) => {
    const notes: string[] = []
    if (config.aggLate === 'drop') notes.push('Dropping late events undercounts clicks, and clicks are money.')
    if (!config.aggDedupe) notes.push('Without dedupe, retried events are counted twice.')
    if (config.aggKeys === 'byAd') notes.push('Partitioning only by ad ID lets one viral ad swamp a single node.')
    return notes
  },
  serve: (node, { instances, inflow, backlog, buffered }) => {
    const { aggLate, aggDedupe, aggKeys } = node.config
    const cap = (NODE_EVENTS * instances) / TICKS_PER_SEC / ((instances > 1 ? SKEW[aggKeys] : 1) * (aggDedupe ? DEDUPE_CPU : 1))
    const all: Flows = {}
    for (const [k, p] of Object.entries(backlog)) addFlow(all, k, p.count, p.latencyMs)
    for (const [k, p] of Object.entries(inflow)) addFlow(all, k, p.count, p.latencyMs)
    const total = Object.values(all).reduce((s, p) => s + p.count, 0)
    const scale = total > cap ? cap / total : 1
    const served: Flows = {}
    const queue: Flows = {}
    const dropped: Record<number, number> = {}
    for (const [k, p] of Object.entries(all)) {
      addFlow(served, k, p.count * scale, p.latencyMs + (aggLate === 'watermark' ? WATERMARK_MS : 0))
      const rest = p.count * (1 - scale)
      if (rest <= 0) continue
      if (buffered && rest <= cap * BUFFER_TICKS) addFlow(queue, k, rest, p.latencyMs + 100)
      else dropped[parseKey(k)[0]] = (dropped[parseKey(k)[0]] ?? 0) + rest
    }
    const counted = Object.values(served).reduce((s, p) => s + p.count, 0)
    const miscounted = counted * ((aggLate === 'drop' ? LATE_SHARE : 0) + (aggDedupe ? 0 : DUPLICATE_SHARE))
    return { served, queue, dropped, load: total / cap, latencyMs: 10, stale: 0, violations: miscounted > 0 ? { miscounted } : undefined }
  },
})
