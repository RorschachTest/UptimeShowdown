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
  tiered: true,
  choices: [tierSetting],
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
