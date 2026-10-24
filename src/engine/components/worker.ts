import { defineComponent } from './shared'

/** Background workers: consume from a queue, so they never need a load balancer. */
export const worker = defineComponent({
  kind: 'worker',
  label: 'Workers',
  blurb: 'Background processes that take jobs off a queue and do the slow part.',
  solves: 'Slow work leaves the request path; add workers to drain faster.',
  worsens: 'Each one costs money even when the queue is empty.',
  capacityRps: 1000,
  baseLatencyMs: 20,
  costPerMin: 10,
  serves: ['work'],
  relays: false,
  count: {
    field: 'instances',
    label: 'Workers',
    min: 1,
    max: 30,
    scrollHint: 'Scroll to add or remove workers',
    solves: 'Each worker handles about 1,000 jobs a second; they all pull from the same queue.',
    worsens: '10/min each.',
  },
})
