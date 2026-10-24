import { defineComponent } from './shared'

/** A durable message queue: producers get an answer at once, consumers work through it at their own pace. */
export const queue = defineComponent({
  kind: 'queue',
  label: 'Message Queue',
  blurb: 'Takes work now and hands it to workers as fast as they can go.',
  solves: 'Users get an instant answer; spikes wait in line instead of being dropped.',
  worsens: 'Work happens later (lag), and a message can be delivered more than once.',
  capacityRps: 100_000,
  baseLatencyMs: 2,
  costPerMin: 20,
  serves: ['enqueue'],
  buffers: true,
  bound: 'network',
})
