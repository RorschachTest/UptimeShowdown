import { defineComponent } from './shared'

export const lb = defineComponent({
  kind: 'lb',
  label: 'Load Balancer',
  blurb: 'One address in front of many web servers.',
  solves: 'Spreads traffic and routes around a crashed server.',
  worsens: 'Another hop and another bill. Pointless with only one server behind it.',
  // A managed L4 balancer handles far more than any single backend.
  capacityRps: 100_000,
  baseLatencyMs: 2,
  costPerMin: 15,
  does: 'spreads requests across servers',
  serves: [],
  bound: 'network',
  balances: true,
})
