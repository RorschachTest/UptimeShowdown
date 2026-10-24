import { serveGeneric } from '../serve'
import type { MatchState } from '../types'
import { defineComponent, fmtInt } from './shared'

/** Orders per second one engine matches, and the time each takes, by where the order book lives. */
const STATE: Record<MatchState, { ops: number; ms: number }> = { database: { ops: 2_000, ms: 5 }, memory: { ops: 200_000, ms: 0.05 } }
/** Share of orders matched out of their true arrival order when threads race (no sequencer). */
const RACED = 0.005
const SEQUENCER_MS = 0.05

/** The matching engine: keeps each symbol’s order book and matches buy and sell orders. */
export const matcher = defineComponent({
  kind: 'matcher',
  label: 'Matching Engine',
  blurb: 'Keeps the order book for each stock and matches buy and sell orders, fairly and fast.',
  solves: 'Trades happen in microseconds, in exactly the order orders arrived.',
  worsens: 'One engine per symbol group: it must be very fast, deterministic and never lose its book.',
  capacityRps: 200_000,
  baseLatencyMs: 0.05,
  costPerMin: 40,
  serves: ['match'],
  relays: false,
  bound: 'compute',
  failover: (node) => node.config.matchStandby,
  crashLoses: 'lostOrders',
  count: {
    field: 'instances',
    label: 'Engines',
    min: 1,
    max: 10,
    scrollHint: 'Scroll to add or remove matching engines',
    solves: 'Symbols are split across engines; each matches its own symbols.',
    worsens: '40/min each (twice with a hot standby).',
  },
  choices: [
    {
      field: 'matchState',
      label: 'Order book',
      options: [
        { value: 'database', label: 'In a database', solves: 'Durable by default.', worsens: 'Every order is a database round trip: ~5 ms and ~2,000 orders/s.' },
        { value: 'memory', label: 'In memory + event log', solves: 'Microseconds per order; the sequenced log makes it durable and replayable.', worsens: 'Needs the log and a standby to survive crashes.' },
      ],
    },
    {
      field: 'matchOrder',
      label: 'Order of matching',
      options: [
        { value: 'arrival', label: 'As threads receive them', solves: 'No extra step.', worsens: 'Racing threads match some orders out of turn: unfair, and replay gives a different result.' },
        { value: 'sequencer', label: 'Sequencer stamps', solves: 'Every order gets a sequence number on arrival; matching follows it exactly.', worsens: 'One more hop (tens of microseconds).' },
      ],
    },
    {
      field: 'matchStandby',
      label: 'Hot standby',
      options: [
        { value: false, label: 'None', solves: 'Half the price.', worsens: 'A crash loses the in-memory order book and stops trading.' },
        { value: true, label: 'Replays the log', solves: 'A standby applies the same sequenced events and takes over in milliseconds.', worsens: 'Twice the machines.' },
      ],
    },
  ],
  summary: ({ instances, config }) => `${instances} engine${instances > 1 ? 's' : ''} · ${config.matchState === 'memory' ? 'in-memory' : 'database'} · ${fmtInt(STATE[config.matchState].ops * instances)} orders/s`,
  cost: ({ instances, config }) => 40 * instances * (config.matchStandby ? 2 : 1),
  review: ({ config }) => {
    const notes: string[] = []
    if (config.matchState === 'database') notes.push('A database round trip per order is far too slow for an exchange.')
    if (config.matchOrder === 'arrival') notes.push('Without a sequencer, racing threads match some orders out of turn.')
    if (!config.matchStandby) notes.push('No standby: a crash loses the order book.')
    return notes
  },
  serve: (node, ctx) => {
    const st = STATE[node.config.matchState]
    const res = serveGeneric(node, { ...ctx, instances: (ctx.instances * st.ops) / matcher.capacityRps })
    const matched = Object.values(res.served).reduce((s, p) => s + p.count, 0)
    const latencyMs = st.ms * (1 + Math.min(res.load, 2) ** 4) + (node.config.matchOrder === 'sequencer' ? SEQUENCER_MS : 0)
    return { ...res, latencyMs, violations: node.config.matchOrder === 'arrival' && matched > 0 ? { unfairFills: matched * RACED } : undefined }
  },
})
