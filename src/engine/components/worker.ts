import { serveGeneric } from '../serve'
import { defineComponent } from './shared'

/** Aggregating a 1-in-10 sample does a tenth of the work per message. */
const SAMPLE_SPEEDUP = 10

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
  choices: [
    {
      field: 'workSample',
      label: 'Process',
      gate: 'sampling',
      options: [
        { value: 'all', label: 'Every message', solves: 'Exact counts.', worsens: 'One unit of work per message: needs many workers at high volume.' },
        { value: 'tenth', label: '1 in 10 sample', solves: 'A tenth of the work; counts are scaled up and still rank the same.', worsens: 'Rare items can be missed.' },
      ],
    },
  ],
  summary: ({ instances, config }) => `${(instances * 1000 * (config.workSample === 'tenth' ? SAMPLE_SPEEDUP : 1)).toLocaleString('en-US')} jobs/s${config.workSample === 'tenth' ? ' (sampled)' : ''}`,
  serve: (node, ctx) => serveGeneric(node, { ...ctx, instances: ctx.instances * (node.config.workSample === 'tenth' ? SAMPLE_SPEEDUP : 1) }),
})
