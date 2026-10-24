import type { InterviewLevel, Stage } from '../engine/types'

const goals = { uptime: 0.99, p95Ms: 300, maxStaleRate: 0.001, maxLagMs: 20_000, maxViolations: { miscounted: 0, lostMessages: 0 } }

const main: Stage = {
  id: 'ads-main',
  title: 'A day of ads',
  story: '50,000 ad clicks a second, one ad is going viral, and advertisers query their dashboards 500 times a second. An aggregator node crashes at 0:30.',
  durationS: 60,
  traffic: [{ t: 0, rps: 40000 }, { t: 10, rps: 50500 }],
  mix: { write: 500 / 505, page: 5 / 505 },
  unlocks: { kinds: ['queue', 'aggregator', 'tsdb', 'lb', 'app'], settings: ['tier'] },
  events: [{ t: 30, kind: 'crash', target: 'aggregator', durationS: 15 }],
  budget: 200,
  referenceCost: 150,
  goals,
}

const curveball: Stage = {
  id: 'ads-final',
  title: 'The championship final',
  story: 'Half-time ads: 150,000 clicks a second. An aggregator node still crashes at 0:30.',
  durationS: 60,
  traffic: [{ t: 0, rps: 100000 }, { t: 10, rps: 150500 }],
  mix: { write: 1500 / 1505, page: 5 / 1505 },
  unlocks: { kinds: [], settings: [] },
  events: [{ t: 30, kind: 'crash', target: 'aggregator', durationS: 15 }],
  budget: 360,
  referenceCost: 270,
  goals,
}

/** Volume 2 Chapter 6, inspired by SDI Vol 2 "Ad click event aggregation". Scenario and numbers are ours. */
export const v2chapter6: InterviewLevel = {
  id: 'ad-clicks',
  title: 'Design ad click aggregation',
  prompt: 'Count clicks on every ad, per minute, so advertisers can see results and be billed. The counts must be right.',
  questionBudget: 5,
  editBudget: 2,
  curveball: {
    title: 'The championship final',
    story: 'Three times the clicks during half-time. You may change at most 2 pieces.',
  },
  questions: [
    { id: 'scale', text: 'How many clicks per second?', leverage: 'high', reveals: ['scale', 'mix'], short: '50,000 clicks/s; 500 queries/s', answer: 'About 50,000 clicks a second, and 500 dashboard queries a second.' },
    { id: 'correct', text: 'How exact must the counts be?', leverage: 'high', reveals: ['data'], short: 'exact: they’re invoices', answer: 'Exact. Advertisers are billed per click: over- or under-counting is money.' },
    { id: 'late', text: 'Do clicks arrive in order?', leverage: 'high', reveals: ['ordering'], short: '~5% arrive late', answer: 'Mostly, but about 5% arrive late: phones go offline and send later.' },
    { id: 'dupes', text: 'Can a click be delivered twice?', leverage: 'high', reveals: ['conflicts'], short: 'yes: ~1% via retries', answer: 'Yes, our pipeline retries, so about 1% arrive twice.' },
    { id: 'hot', text: 'Are clicks spread across ads?', leverage: 'high', reveals: ['geography'], short: 'no: viral ads dominate', answer: 'No. A viral ad can get a large share of all clicks.' },
    { id: 'growth', text: 'Any peaks?', leverage: 'high', reveals: ['growth'], short: 'big games: 3×', answer: 'Big sports finals triple clicks.' },
    { id: 'fresh', text: 'How fresh must dashboards be?', leverage: 'low', reveals: [], answer: 'Within about 20 seconds.' },
    { id: 'fraud', text: 'Do we filter click fraud?', leverage: 'low', reveals: [], answer: 'Another team does.' },
    { id: 'spark', text: 'Spark or Flink?', leverage: 'trap', reveals: [], answer: 'Either can do it. What must the job get right?' },
    { id: 'sql', text: 'Can we just count with SQL?', leverage: 'trap', reveals: [], answer: 'At 50,000 inserts a second and growing? Think streaming.' },
  ],
  features: [
    { id: 'count', text: 'Clicks per ad per minute', core: true },
    { id: 'exact', text: 'Exact counts for billing', core: true },
    { id: 'query', text: 'Advertiser dashboards', core: true },
    { id: 'topn', text: 'Top 100 ads each minute', core: false },
    { id: 'filter', text: 'Filter by country and device', core: false },
    { id: 'fraud', text: 'Click-fraud detection', core: false },
  ],
  wrapUp: [
    {
      id: 'watermark',
      prompt: 'What does a watermark do in a windowed aggregation?',
      options: [
        { id: 'late', text: 'Keeps a window open a little past its end so late events still count', correct: true },
        { id: 'dedupe', text: 'Removes duplicate events', correct: false },
        { id: 'skew', text: 'Spreads hot keys over nodes', correct: false },
        { id: 'store', text: 'Stores raw events', correct: false },
      ],
      explain: 'Events carry the time they happened. A watermark says how long to wait for stragglers before a window is final: longer means more accurate, later results.',
    },
  ],
  brief: {
    points: [
      'Every ad click becomes an event in a queue.',
      'An aggregator counts clicks per ad per minute and writes the totals to a database.',
      'Advertisers query their totals through a query service.',
    ],
    diagram: {
      nodes: [['u', 'traffic'], ['q', 'queue'], ['agg', 'aggregator'], ['db', 'tsdb'], ['lb', 'lb'], ['api', 'app']],
      wires: ['u>q', 'q>agg', 'agg>db', 'u>lb', 'lb>api', 'api>db'],
    },
  },
  chapter: {
    id: 'ad-clicks',
    title: 'Design ad click aggregation',
    seed: 106,
    violationLabels: { miscounted: 'clicks were miscounted (wrong bills)', lostMessages: 'clicks were lost' },
    rules: {
      requires: [{ kind: 'aggregator', why: 'Clicks are counted by a stream aggregator.' }],
    },
    names: [
      { kind: 'traffic', name: 'Ads & advertisers' },
      { kind: 'queue', name: 'Click stream' },
      { kind: 'aggregator', name: 'Click aggregator' },
      { kind: 'tsdb', name: 'Aggregated counts' },
      { kind: 'lb', name: 'Load balancer' },
      { kind: 'app', name: 'Query service' },
    ],
    data: { tsdb: ['ad + minute → clicks'], queue: ['click id, ad id, time'] },
    requestTypes: [
      { id: 'write', label: 'Click', api: 'click(adId)', does: { enqueue: 'append to the stream', aggregate: 'count per ad per minute', write: 'store the minute’s total' }, needs: ['enqueue', 'aggregate', 'write'], weight: 0.05, consistency: 'any', distanceMs: 0, asyncAfter: 'enqueue' },
      { id: 'page', label: 'Dashboard query', api: 'GET /ads/{id}/clicks', does: { compute: 'check the advertiser', lookup: 'read the counts' }, needs: ['compute', 'lookup'], weight: 1, consistency: 'any', distanceMs: 0 },
    ],
    stages: [main, curveball],
  },
}
