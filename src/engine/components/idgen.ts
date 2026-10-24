import { serveGeneric } from '../serve'
import type { IdScheme } from '../types'
import { defineComponent, fmtInt } from './shared'

/** Share of IDs issued while a clock runs backwards that repeat an earlier ID. */
const SKEW_COLLISION = 0.05
/** Extra wait when a generator refuses to issue IDs until its clock catches up. */
const SKEW_WAIT_MS = 20

const SCHEMES: Record<IdScheme, { name: string; rps: number }> = {
  ticket: { name: 'ticket server', rps: 1500 },
  multimaster: { name: 'multi-master, step k', rps: 1500 },
  uuid: { name: 'UUID', rps: 50_000 },
  snowflake: { name: 'Snowflake', rps: 50_000 },
}

/** A service that hands out unique IDs, using one of the classic schemes. */
export const idgen = defineComponent({
  kind: 'idgen',
  label: 'ID Generator',
  blurb: 'Hands out a unique ID for every new order, message or upload.',
  solves: 'One place that guarantees no two things get the same ID.',
  worsens: 'Every new record now depends on it: it must never be down or slow.',
  capacityRps: 50_000,
  baseLatencyMs: 1,
  costPerMin: 10,
  serves: ['id'],
  relays: false,
  count: {
    field: 'instances',
    label: 'Servers',
    min: 1,
    max: 10,
    scrollHint: 'Scroll to add or remove ID servers',
    solves: 'More throughput, and survives a server crashing.',
    worsens: '10/min each. Some schemes hand out duplicates with more than one server.',
  },
  choices: [
    {
      field: 'idScheme',
      label: 'Scheme',
      options: [
        { value: 'ticket', label: 'Ticket server', solves: 'One database counter: unique, 64-bit and in order.', worsens: 'One box: about 1,500 IDs/s, and a second copy counts from 1 too.' },
        { value: 'multimaster', label: 'Multi-master', solves: 'k databases, each stepping by k: more throughput, still 64-bit.', worsens: 'IDs from different servers are not in time order, and changing k is painful.' },
        { value: 'uuid', label: 'UUID', solves: 'Generated anywhere with no coordination; collisions are practically impossible.', worsens: '128 bits, not numbers, and not sortable by time.' },
        { value: 'snowflake', label: 'Snowflake', solves: '64 bits: timestamp + machine ID + sequence. Unique, sortable, no coordination.', worsens: 'Relies on clocks: a clock running backwards can repeat IDs.' },
      ],
    },
    {
      field: 'idClock',
      label: 'If the clock goes back',
      options: [
        { value: 'trust', label: 'Keep going', solves: 'Never pauses.', worsens: 'Can reuse timestamps it already used: duplicate IDs.' },
        { value: 'wait', label: 'Wait it out', solves: 'Refuses to issue until the clock passes its last timestamp: never a duplicate.', worsens: 'A short stall while the clock catches up.' },
      ],
    },
  ],
  summary: ({ instances, config }) => `${SCHEMES[config.idScheme].name} · ${fmtInt(SCHEMES[config.idScheme].rps * instances)} IDs/s`,
  review: ({ instances, config }) => {
    const notes: string[] = []
    if (config.idScheme === 'ticket' && instances > 1) notes.push('Several ticket servers each count from 1: they will hand out the same IDs.')
    if (config.idScheme === 'snowflake' && config.idClock === 'trust') notes.push('If a server’s clock jumps back, Snowflake can repeat IDs it already issued.')
    return notes
  },
  serve: (node, ctx) => {
    const { idScheme, idClock } = node.config
    const k = ctx.instances
    const scheme = SCHEMES[idScheme]
    const base = serveGeneric(node, { ...ctx, instances: (k * scheme.rps) / idgen.capacityRps })
    const issued = Object.values(base.served).reduce((s, p) => s + p.count, 0)
    // The clock event hits one server: its share of the IDs.
    const skewed = ctx.active.some((e) => e.kind === 'clockSkew') ? issued / k : 0

    const v: Record<string, number> = {}
    if (idScheme === 'ticket' && k > 1) v.duplicateId = issued * (1 - 1 / k)
    if (idScheme === 'multimaster' && k > 1) v.unordered = issued * (1 - 1 / k)
    if (idScheme === 'uuid') {
      v.tooLong = issued
      v.unordered = issued
    }
    if (idScheme === 'snowflake' && idClock === 'trust' && skewed > 0) v.duplicateId = skewed * SKEW_COLLISION
    const stall = idScheme === 'snowflake' && idClock === 'wait' && skewed > 0 ? (SKEW_WAIT_MS * skewed) / Math.max(issued, 1) : 0
    return { ...base, latencyMs: base.latencyMs + stall, violations: v }
  },
})
