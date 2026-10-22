import type { Level } from '../engine/types'

export const level1: Level = {
  id: 'simple-blog',
  title: 'Simple Blog',
  description: 'A personal blog gets shared around. Traffic climbs from 300 to 1,000 rps over 45 seconds.',
  budget: 200,
  traffic: [
    { t: 0, rps: 300 },
    { t: 45, rps: 1000 },
  ],
  mix: { read: 0.9, write: 0.1 },
  goals: { uptime: 0.99, p95Ms: 300 },
  seed: 1,
}
