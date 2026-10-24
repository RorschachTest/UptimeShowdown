import type { InterviewLevel, Stage } from '../engine/types'

const goals = { uptime: 0.99, p95Ms: 50, maxStaleRate: 0.001, maxViolations: { lostWrite: 0 } }
const mix = { page: 0.8, write: 0.2 }

const main: Stage = {
  id: 'carts-main',
  title: 'Carts on a normal day',
  story: '6,000 cart reads and writes a second. At 0:25 a network fault cuts one node off for 20 seconds.',
  durationS: 60,
  traffic: [{ t: 0, rps: 5000 }, { t: 10, rps: 6000 }],
  mix,
  unlocks: { kinds: ['kvstore'], settings: [] },
  events: [{ t: 25, kind: 'partition', target: 'kvstore', durationS: 20 }],
  budget: 150,
  referenceCost: 105,
  goals,
}

const curveball: Stage = {
  id: 'carts-sale',
  title: 'The big sale',
  story: '9,000 requests a second, and at 0:25 a bad config push cuts two nodes off the network for 25 seconds.',
  durationS: 60,
  traffic: [{ t: 0, rps: 7000 }, { t: 10, rps: 9000 }],
  mix,
  unlocks: { kinds: [], settings: [] },
  events: [{ t: 25, kind: 'partition', target: 'kvstore', durationS: 25, count: 2 }],
  budget: 250,
  referenceCost: 225,
  goals,
}

/** Chapter 6, inspired by SDI Vol 1 "Design a key-value store". Scenario and numbers are ours. */
export const chapter6: InterviewLevel = {
  id: 'key-value-store',
  title: 'Design a key-value store',
  prompt: 'Build the store behind our shopping carts: get(cartId) and put(cartId, cart). It must keep taking writes when parts of the network fail.',
  questionBudget: 5,
  editBudget: 1,
  curveball: {
    title: 'The big sale',
    story: '50% more traffic, and a bad config push cuts two nodes off at once mid-sale. You may change 1 piece.',
  },
  questions: [
    { id: 'scale', text: 'How many reads and writes per second?', leverage: 'high', reveals: ['scale', 'mix'], short: '6,000/s, 20% writes', answer: 'About 6,000 a second at peak. One in five is a write (adding or removing an item).' },
    {
      id: 'consistency',
      text: 'Must a shopper always see what they just added?',
      leverage: 'high',
      reveals: ['freshness'],
      short: 'yes: own writes visible',
      answer: 'Yes. If someone adds an item and the cart doesn’t show it, they add it again and we get angry emails.',
    },
    {
      id: 'failures',
      text: 'What fails, and what must keep working?',
      leverage: 'high',
      reveals: ['failures'],
      short: 'nodes get cut off; never refuse a cart write',
      answer: 'Network faults cut nodes off for tens of seconds. Refusing an add-to-cart loses a sale, so writes must keep working.',
    },
    {
      id: 'conflicts',
      text: 'Can two writes to the same cart happen at once?',
      leverage: 'high',
      reveals: ['conflicts'],
      short: 'yes: phone + laptop; never lose an item',
      answer: 'Yes, about 2% of writes race another one: a phone and a laptop on the same cart. Losing either item is not OK.',
    },
    { id: 'latency', text: 'How fast must get and put be?', leverage: 'high', reveals: ['latency'], short: 'p95 ≤ 50 ms', answer: 'Under 50 ms at p95.' },
    { id: 'growth', text: 'What about sale days?', leverage: 'high', reveals: ['growth'], short: 'sales: 1.5× traffic, two nodes can fail', answer: 'Sales bring 50% more traffic, and we have lost two nodes at once before.' },
    { id: 'size', text: 'How big is a cart?', leverage: 'low', reveals: [], answer: 'A few kilobytes. Small values, lots of keys.' },
    { id: 'keyformat', text: 'What does a key look like?', leverage: 'low', reveals: [], answer: 'A cart ID string. Any hash spreads them evenly.' },
    { id: 'cassandra', text: 'Should we just use Cassandra?', leverage: 'trap', reveals: [], answer: 'Maybe later. Today I want to know how you would build it.' },
    { id: 'sql', text: 'Why not one big SQL database?', leverage: 'trap', reveals: [], answer: 'One box can’t take this load, and when it’s cut off every cart is gone.' },
  ],
  features: [
    { id: 'getput', text: 'get(key) and put(key, value)', core: true },
    { id: 'available', text: 'Keep accepting writes during failures', core: true },
    { id: 'consistent', text: 'Shoppers see their own writes', core: true },
    { id: 'conflicts', text: 'Never lose a concurrent write', core: true },
    { id: 'scan', text: 'Range scans over keys', core: false },
    { id: 'txn', text: 'Transactions across carts', core: false },
    { id: 'ttl', text: 'Expire abandoned carts', core: false },
  ],
  brief: {
    points: [
      'We sell online. Every shopper has a cart stored under its cart ID: get(cartId) shows it, put(cartId, cart) saves it.',
      'You are building the store itself: a cluster of nodes that spreads cart keys around and keeps several copies of each.',
      'The network between nodes is not perfect. Sometimes a node can still run but can’t reach the others.',
      'You choose how many copies to keep, how many must confirm a write or answer a read, and what to do when two writes collide.',
    ],
    diagram: { nodes: [['u', 'traffic'], ['kv', 'kvstore']], wires: ['u>kv'] },
  },
  wrapUp: [
    {
      id: 'rw',
      prompt: 'With N = 3 copies, which W and R make every read see the latest successful write?',
      options: [
        { id: 'qq', text: 'W = 2, R = 2', correct: true },
        { id: '11', text: 'W = 1, R = 1', correct: false },
        { id: '12', text: 'W = 1, R = 2', correct: false },
        { id: 'any', text: 'Any W and R, as long as N = 3', correct: false },
      ],
      explain: 'When R + W > N, every read set overlaps every write set in at least one replica, so a read always meets the newest version. W = 2, R = 2 also survives one replica being unreachable.',
    },
  ],
  chapter: {
    id: 'key-value-store',
    title: 'Design a key-value store',
    seed: 6,
    violationLabels: { lostWrite: 'concurrent cart writes were silently lost' },
    rules: {
      requires: [{ kind: 'kvstore', why: 'This chapter is about building the key-value store itself.' }],
    },
    names: [{ kind: 'traffic', name: 'Cart service' }, { kind: 'kvstore', name: 'Cart store' }],
    data: { kvstore: ['cartId → items + version clock'] },
    requestTypes: [
      { id: 'page', label: 'Get cart', api: 'get(cartId)', does: { lookup: 'read from R copies' }, needs: ['lookup'], weight: 1, consistency: 'ryw', distanceMs: 0 },
      { id: 'write', label: 'Put cart', api: 'put(cartId, cart)', does: { write: 'write to W of N copies' }, needs: ['write'], weight: 1, consistency: 'any', distanceMs: 0, conflicts: 0.02 },
    ],
    stages: [main, curveball],
  },
}
