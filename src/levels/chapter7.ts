import type { InterviewLevel, Stage } from '../engine/types'

const goals = { uptime: 0.99, p95Ms: 50, maxStaleRate: 0.001, maxViolations: { duplicateId: 0, unordered: 0, tooLong: 0 } }

const main: Stage = {
  id: 'ids-main',
  title: 'IDs for every order',
  story: '12,000 new IDs a second. An ID server crashes at 0:20, and at 0:40 one server’s clock jumps back.',
  durationS: 60,
  traffic: [{ t: 0, rps: 9000 }, { t: 10, rps: 12000 }],
  mix: { write: 1 },
  unlocks: { kinds: ['idgen'], settings: [] },
  events: [
    { t: 20, kind: 'crash', target: 'idgen', durationS: 15 },
    { t: 40, kind: 'clockSkew', target: 'idgen', durationS: 5 },
  ],
  budget: 40,
  referenceCost: 20,
  goals,
}

const curveball: Stage = {
  id: 'ids-everything',
  title: 'Every service wants IDs',
  story: 'Messages, uploads and payments move to your IDs too: 120,000 a second, and a server still crashes at 0:20.',
  durationS: 60,
  traffic: [{ t: 0, rps: 90000 }, { t: 10, rps: 120000 }],
  mix: { write: 1 },
  unlocks: { kinds: [], settings: [] },
  events: [
    { t: 20, kind: 'crash', target: 'idgen', durationS: 15 },
    { t: 40, kind: 'clockSkew', target: 'idgen', durationS: 5 },
  ],
  budget: 60,
  referenceCost: 40,
  goals,
}

/** Chapter 7, inspired by SDI Vol 1 "Design a unique ID generator in distributed systems". Scenario and numbers are ours. */
export const chapter7: InterviewLevel = {
  id: 'unique-id',
  title: 'Design a unique ID generator',
  prompt: 'Our order service runs on many machines and the single database counter can’t keep up. Design how we hand out unique IDs.',
  questionBudget: 5,
  editBudget: 1,
  curveball: {
    title: 'Every service wants IDs',
    story: 'Ten times as many IDs: 120,000 a second, with the same crashes and clock trouble. You may change 1 piece.',
  },
  questions: [
    { id: 'scale', text: 'How many IDs per second?', leverage: 'high', reveals: ['scale'], short: '12,000/s', answer: 'About 12,000 a second at peak, from many order servers at once.' },
    { id: 'format', text: 'What must an ID look like?', leverage: 'high', reveals: ['data'], short: '64-bit number', answer: 'A number that fits in 64 bits: our database columns and APIs use BIGINT.' },
    { id: 'order', text: 'Must IDs sort by creation time?', leverage: 'high', reveals: ['ordering'], short: 'yes: newer = bigger', answer: 'Yes. A newer order must get a bigger ID, so we can sort by ID instead of a timestamp.' },
    {
      id: 'unique',
      text: 'What if two orders ever got the same ID?',
      leverage: 'high',
      reveals: ['failures'],
      short: 'never; servers crash, clocks drift',
      answer: 'It must never happen: one customer would see another’s order. And our servers do crash, and their clocks drift.',
    },
    { id: 'latency', text: 'How fast must an ID come back?', leverage: 'high', reveals: ['latency'], short: 'p95 ≤ 50 ms', answer: 'Well under 50 ms at p95: it sits in front of every checkout.' },
    { id: 'growth', text: 'Will other services use this too?', leverage: 'high', reveals: ['growth'], short: 'yes: 10× soon', answer: 'Yes. Messages, uploads and payments want the same IDs soon: about ten times the load.' },
    { id: 'guess', text: 'Is it OK if IDs are guessable?', leverage: 'low', reveals: [], answer: 'Yes, we check permissions on every order anyway.' },
    { id: 'lang', text: 'Which language should the service be in?', leverage: 'low', reveals: [], answer: 'Whatever you like. It doesn’t change the design.' },
    { id: 'timestamp', text: 'Can we just use the current time in ms?', leverage: 'trap', reveals: [], answer: 'Twelve orders arrive in the same millisecond. They would all get the same ID.' },
    { id: 'objectid', text: 'Should we switch to MongoDB for its ObjectIds?', leverage: 'trap', reveals: [], answer: 'We aren’t changing databases for this. Design the generator.' },
  ],
  features: [
    { id: 'unique', text: 'Unique IDs across all servers', core: true },
    { id: 'numeric', text: '64-bit numeric IDs', core: true },
    { id: 'sorted', text: 'Sortable by creation time', core: true },
    { id: 'available', text: 'No single point of failure', core: true },
    { id: 'pretty', text: 'Short human-friendly codes', core: false },
    { id: 'random', text: 'Unguessable IDs', core: false },
    { id: 'reuse', text: 'Reuse IDs of deleted orders', core: false },
  ],
  brief: {
    points: [
      'Our shop runs its order service on many machines. Every new order needs an ID that no other order will ever have.',
      'Today a single database auto-increment column hands out the numbers, and it has become the bottleneck.',
      'Other systems store these IDs and sort by them, so their shape matters as much as their uniqueness.',
      'You choose how IDs are generated and how many ID servers to run.',
    ],
    diagram: { nodes: [['u', 'traffic'], ['g', 'idgen']], wires: ['u>g'] },
  },
  wrapUp: [
    {
      id: 'bits',
      prompt: 'A Snowflake ID packs a 41-bit timestamp, a 10-bit machine ID and a 12-bit sequence. What does the sequence give you?',
      options: [
        { id: 'perms', text: 'Up to 4,096 IDs per millisecond on one machine', correct: true },
        { id: 'machines', text: 'Room for 4,096 machines', correct: false },
        { id: 'years', text: 'About 69 years of timestamps', correct: false },
        { id: 'random', text: 'Randomness so IDs can’t be guessed', correct: false },
      ],
      explain: 'The sequence counts IDs within one millisecond on one machine: 2^12 = 4,096. The 10-bit machine ID allows 1,024 machines; 41 bits of milliseconds last about 69 years.',
    },
  ],
  chapter: {
    id: 'unique-id',
    title: 'Design a unique ID generator',
    seed: 7,
    violationLabels: { duplicateId: 'duplicate IDs handed out', unordered: 'IDs out of time order', tooLong: 'IDs too long for 64 bits' },
    rules: {
      requires: [{ kind: 'idgen', why: 'Every new order needs an ID from your ID generator.' }],
    },
    names: [{ kind: 'traffic', name: 'Order servers' }, { kind: 'idgen', name: 'ID service' }],
    requestTypes: [{ id: 'write', label: 'New ID', api: 'nextId()', does: { id: 'issue a unique ID' }, needs: ['id'], weight: 1, consistency: 'any', distanceMs: 0 }],
    stages: [main, curveball],
  },
}
