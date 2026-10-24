import { TICKS_PER_SEC } from '../flows'
import { serveGeneric } from '../serve'
import type { PubsubHashing } from '../types'
import { defineComponent, fmtInt } from './shared'

/** Deliveries (one message to one subscriber) per second, per server. */
const DELIVERIES = 100_000
/** Seconds for subscribers of a moved channel to notice and resubscribe on its new server. */
const RESUBSCRIBE_S = 5
const MOVED: Record<PubsubHashing, (n: number) => number> = { mod: (n) => 1 - 1 / n, ring: (n) => 1 / n }

/** A pub/sub cluster: one channel per user; publishing sends the message to everyone subscribed. */
export const pubsub = defineComponent({
  kind: 'pubsub',
  label: 'Pub/Sub',
  blurb: 'A channel per user: publish once, and every subscriber gets a copy.',
  solves: 'Fans updates out to exactly the people who care, in real time.',
  worsens: 'Every publish costs one delivery per subscriber, and channels live on specific servers.',
  capacityRps: DELIVERIES,
  baseLatencyMs: 2,
  costPerMin: 20,
  serves: ['publish'],
  relays: false,
  bound: 'network',
  count: {
    field: 'instances',
    label: 'Servers',
    min: 1,
    max: 20,
    scrollHint: 'Scroll to add or remove pub/sub servers',
    solves: `Each delivers about ${fmtInt(DELIVERIES)} messages a second.`,
    worsens: '20/min each. Resizing moves channels between servers.',
  },
  choices: [
    {
      field: 'pubsubHashing',
      label: 'Place channels by',
      options: [
        { value: 'mod', label: 'Key mod N', solves: 'Simple.', worsens: 'Add a server and almost every channel moves: subscribers everywhere miss updates while they resubscribe.' },
        { value: 'ring', label: 'Hash ring', solves: 'Adding a server moves only about 1/N of the channels.', worsens: 'Clients need the ring (kept in service discovery).' },
      ],
    },
  ],
  summary: ({ instances, config }) => `${instances} server${instances > 1 ? 's' : ''} · ${fmtInt(instances * DELIVERIES)} deliveries/s · ${config.pubsubHashing === 'ring' ? 'hash ring' : 'key mod N'}`,
  review: ({ config }) => (config.pubsubHashing === 'mod' ? ['Placing channels by key mod N moves almost all of them when the cluster grows.'] : []),
  serve: (node, ctx) => {
    // Each publish costs one delivery per subscriber.
    // shortcut: uses the largest fanout of any request type (one publishing type per chapter so far); make it per type when a chapter needs two.
    let live = ctx.state?.live ?? node.instances
    let moved = ctx.state?.moved ?? 0
    for (const ev of ctx.fired) {
      if (ev.kind !== 'nodeJoin') continue
      live += 1
      moved = MOVED[node.config.pubsubHashing](live)
    }
    // Moved channels recover as subscribers resubscribe.
    moved = Math.max(0, moved - 1 / (RESUBSCRIBE_S * TICKS_PER_SEC))
    const fanout = Math.max(...ctx.chapter.requestTypes.map((rt) => rt.fanout ?? 1))
    const res = serveGeneric(node, { ...ctx, instances: (live - (node.instances - ctx.instances)) / fanout })
    const published = Object.values(res.served).reduce((s, p) => s + p.count, 0)
    return { ...res, state: { live, moved }, violations: moved > 0 ? { missedUpdates: published * moved } : undefined }
  },
})
