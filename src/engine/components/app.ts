import { parseKey } from '../flows'
import { serveGeneric } from '../serve'
import { defineComponent, tierSetting } from './shared'

export const app = defineComponent({
  kind: 'app',
  label: 'Web Server',
  blurb: 'Runs your code and builds pages.',
  solves: 'Add instances to handle more traffic.',
  worsens: 'Users only reach one instance unless a load balancer sits in front.',
  capacityRps: 500,
  baseLatencyMs: 20,
  costPerMin: 10,
  queueTicks: 2,
  serves: ['compute', 'static'],
  relays: false,
  tiered: true,
  choices: [
    tierSetting,
    {
      field: 'appIdempotent',
      label: 'Idempotency key',
      gate: 'idempotency',
      options: [
        { value: false, label: 'None', solves: 'Nothing to store.', worsens: 'A double click or a retry after a timeout creates a second reservation.' },
        { value: true, label: 'Per request', solves: 'The client sends a unique key; a repeat with the same key returns the first result.', worsens: 'Keys must be stored and checked.' },
      ],
    },
  ],
  serve: (node, ctx) => {
    const res = serveGeneric(node, ctx)
    if (node.config.appIdempotent) return res
    // Requests the client sent twice go through twice.
    let repeated = 0
    for (const [k, p] of Object.entries(res.served)) repeated += p.count * (ctx.chapter.requestTypes[parseKey(k)[0]]!.resubmits ?? 0)
    return repeated > 0 ? { ...res, violations: { duplicateBookings: repeated } } : res
  },
  needsRouter: true,
  count: {
    field: 'instances',
    label: 'Instances',
    min: 1,
    max: 20,
    scrollHint: 'Scroll to add or remove instances',
    solves: 'Scale out: more servers share the load and survive one crashing.',
    worsens: 'Needs a load balancer in front. Each one costs 10/min (× size).',
  },
})
