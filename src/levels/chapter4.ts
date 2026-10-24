import type { InterviewLevel, Stage } from '../engine/types'

const goals = { uptime: 0.99, p95Ms: 200, maxStaleRate: 0.001, maxBotServedRate: 0.04, maxThrottledRate: 0.01 }

const main: Stage = {
  id: 'api-main',
  title: 'Your API under scraping',
  story: 'Real users plus a pack of scrapers.',
  durationS: 60,
  traffic: [{ t: 0, rps: 6000 }, { t: 20, rps: 8000 }],
  // At peak: 1,900 photo requests and 100 uploads from real users; 6,000 from scrapers.
  mix: { scrape: 0.75, page: 0.2375, write: 0.0125 },
  clients: { page: 1900, write: 1900, scrape: 20 },
  unlocks: { kinds: ['ratelimit', 'lb', 'app', 'cache', 'sqldb'], settings: ['tier', 'replicas', 'readRouting'] },
  events: [],
  budget: 180,
  referenceCost: 135,
  goals,
}

const curveball: Stage = {
  id: 'api-scrapers-multiply',
  title: 'The scrapers multiply',
  story: '200 scrapers now, 62,000 requests per second in all.',
  durationS: 60,
  traffic: [{ t: 0, rps: 30000 }, { t: 20, rps: 62000 }],
  mix: { scrape: 60000 / 62000, page: 1900 / 62000, write: 100 / 62000 },
  clients: { page: 1900, write: 1900, scrape: 200 },
  unlocks: { kinds: [], settings: [] },
  events: [],
  budget: 210,
  referenceCost: 205,
  goals,
}

/** Chapter 4, inspired by SDI Vol 1 "Design a rate limiter". Scenario and numbers are ours. */
export const chapter4: InterviewLevel = {
  id: 'rate-limiter',
  title: 'Design a rate limiter',
  prompt: 'Our public photo API is being scraped. Design a rate limiter that stops the abuse without hurting real users.',
  questionBudget: 5,
  editBudget: 3,
  curveball: {
    title: 'The scrapers multiply',
    story: 'Ten times as many scrapers: 62,000 requests per second. One limiter instance can no longer keep up. You may change at most 3 pieces.',
  },
  questions: [
    { id: 'scale', text: 'How much traffic does the API get?', leverage: 'high', reveals: ['scale', 'mix'], short: '8,000 rps, 75% scrapers', answer: 'About 8,000 requests per second at peak. Three quarters of it is scrapers.' },
    {
      id: 'who',
      text: 'Who is sending the bad traffic, and how do we tell them apart?',
      leverage: 'high',
      reveals: ['abuse'],
      short: '20 scrapers × 300/s, one API key each',
      answer: 'About 20 scrapers, each at roughly 300 requests per second. Every request carries an API key, so we can limit per key.',
    },
    {
      id: 'users',
      text: 'How do real users behave?',
      leverage: 'high',
      reveals: ['clients'],
      short: '~1/s each, bursts of 5',
      answer: 'About 1 request per second each, but opening the app fires a burst of about 5 at once. They must not be blocked.',
    },
    {
      id: 'reject',
      text: 'What should a blocked client see?',
      leverage: 'high',
      reveals: ['failures'],
      short: '429 + Retry-After',
      answer: 'HTTP 429 Too Many Requests, with a Retry-After header telling them when to try again.',
    },
    { id: 'latency', text: 'How much latency may the limiter add?', leverage: 'high', reveals: ['latency'], short: 'a few ms; p95 ≤ 200 ms', answer: 'A few milliseconds. The whole API must stay under 200 ms at p95.' },
    {
      id: 'growth',
      text: 'Will one limiter server always be enough?',
      leverage: 'high',
      reveals: ['growth'],
      short: 'no: scrapers keep coming',
      answer: 'No. The scrapers keep multiplying, so expect to run several limiter servers.',
    },
    { id: 'endpoints', text: 'Should every endpoint have its own limit?', leverage: 'low', reveals: [], answer: 'Eventually. One limit per API key is fine for now.' },
    { id: 'language', text: 'Which language should the limiter be written in?', leverage: 'low', reveals: [], answer: "Your call. It doesn't change the design." },
    { id: 'redis', text: 'Should we use Redis?', leverage: 'trap', reveals: [], answer: "That's a tool, not a question. What would it store, and why?" },
    { id: 'ban', text: 'Can we just ban their IP addresses by hand?', leverage: 'trap', reveals: [], answer: 'They rotate IPs every few minutes. We need something automatic.' },
  ],
  features: [
    { id: 'per-key', text: 'Limit requests per API key', core: true },
    { id: 'reply', text: 'Tell limited clients when to retry (429)', core: true },
    { id: 'users', text: 'Never block real users', core: true },
    { id: 'tiers', text: 'Paid tiers with higher limits', core: false },
    { id: 'dashboard', text: 'Dashboard of blocked clients', core: false },
    { id: 'endpoint', text: 'Different limits per endpoint', core: false },
    { id: 'country', text: 'Block whole countries', core: false },
  ],
  wrapUp: [
    {
      id: 'counters',
      prompt: 'Your limiter runs on several servers. Where must the per-client counters live?',
      options: [
        { id: 'shared', text: 'In one shared store (like Redis), updated atomically', correct: true },
        { id: 'local', text: 'In each limiter server’s memory', correct: false },
        { id: 'sql', text: 'In the SQL database', correct: false },
        { id: 'client', text: 'In the client, sent with each request', correct: false },
      ],
      explain:
        'Local counters let each client through once per server. A shared store with atomic increments (or a small script that reads and updates in one step) avoids both the multiplied limit and race conditions. The database is too slow for every request; the client can lie.',
    },
  ],
  chapter: {
    id: 'rate-limiter',
    title: 'Design a rate limiter',
    seed: 4,
    rules: {
      requires: [{ kind: 'ratelimit', why: 'This API needs a rate limiter: stopping the scrapers is the whole problem.' }],
      mustPassThrough: [{ types: ['page', 'write', 'scrape'], kind: 'ratelimit', why: 'Every API request must go through the rate limiter.' }],
    },
    names: [{ kind: 'ratelimit', name: 'Rate limiter' }, { kind: 'app', name: 'Photo API' }, { kind: 'sqldb', name: 'Photos DB' }, { kind: 'cache', name: 'Photo cache' }],
    data: { ratelimit: ['API key → count this window'], sqldb: ['photos: id, owner, url'], cache: ['photo id → info'] },
    requestTypes: [
      { id: 'page', label: 'Photo request', api: 'GET /photos/{id}', does: { compute: 'find the photo', lookup: 'read photo info' }, needs: ['compute', 'lookup'], weight: 1, consistency: 'any', distanceMs: 0, burst: 5 },
      { id: 'write', label: 'Upload', api: 'POST /photos', does: { compute: 'check the upload', write: 'save the photo' }, needs: ['compute', 'write'], weight: 1, consistency: 'any', distanceMs: 0 },
      { id: 'scrape', label: 'Scraper request', api: 'GET /photos (bots)', does: { compute: 'find the photo', lookup: 'read photo info' }, needs: ['compute', 'lookup'], weight: 1, consistency: 'any', distanceMs: 0, abusive: true },
    ],
    stages: [main, curveball],
  },
}
