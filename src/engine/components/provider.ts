import { addFlow, parseKey } from '../flows'
import { BUFFER_TICKS, serveGeneric } from '../serve'
import type { Flows } from '../types'
import { defineComponent } from './shared'

/** Share of retried messages the provider had already delivered before the failure was seen: sent twice. */
const RETRY_DUPLICATES = 0.02

/** A third-party delivery service (push, SMS, email). Its limits and outages are not yours to fix. */
export const provider = defineComponent({
  kind: 'provider',
  label: 'Delivery Provider',
  blurb: 'An outside service (push, SMS or email) that delivers the message to the user.',
  solves: 'Delivery to phones and inboxes without running it yourself.',
  worsens: 'It has rate limits and outages you can’t control.',
  capacityRps: 20_000,
  baseLatencyMs: 80,
  costPerMin: 0,
  serves: ['deliver'],
  relays: false,
  bound: 'network',
  choices: [
    {
      field: 'providerRetry',
      label: 'When it fails',
      options: [
        { value: 'drop', label: 'Give up', solves: 'Simple; nothing piles up.', worsens: 'Every message sent during an outage is lost.' },
        { value: 'retry', label: 'Retry with backoff', solves: 'Failed messages wait and go out when the provider recovers.', worsens: 'Some get delivered twice unless each has an idempotency key.' },
      ],
    },
    {
      field: 'providerDedupe',
      label: 'Idempotency key',
      options: [
        { value: false, label: 'None', solves: 'Nothing to store.', worsens: 'A retried message the provider already sent goes out again.' },
        { value: true, label: 'Per message', solves: 'The provider ignores a message ID it has already delivered.', worsens: 'You must generate and keep an ID for every message.' },
      ],
    },
  ],
  summary: ({ config }) => `${config.providerRetry === 'retry' ? 'retries' : 'no retries'} · ${config.providerDedupe ? 'idempotent' : 'no dedupe'}`,
  review: ({ config }) => {
    if (config.providerRetry === 'drop') return ['Without retries, every message sent while the provider is down is lost.']
    if (!config.providerDedupe) return ['Retries without an idempotency key can notify people twice.']
    return []
  },
  serve: (node, ctx) => {
    const retry = node.config.providerRetry === 'retry'
    const down = ctx.active.some((e) => e.kind === 'outage')
    const held = Object.values(ctx.backlog).reduce((s, p) => s + p.count, 0)
    if (down) {
      // Nothing goes out; retries wait (up to a minute's worth), the rest is lost.
      const queue: Flows = {}
      const dropped: Record<number, number> = {}
      for (const [k, p] of [...Object.entries(ctx.backlog), ...Object.entries(ctx.inflow)]) {
        if (retry) addFlow(queue, k, p.count, p.latencyMs + 100)
        else dropped[parseKey(k)[0]] = (dropped[parseKey(k)[0]] ?? 0) + p.count
      }
      return { served: {}, queue, dropped, load: 0, latencyMs: 0, stale: 0 }
    }
    const res = serveGeneric(node, ctx, retry ? BUFFER_TICKS : 0)
    const sent = Object.values(res.served).reduce((s, p) => s + p.count, 0)
    const total = held + Object.values(ctx.inflow).reduce((s, p) => s + p.count, 0)
    const retried = total > 0 ? (sent * held) / total : 0
    const dupes = node.config.providerDedupe ? 0 : retried * RETRY_DUPLICATES
    return { ...res, violations: dupes > 0 ? { duplicateSends: dupes } : undefined }
  },
})
