import { parseKey, TICKS_PER_SEC } from '../flows'
import { serveGeneric } from '../serve'
import type { BrokerAcks } from '../types'
import { defineComponent, fmtInt } from './shared'

/** Messages per second a broker can write (each replica copy counts). */
const BROKER_MSGS = 50_000
/** Producer wait by acknowledgement mode: none, the partition leader, or every in-sync replica. */
const ACK_MS: Record<BrokerAcks, number> = { none: 1, leader: 3, all: 8 }
/** Seconds of recent messages lost when a broker dies, by acks (with replicas): unacked buffer, or the unreplicated tail. */
const LOSS_S: Record<BrokerAcks, number> = { none: 2, leader: 0.5, all: 0 }

/** A distributed log (Kafka-style): topics split into partitions, spread and replicated over brokers. */
export const broker = defineComponent({
  kind: 'broker',
  label: 'Message Brokers',
  blurb: 'A cluster that stores messages in partitioned, replicated logs until consumers read them.',
  solves: 'Producers and consumers scale and fail independently; nothing is lost if configured right.',
  worsens: 'Every guarantee (durability, ordering, exactly-once) costs latency or throughput.',
  capacityRps: BROKER_MSGS,
  baseLatencyMs: 2,
  costPerMin: 20,
  serves: ['enqueue'],
  buffers: true,
  bound: 'storage',
  count: {
    field: 'instances',
    label: 'Brokers',
    min: 1,
    max: 20,
    scrollHint: 'Scroll to add or remove brokers',
    solves: `Each writes about ${fmtInt(BROKER_MSGS)} message copies a second; partitions spread across them.`,
    worsens: '20/min each.',
  },
  choices: [
    {
      field: 'brokerReplicas',
      label: 'Replication factor',
      options: [
        { value: 1, label: '1', solves: 'Every message written once: the most throughput.', worsens: 'A dead broker takes its partitions offline, and its unread messages with it.' },
        { value: 3, label: '3', solves: 'Each partition has a leader and two followers; a follower takes over if the leader dies.', worsens: 'Every message is written three times.' },
      ],
    },
    {
      field: 'brokerAcks',
      label: 'Producer waits for',
      options: [
        { value: 'none', label: 'Nothing (acks=0)', solves: 'Fastest.', worsens: 'Messages still in a buffer are lost when a broker dies.' },
        { value: 'leader', label: 'The leader (acks=1)', solves: 'Fast, and written to one broker.', worsens: 'If the leader dies before followers copy it, the tail is lost.' },
        { value: 'all', label: 'All replicas (acks=all)', solves: 'A message is acknowledged only once every in-sync replica has it: no loss.', worsens: 'Slower producers.' },
      ],
    },
    {
      field: 'brokerCommit',
      label: 'Consumers commit offsets',
      options: [
        { value: 'before', label: 'Before processing', solves: 'Never processes a message twice (at-most-once).', worsens: 'A consumer that crashes mid-batch loses that batch.' },
        { value: 'after', label: 'After processing', solves: 'Never loses a message (at-least-once).', worsens: 'A crashed batch is processed again: consumers must be idempotent.' },
      ],
    },
  ],
  summary: ({ instances, config }) => `${instances} broker${instances > 1 ? 's' : ''} · RF ${config.brokerReplicas} · acks=${config.brokerAcks === 'none' ? '0' : config.brokerAcks === 'leader' ? '1' : 'all'}`,
  review: ({ config }) => {
    const notes: string[] = []
    if (config.brokerReplicas === 1) notes.push('Replication factor 1: losing a broker loses its partitions.')
    if (config.brokerAcks !== 'all') notes.push('Producers that don’t wait for all replicas can lose acknowledged messages.')
    if (config.brokerCommit === 'before') notes.push('Committing before processing loses a crashed consumer’s batch.')
    return notes
  },
  serve: (node, ctx) => {
    const { brokerAcks, brokerReplicas } = node.config
    const res = serveGeneric(node, { ...ctx, instances: ctx.instances / brokerReplicas })
    const rate = Object.values(ctx.inflow).reduce((s, p) => s + p.count, 0) * TICKS_PER_SEC
    const share = 1 / node.instances
    let lost = 0
    if (ctx.fired.some((e) => e.kind === 'crash')) {
      // The dead broker's share: with one copy, its whole backlog; with replicas, only the unreplicated tail.
      const backlog = Object.values(ctx.backlog).reduce((s, p) => s + p.count, 0)
      lost = brokerReplicas === 1 ? backlog * share + rate * share * 5 : rate * share * LOSS_S[brokerAcks]
    }
    // While a broker is down with one copy, its partitions can't take writes: producers get errors.
    const down = brokerReplicas === 1 && ctx.active.some((e) => e.kind === 'crash')
    if (down) {
      for (const [k, p] of Object.entries(res.served)) {
        const t = parseKey(k)[0]
        res.dropped[t] = (res.dropped[t] ?? 0) + p.count * share
        p.count *= 1 - share
      }
    }
    return { ...res, latencyMs: res.latencyMs + ACK_MS[brokerAcks], violations: lost > 0 ? { lostMessages: lost } : undefined }
  },
})
