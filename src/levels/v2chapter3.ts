import type { InterviewLevel, Stage } from '../engine/types'

const goals = { uptime: 0.99, p95Ms: 300, maxStaleRate: 0.001, maxLagMs: 15_000, maxViolations: { lostMessages: 0, lostObjects: 0 } }

const main: Stage = {
  id: 'maps-main',
  title: 'Rush hour',
  story: '30,000 map tiles, 1,000 route requests and 20,000 location updates a second. Tiles total about 100 TB. A location-history node crashes at 0:30.',
  durationS: 60,
  traffic: [{ t: 0, rps: 40000 }, { t: 10, rps: 51000 }],
  mix: { static: 30 / 51, page: 1 / 51, write: 20 / 51 },
  workingSetGb: 100_000,
  unlocks: { kinds: ['cdn', 'blob', 'lb', 'app', 'cache', 'kvstore', 'queue', 'worker', 'tsdb'], settings: ['tier'] },
  events: [{ t: 30, kind: 'crash', target: 'tsdb', durationS: 15 }],
  budget: 440,
  referenceCost: 325,
  goals,
}

const curveball: Stage = {
  id: 'maps-holiday',
  title: 'Holiday getaway',
  story: 'Everyone drives at once: 3,000 routes and 60,000 location updates a second, with the same tiles. A history node still crashes at 0:30.',
  durationS: 60,
  traffic: [{ t: 0, rps: 60000 }, { t: 10, rps: 93000 }],
  mix: { static: 30 / 93, page: 3 / 93, write: 60 / 93 },
  workingSetGb: 100_000,
  unlocks: { kinds: [], settings: [] },
  events: [{ t: 30, kind: 'crash', target: 'tsdb', durationS: 15 }],
  budget: 720,
  referenceCost: 545,
  goals,
}

/** Volume 2 Chapter 3, inspired by SDI Vol 2 "Google Maps". Scenario and numbers are ours. */
export const v2chapter3: InterviewLevel = {
  id: 'maps',
  title: 'Design a maps app',
  prompt: 'Design a maps app: show the map anywhere in the world, give turn-by-turn routes with good arrival times, and use drivers’ locations to know about traffic.',
  questionBudget: 5,
  editBudget: 2,
  curveball: {
    title: 'Holiday getaway',
    story: 'Three times the routes and location updates. You may change at most 2 pieces.',
  },
  questions: [
    { id: 'scale', text: 'How many tiles, routes and location updates per second?', leverage: 'high', reveals: ['scale', 'mix'], short: '30,000 tiles, 1,000 routes, 20,000 updates/s', answer: 'About 30,000 map tiles, 1,000 route requests and 20,000 location updates a second.' },
    { id: 'tiles', text: 'Do map images change often?', leverage: 'high', reveals: ['data'], short: 'rarely: pre-render ~100 TB of tiles', answer: 'Rarely. We pre-render tiles for every zoom level: about 100 TB.' },
    { id: 'world', text: 'Where are our users?', leverage: 'high', reveals: ['geography'], short: 'everywhere: far from our servers', answer: 'All over the world. Most are far from our data centres.' },
    { id: 'fresh', text: 'How fresh must traffic data be?', leverage: 'high', reveals: ['freshness'], short: 'within 15 s', answer: 'Location updates should affect traffic and ETAs within about 15 seconds.' },
    { id: 'loss', text: 'Can we drop location updates?', leverage: 'high', reveals: ['failures'], short: 'no: they feed traffic and history', answer: 'No. They feed live traffic and the location history used to improve ETAs.' },
    { id: 'growth', text: 'Any peaks?', leverage: 'high', reveals: ['growth'], short: 'holidays: 3× driving', answer: 'Holiday weekends triple routes and location updates.' },
    { id: 'transit', text: 'Do we need public transport?', leverage: 'low', reveals: [], answer: 'Driving only for now.' },
    { id: 'offline', text: 'Offline maps?', leverage: 'low', reveals: [], answer: 'Later.' },
    { id: 'dijkstra', text: 'Should routing use Dijkstra or A*?', leverage: 'trap', reveals: [], answer: 'Pick either. How does the system around it scale?' },
    { id: 'gps', text: 'Should phones send GPS every second?', leverage: 'trap', reveals: [], answer: 'Phones batch updates every 15 seconds to save battery; that’s already decided.' },
  ],
  features: [
    { id: 'map', text: 'Show the map anywhere', core: true },
    { id: 'route', text: 'Routes with arrival times', core: true },
    { id: 'traffic', text: 'Live traffic from drivers', core: true },
    { id: 'search', text: 'Search for places', core: false },
    { id: 'transit', text: 'Public transport', core: false },
    { id: 'offline', text: 'Offline maps', core: false },
    { id: 'street', text: 'Street view', core: false },
  ],
  wrapUp: [
    {
      id: 'tiles',
      prompt: 'Why pre-render map tiles and serve them from a CDN?',
      options: [
        { id: 'static', text: 'Tiles rarely change, so they are static files: the CDN serves them near users and our servers never render maps on the fly', correct: true },
        { id: 'route', text: 'The CDN computes routes', correct: false },
        { id: 'privacy', text: 'It hides users’ locations', correct: false },
        { id: 'db', text: 'It replaces the road graph', correct: false },
      ],
      explain: 'Each zoom level is a grid of fixed images addressed by (zoom, x, y). Render once, store in object storage, and let CDN edges near users serve them.',
    },
  ],
  brief: {
    points: [
      'The app shows map tiles, asks for routes, and while navigating sends batched location updates.',
      'Tiles are pre-rendered images in object storage; routes come from a routing service reading a road graph; location updates feed traffic and history through a stream.',
      'Users are everywhere in the world.',
    ],
    diagram: {
      nodes: [['u', 'traffic'], ['cdn', 'cdn'], ['tiles', 'blob'], ['lb', 'lb'], ['route', 'app'], ['c', 'cache'], ['g', 'kvstore'], ['q', 'queue'], ['w', 'worker'], ['h', 'tsdb']],
      wires: ['u>cdn', 'cdn>tiles', 'u>lb', 'lb>route', 'route>c', 'c>g', 'u>q', 'q>w', 'w>h'],
    },
  },
  chapter: {
    id: 'maps',
    title: 'Design a maps app',
    seed: 103,
    violationLabels: { lostMessages: 'location updates were lost', lostObjects: 'tile storage failures lost tiles for good (one copy)' },
    rules: {
      requires: [{ kind: 'cdn', why: 'Users are worldwide: map tiles must come from a CDN near them.' }],
      mustPassThrough: [{ types: ['write'], kind: 'queue', why: 'Location updates must stream through a queue, not hit storage directly.' }],
    },
    names: [
      { kind: 'traffic', name: 'Phones' },
      { kind: 'cdn', name: 'Tile CDN' },
      { kind: 'blob', name: 'Map tiles' },
      { kind: 'lb', name: 'Load balancer' },
      { kind: 'app', name: 'Routing service' },
      { kind: 'cache', name: 'Road graph cache' },
      { kind: 'kvstore', name: 'Road graph' },
      { kind: 'queue', name: 'Location stream' },
      { kind: 'worker', name: 'Traffic updaters' },
      { kind: 'tsdb', name: 'Location history' },
    ],
    data: { blob: ['zoom/x/y → tile image'], kvstore: ['road segment → edges, speeds'], cache: ['routing tile → graph'], tsdb: ['user + time → location'] },
    requestTypes: [
      { id: 'static', label: 'Map tile', api: 'GET /tiles/{z}/{x}/{y}', does: { static: 'serve the tile image' }, needs: ['static'], weight: 1, consistency: 'any', distanceMs: 250, sizeMb: 0.1 },
      { id: 'page', label: 'Route', api: 'GET /route?from&to', does: { compute: 'find the fastest route + ETA', lookup: 'load road graph tiles' }, needs: ['compute', 'lookup'], weight: 4, consistency: 'any', distanceMs: 0 },
      { id: 'write', label: 'Location batch', api: 'POST /locations', does: { enqueue: 'stream the batch', work: 'update live traffic', write: 'append to history' }, needs: ['enqueue', 'work', 'write'], weight: 0.05, consistency: 'any', distanceMs: 0, asyncAfter: 'enqueue', workCost: 0.2 },
    ],
    stages: [main, curveball],
  },
}
