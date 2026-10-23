import type { CdnTtl } from '../types'
import { defineComponent } from './shared'

const HIT_RATE: Record<CdnTtl, number> = { long: 0.95, short: 0.7 }

export const cdn = defineComponent({
  kind: 'cdn',
  label: 'CDN',
  blurb: 'Copies of images and scripts in data centres near your users.',
  solves: 'Static files load fast worldwide and never reach your servers.',
  worsens: 'Only helps static files. Dynamic requests pass straight through.',
  capacityRps: 100_000,
  baseLatencyMs: 5,
  costPerMin: 25,
  serves: ['static'],
  partial: true,
  edge: true,
  bound: 'network',
  choices: [
    {
      field: 'cdnTtl',
      label: 'Keep files for',
      options: [
        { value: 'long', label: 'Long (versioned URLs)', solves: 'About 95% of files served at the edge.', worsens: 'Every changed file needs a new URL.' },
        { value: 'short', label: 'Short', solves: 'Changes show up within a minute.', worsens: 'Only about 70% hits; the rest travel to your servers.' },
      ],
    },
  ],
  hitRate: (c) => HIT_RATE[c.cdnTtl],
  summary: ({ config }) => `${config.cdnTtl} TTL · ~${Math.round(HIT_RATE[config.cdnTtl] * 100)}% hits`,
})
