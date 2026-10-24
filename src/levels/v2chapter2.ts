import type { InterviewLevel, Stage } from '../engine/types'

const goals = { uptime: 0.99, p95Ms: 200, maxStaleRate: 0.001, maxLagMs: 10_000, maxViolations: { lostMessages: 0, missedUpdates: 5_000 } }

const main: Stage = {
  id: 'friends-main',
  title: 'Friday night',
  story: '300,000 people have “nearby friends” on. Each sends its location every 30 seconds, and about 40 online friends see each update. Ops adds a pub/sub server at 0:30 for the evening peak.',
  durationS: 60,
  traffic: [{ t: 0, rps: 8000 }, { t: 10, rps: 11000 }],
  mix: { write: 10 / 11, page: 1 / 11 },
  connections: 300_000,
  unlocks: { kinds: ['wsgateway', 'pubsub', 'tsdb', 'lb', 'app', 'cache'], settings: ['tier'] },
  events: [{ t: 30, kind: 'nodeJoin', target: 'pubsub' }],
  budget: 350,
  referenceCost: 265,
  goals,
}

const curveball: Stage = {
  id: 'friends-festival',
  title: 'Festival weekend',
  story: 'A huge festival: 600,000 people share their location, twice as many updates. Ops adds a pub/sub server at 0:30 again.',
  durationS: 60,
  traffic: [{ t: 0, rps: 15000 }, { t: 10, rps: 21000 }],
  mix: { write: 20 / 21, page: 1 / 21 },
  connections: 600_000,
  unlocks: { kinds: [], settings: [] },
  events: [{ t: 30, kind: 'nodeJoin', target: 'pubsub' }],
  budget: 600,
  referenceCost: 460,
  goals,
}

/** Volume 2 Chapter 2, inspired by SDI Vol 2 "Nearby friends". Scenario and numbers are ours. */
export const v2chapter2: InterviewLevel = {
  id: 'nearby-friends',
  title: 'Design nearby friends',
  prompt: 'Design a feature that shows which of your friends are nearby right now, with their position updating live on a map.',
  questionBudget: 5,
  editBudget: 3,
  curveball: {
    title: 'Festival weekend',
    story: 'Twice as many people sharing their location. You may change at most 3 pieces.',
  },
  questions: [
    { id: 'scale', text: 'How many people share their location at once?', leverage: 'high', reveals: ['scale', 'mix'], short: '300,000 online; update every 30 s', answer: 'About 300,000 at peak, each sending a location every 30 seconds: 10,000 updates a second.' },
    { id: 'friends', text: 'How many friends see each update?', leverage: 'high', reveals: ['data'], short: '~40 online friends each', answer: 'People have about 400 friends; roughly 40 of them are online with the feature on.' },
    { id: 'fresh', text: 'How fresh must positions be?', leverage: 'high', reveals: ['freshness'], short: 'a few seconds', answer: 'Within a few seconds of the update.' },
    { id: 'resize', text: 'Will the cluster change size?', leverage: 'high', reveals: ['failures'], short: 'servers added at peak', answer: 'Ops adds pub/sub servers in the evening, while people are online. A short blip is fine; a city-wide freeze is not.' },
    { id: 'history', text: 'Do we keep location history?', leverage: 'high', reveals: ['ordering'], short: 'yes, for the history team', answer: 'Yes, every update goes to a location history store.' },
    { id: 'growth', text: 'Any big events?', leverage: 'high', reveals: ['growth'], short: 'festivals: 2× users', answer: 'Festivals double the number of people sharing.' },
    { id: 'radius', text: 'What counts as nearby?', leverage: 'low', reveals: [], answer: 'Within 5 miles. Each app filters what it receives.' },
    { id: 'privacy', text: 'Can people hide?', leverage: 'low', reveals: [], answer: 'Yes, the feature is opt-in.' },
    { id: 'gps', text: 'Should we poll GPS every second?', leverage: 'trap', reveals: [], answer: 'Batteries would hate it. Every 30 seconds is the product decision.' },
    { id: 'geohash', text: 'Should we use geohashes like Yelp?', leverage: 'trap', reveals: [], answer: 'Friends move constantly; this isn’t a static index of places.' },
  ],
  features: [
    { id: 'share', text: 'Share my location live', core: true },
    { id: 'see', text: 'See nearby friends move', core: true },
    { id: 'list', text: 'Load the nearby list when I open the app', core: true },
    { id: 'history', text: 'Keep location history', core: true },
    { id: 'routes', text: 'Directions to a friend', core: false },
    { id: 'strangers', text: 'Nearby strangers', core: false },
    { id: 'chat', text: 'Chat with nearby friends', core: false },
  ],
  wrapUp: [
    {
      id: 'ring',
      prompt: 'Why place pub/sub channels on a hash ring?',
      options: [
        { id: 'resize', text: 'Adding a server moves only ~1/N of the channels, so few subscribers have to resubscribe', correct: true },
        { id: 'fast', text: 'It makes each publish faster', correct: false },
        { id: 'cheap', text: 'It needs fewer servers', correct: false },
        { id: 'dist', text: 'It filters friends by distance', correct: false },
      ],
      explain: 'Pub/sub servers are stateful: subscribers are attached to channels on specific servers. Consistent hashing keeps most channels where they are when the cluster resizes; still, resize off-peak when you can.',
    },
  ],
  brief: {
    points: [
      'People with the feature on keep a WebSocket open and send their location every 30 seconds.',
      'Each update is published to that person’s channel; their online friends are subscribed and get pushed the new position.',
      'Every update is also written to a location history store; opening the app loads the current nearby list over HTTP.',
    ],
    diagram: {
      nodes: [['u', 'traffic'], ['ws', 'wsgateway'], ['ps', 'pubsub'], ['db', 'tsdb'], ['lb', 'lb'], ['api', 'app'], ['c', 'cache']],
      wires: ['u>ws', 'ws>ps', 'ps>db', 'u>lb', 'lb>api', 'api>c', 'c>db'],
    },
  },
  chapter: {
    id: 'nearby-friends',
    title: 'Design nearby friends',
    seed: 102,
    violationLabels: { missedUpdates: 'location updates missed while channels moved', lostMessages: 'location updates were lost' },
    rules: {
      requires: [{ kind: 'pubsub', why: 'Friends must be pushed each update: use a pub/sub channel per user.' }],
    },
    names: [
      { kind: 'traffic', name: 'Friends’ phones' },
      { kind: 'wsgateway', name: 'WebSocket servers' },
      { kind: 'pubsub', name: 'Location channels' },
      { kind: 'tsdb', name: 'Location history' },
      { kind: 'lb', name: 'Load balancer' },
      { kind: 'app', name: 'Nearby API' },
      { kind: 'cache', name: 'Location cache' },
    ],
    data: { pubsub: ['channel per user → subscribed friends'], tsdb: ['userId + time → lat, lng'], cache: ['userId → latest location (TTL)'] },
    requestTypes: [
      { id: 'write', label: 'Location update', api: 'ws: location(lat, lng)', does: { push: 'receive the update', publish: 'push to ~40 online friends', write: 'append to history' }, needs: ['push', 'publish', 'write'], weight: 1, consistency: 'any', distanceMs: 0, asyncAfter: 'push', fanout: 40 },
      { id: 'page', label: 'Open nearby list', api: 'GET /nearby', does: { compute: 'list friends within 5 miles', lookup: 'read friends’ latest locations' }, needs: ['compute', 'lookup'], weight: 1, consistency: 'any', distanceMs: 0 },
    ],
    stages: [main, curveball],
  },
}
