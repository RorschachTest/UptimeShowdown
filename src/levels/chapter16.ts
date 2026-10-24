import type { Chapter, Stage } from '../engine/types'

const kinds: Stage['unlocks']['kinds'] = ['lb', 'app', 'sqldb', 'cache', 'cdn', 'ratelimit', 'queue', 'worker', 'kvstore', 'blob']
const goals = { uptime: 0.99, p95Ms: 300, maxStaleRate: 0.001, maxLagMs: 30_000, maxViolations: { lostMessages: 0 } }
const mix = { page: 0.6, write: 0.1, static: 0.2, job: 0.1 }

/** Chapter 16 capstone: one product, three growth stages, every general-purpose piece unlocked. Numbers are ours. */
export const chapter16: Chapter = {
  id: 'grand-tour',
  title: 'The grand tour',
  seed: 16,
  names: [
    { kind: 'app', name: 'App servers' },
    { kind: 'sqldb', name: 'Main DB' },
    { kind: 'kvstore', name: 'Sharded store' },
    { kind: 'cache', name: 'Cache' },
    { kind: 'queue', name: 'Job queue' },
    { kind: 'worker', name: 'Workers' },
  ],
  data: { sqldb: ['users, posts, orders'], kvstore: ['users, posts, orders (sharded)'], cache: ['hot rows'], cdn: ['images, scripts'] },
  requestTypes: [
    { id: 'page', label: 'Page view', api: 'GET /pages/{id}', does: { compute: 'render the page', lookup: 'read the data' }, needs: ['compute', 'lookup'], weight: 1, consistency: 'any', distanceMs: 0 },
    { id: 'write', label: 'Write', api: 'POST /items', does: { compute: 'validate', write: 'save' }, needs: ['compute', 'write'], weight: 1, consistency: 'any', distanceMs: 0 },
    { id: 'static', label: 'Images & JS', api: 'GET /static/*', does: { static: 'serve files' }, needs: ['static'], weight: 2, consistency: 'any', distanceMs: 250 },
    { id: 'job', label: 'Background job', api: 'POST /jobs', does: { compute: 'accept the job', enqueue: 'queue it', work: 'process it' }, needs: ['compute', 'enqueue', 'work'], weight: 1, consistency: 'any', distanceMs: 0, asyncAfter: 'enqueue' },
  ],
  stages: [
    {
      id: 'tour-launch',
      title: 'Launch',
      story: 'Your product opens to the public: 2,000 requests a second of pages, writes, images and background jobs. A server crashes at 0:30. Everything you learned is on the palette.',
      durationS: 60,
      traffic: [{ t: 0, rps: 1500 }, { t: 15, rps: 2000 }],
      mix,
      unlocks: { kinds, settings: ['tier', 'replicas', 'readRouting', 'cacheNodes', 'hashing'] },
      events: [{ t: 30, kind: 'crash', target: 'app', durationS: 15 }],
      budget: 240,
      referenceCost: 175,
      goals,
    },
    {
      id: 'tour-growth',
      title: 'Growth',
      story: 'Word spreads: 10,000 requests a second. A server crashes at 0:20 and a cache node at 0:40.',
      durationS: 60,
      traffic: [{ t: 0, rps: 6000 }, { t: 15, rps: 10000 }],
      mix,
      unlocks: { kinds: [], settings: [] },
      events: [
        { t: 20, kind: 'crash', target: 'app', durationS: 15 },
        { t: 40, kind: 'crash', target: 'cache', durationS: 10 },
      ],
      budget: 560,
      referenceCost: 420,
      goals,
    },
    {
      id: 'tour-viral',
      title: 'Viral',
      story: 'You are on the front page of the internet: 40,000 requests a second, and things break.',
      durationS: 60,
      traffic: [{ t: 0, rps: 20000 }, { t: 15, rps: 40000 }],
      mix,
      unlocks: { kinds: [], settings: [] },
      events: [
        { t: 20, kind: 'crash', target: 'app', durationS: 15 },
        { t: 40, kind: 'crash', target: 'worker', durationS: 10 },
      ],
      budget: 2100,
      referenceCost: 1580,
      goals,
    },
  ],
}
