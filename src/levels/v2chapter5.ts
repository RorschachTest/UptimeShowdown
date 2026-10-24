import type { InterviewLevel, Stage } from '../engine/types'

const goals = { uptime: 0.999, p95Ms: 300, maxStaleRate: 0.001, maxLagMs: 15_000, maxViolations: { lostMessages: 0 } }

const main: Stage = {
  id: 'metrics-main',
  title: 'A normal day of metrics',
  story: '100,000 metric points a second from our servers, and 1,000 dashboard queries a second from engineers. A database node crashes at 0:30.',
  durationS: 60,
  traffic: [{ t: 0, rps: 80000 }, { t: 10, rps: 101000 }],
  mix: { write: 100 / 101, page: 1 / 101 },
  unlocks: { kinds: ['queue', 'worker', 'tsdb', 'lb', 'app', 'cache'], settings: ['tier'] },
  events: [{ t: 30, kind: 'crash', target: 'tsdb', durationS: 10 }],
  budget: 200,
  referenceCost: 145,
  goals,
}

const curveball: Stage = {
  id: 'metrics-incident',
  title: 'The big incident',
  story: 'Something is on fire: every server reports 5× more metrics, and 5,000 engineers refresh dashboards every second. A database node still crashes at 0:30.',
  durationS: 60,
  traffic: [{ t: 0, rps: 200000 }, { t: 10, rps: 505000 }],
  mix: { write: 500 / 505, page: 5 / 505 },
  unlocks: { kinds: [], settings: [] },
  events: [{ t: 30, kind: 'crash', target: 'tsdb', durationS: 10 }],
  budget: 400,
  referenceCost: 285,
  goals,
}

/** Volume 2 Chapter 5, inspired by SDI Vol 2 "Metrics monitoring and alerting system". Scenario and numbers are ours. */
export const v2chapter5: InterviewLevel = {
  id: 'metrics',
  title: 'Design metrics monitoring',
  prompt: 'Design the system that collects metrics (CPU, memory, request rates) from all our servers and shows them on dashboards.',
  questionBudget: 5,
  editBudget: 2,
  curveball: {
    title: 'The big incident',
    story: 'Five times the metrics and five times the dashboard refreshes, exactly when it matters most. You may change at most 2 pieces.',
  },
  questions: [
    { id: 'scale', text: 'How many metric points per second?', leverage: 'high', reveals: ['scale', 'mix'], short: '100,000 points + 1,000 queries/s', answer: 'About 100,000 points a second from our fleet, and 1,000 dashboard queries a second.' },
    { id: 'retention', text: 'How long do we keep the data?', leverage: 'high', reveals: ['data'], short: 'a year; detail only for a week', answer: 'A year. Full detail matters for about a week; after that, 1-minute or 1-hour rollups are enough.' },
    { id: 'latency', text: 'How fast must dashboards load?', leverage: 'high', reveals: ['latency'], short: 'p95 ≤ 300 ms', answer: 'Under 300 ms at p95.' },
    { id: 'fresh', text: 'How fresh must the graphs be?', leverage: 'high', reveals: ['freshness'], short: 'within 15 s', answer: 'A point should be on the graph within 15 seconds.' },
    { id: 'failures', text: 'What happens during incidents?', leverage: 'high', reveals: ['growth'], short: '5× metrics, 5× refreshes', answer: 'Everything spikes at once: servers emit more metrics and everyone stares at dashboards.' },
    { id: 'loss', text: 'Can we drop points under load?', leverage: 'high', reveals: ['failures'], short: 'no: and dashboards must stay up', answer: 'No. And dashboards must keep answering during an incident: that is when people need them.' },
    { id: 'alerts', text: 'Do we send alerts?', leverage: 'low', reveals: [], answer: 'Yes, but another team owns the alert channels. Focus on collection and dashboards.' },
    { id: 'logs', text: 'Do we store logs too?', leverage: 'low', reveals: [], answer: 'No, metrics only.' },
    { id: 'prom', text: 'Prometheus or InfluxDB?', leverage: 'trap', reveals: [], answer: 'Tell me what the storage must do first.' },
    { id: 'sql', text: 'Can we use our MySQL?', leverage: 'trap', reveals: [], answer: 'Try it, and watch what 100,000 inserts a second do to it.' },
  ],
  features: [
    { id: 'collect', text: 'Collect metrics from every server', core: true },
    { id: 'store', text: 'Store them for a year', core: true },
    { id: 'dash', text: 'Dashboards over any time range', core: true },
    { id: 'alerts', text: 'Alert rules and paging', core: false },
    { id: 'logs', text: 'Log search', core: false },
    { id: 'traces', text: 'Distributed tracing', core: false },
    { id: 'billing', text: 'Billing reports', core: false },
  ],
  wrapUp: [
    {
      id: 'kafka',
      prompt: 'Why put a queue (like Kafka) between the collectors and the time-series database?',
      options: [
        { id: 'buffer', text: 'Spikes and database hiccups wait in the queue instead of losing points', correct: true },
        { id: 'faster', text: 'It makes each write faster', correct: false },
        { id: 'query', text: 'Dashboards read from the queue', correct: false },
        { id: 'compress', text: 'It compresses the data', correct: false },
      ],
      explain: 'The queue decouples collection from storage: when the database is slow or a node dies, points are held and written once it recovers, so nothing is lost during an incident.',
    },
  ],
  brief: {
    points: [
      'Every server reports metrics (CPU, memory, request counts) every few seconds.',
      'Engineers open dashboards that graph those metrics over minutes, days or months.',
      'Metric points can go through a queue and workers into storage; dashboards go through query servers.',
    ],
    diagram: {
      nodes: [['u', 'traffic'], ['q', 'queue'], ['w', 'worker'], ['db', 'tsdb'], ['lb', 'lb'], ['web', 'app'], ['c', 'cache']],
      wires: ['u>q', 'q>w', 'w>db', 'u>lb', 'lb>web', 'web>c', 'c>db'],
    },
  },
  chapter: {
    id: 'metrics',
    title: 'Design metrics monitoring',
    seed: 105,
    violationLabels: { lostMessages: 'metric points were lost' },
    rules: {
      requires: [{ kind: 'tsdb', why: 'Metrics need a place to live: add a time-series database.' }],
      mustPassThrough: [{ types: ['write'], kind: 'queue', why: 'Collectors must not write straight into the database: buffer points in a queue.' }],
    },
    names: [
      { kind: 'traffic', name: 'Servers & engineers' },
      { kind: 'queue', name: 'Metrics queue' },
      { kind: 'worker', name: 'Consumers' },
      { kind: 'tsdb', name: 'Metrics DB' },
      { kind: 'lb', name: 'Load balancer' },
      { kind: 'app', name: 'Query service' },
      { kind: 'cache', name: 'Query cache' },
    ],
    data: { tsdb: ['series + time → value'], cache: ['query + range → points'], queue: ['metric, labels, time, value'] },
    requestTypes: [
      { id: 'write', label: 'Metric point', api: 'push(metric, value)', does: { enqueue: 'buffer the point', work: 'batch points', write: 'append to the series' }, needs: ['enqueue', 'work', 'write'], weight: 0.02, consistency: 'any', distanceMs: 0, asyncAfter: 'enqueue' },
      { id: 'page', label: 'Dashboard query', api: 'GET /query?range=', does: { compute: 'parse the query', lookup: 'read the time range' }, needs: ['compute', 'lookup'], weight: 1, consistency: 'any', distanceMs: 0 },
    ],
    stages: [main, curveball],
  },
}
