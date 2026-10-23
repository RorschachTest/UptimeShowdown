import type { CacheSize } from '../types'
import { defineComponent } from './shared'

const SIZES: Record<CacheSize, { hitRate: number; cost: number }> = {
  S: { hitRate: 0.6, cost: 10 },
  M: { hitRate: 0.85, cost: 20 },
  L: { hitRate: 0.95, cost: 40 },
}

export const cache = defineComponent({
  kind: 'cache',
  label: 'Cache',
  blurb: 'Keeps hot data in memory, between your servers and the database.',
  solves: 'Answers most reads in about 1 ms and shields the database.',
  worsens: 'A second copy of the data that can be out of date.',
  capacityRps: 50_000,
  baseLatencyMs: 1,
  costPerMin: 0,
  serves: ['lookup'],
  partial: true,
  bound: 'storage',
  choices: [
    {
      field: 'cacheSize',
      label: 'Memory',
      options: [
        { value: 'S', label: 'S', solves: 'About 60% of reads answered. 10/min.', worsens: '40% of reads still reach the database.' },
        { value: 'M', label: 'M', solves: 'About 85% of reads answered. 20/min.', worsens: 'Costs twice as much as S.' },
        { value: 'L', label: 'L', solves: 'About 95% of reads answered: the hot set fits. 40/min.', worsens: 'Costs four times S.' },
      ],
    },
    {
      field: 'writeStrategy',
      label: 'On write',
      options: [
        {
          value: 'aside',
          label: 'Cache-aside',
          solves: 'Simple; if the cache dies, reads just get slower.',
          worsens: "Can return an old copy right after a user's own write.",
        },
        { value: 'through', label: 'Write-through', solves: 'Writes update the cache too, so reads stay fresh.', worsens: 'Every write does extra work.' },
      ],
    },
  ],
  hitRate: (c) => SIZES[c.cacheSize].hitRate,
  summary: ({ config }) =>
    `${config.cacheSize} · ~${Math.round(SIZES[config.cacheSize].hitRate * 100)}% hits · ${config.writeStrategy === 'through' ? 'write-through' : 'cache-aside'}`,
  cost: ({ config }) => SIZES[config.cacheSize].cost,
})
