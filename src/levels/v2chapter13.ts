import type { InterviewLevel, Stage } from '../engine/types'

const goals = { uptime: 0.999, p95Ms: 5, maxStaleRate: 0.001, maxViolations: { unfairFills: 0, lostOrders: 0 } }

const main: Stage = {
  id: 'exchange-main',
  title: 'A trading day',
  story: '100,000 orders a second; each match is published as market data. A matching engine crashes at 0:30.',
  durationS: 60,
  traffic: [{ t: 0, rps: 80000 }, { t: 10, rps: 100000 }],
  mix: { write: 1 },
  unlocks: { kinds: ['matcher', 'pubsub'], settings: [] },
  events: [{ t: 30, kind: 'crash', target: 'matcher', durationS: 10 }],
  budget: 170,
  referenceCost: 120,
  goals,
}

const curveball: Stage = {
  id: 'exchange-open',
  title: 'Market open after big news',
  story: 'Everyone trades at the open: 300,000 orders a second. An engine still crashes at 0:30.',
  durationS: 60,
  traffic: [{ t: 0, rps: 200000 }, { t: 10, rps: 300000 }],
  mix: { write: 1 },
  unlocks: { kinds: [], settings: [] },
  events: [{ t: 30, kind: 'crash', target: 'matcher', durationS: 10 }],
  budget: 300,
  referenceCost: 220,
  goals,
}

/** Volume 2 Chapter 13, inspired by SDI Vol 2 "Stock exchange". Scenario and numbers are ours. */
export const v2chapter13: InterviewLevel = {
  id: 'exchange',
  title: 'Design a stock exchange',
  prompt: 'Design an electronic stock exchange: brokers send buy and sell orders, the exchange matches them fairly in microseconds, and publishes every trade.',
  questionBudget: 5,
  editBudget: 2,
  curveball: {
    title: 'Market open after big news',
    story: 'Three times the orders at the open. You may change at most 2 pieces.',
  },
  questions: [
    { id: 'scale', text: 'How many orders per second?', leverage: 'high', reveals: ['scale'], short: '100,000 orders/s', answer: 'About 100,000 a second, much more at the open.' },
    { id: 'latency', text: 'How fast must matching be?', leverage: 'high', reveals: ['latency'], short: 'p95 ≤ 5 ms end to end', answer: 'Microseconds inside the engine; under 5 ms end to end at p95.' },
    { id: 'fair', text: 'What does fair mean here?', leverage: 'high', reveals: ['ordering'], short: 'strict arrival order, replayable', answer: 'Orders are matched strictly in the order they arrived, and replaying the day must give exactly the same trades.' },
    { id: 'failures', text: 'What if the engine crashes?', leverage: 'high', reveals: ['failures'], short: 'never lose an order; keep trading', answer: 'We must not lose a single order, and trading must continue within milliseconds.' },
    { id: 'avail', text: 'How available must we be?', leverage: 'high', reveals: ['data'], short: '99.9% during trading hours', answer: '99.9% or better during trading hours.' },
    { id: 'growth', text: 'Any peaks?', leverage: 'high', reveals: ['growth'], short: 'the open: 3×', answer: 'The market open after big news triples orders.' },
    { id: 'types', text: 'Which order types?', leverage: 'low', reveals: [], answer: 'Limit orders only.' },
    { id: 'hours', text: 'Do we trade 24/7?', leverage: 'low', reveals: [], answer: 'No, normal trading hours.' },
    { id: 'cloud', text: 'Can we run it in the cloud?', leverage: 'trap', reveals: [], answer: 'Exchanges run on dedicated hardware for latency. Design the engine first.' },
    { id: 'ml', text: 'Should we predict prices?', leverage: 'trap', reveals: [], answer: 'An exchange matches orders; it doesn’t trade.' },
  ],
  features: [
    { id: 'match', text: 'Match buy and sell orders', core: true },
    { id: 'fair', text: 'Strict, replayable ordering', core: true },
    { id: 'durable', text: 'Never lose an order', core: true },
    { id: 'data', text: 'Publish market data', core: true },
    { id: 'reports', text: 'End-of-day reports', core: false },
    { id: 'options', text: 'Options and futures', core: false },
    { id: 'retail', text: 'A retail trading app', core: false },
  ],
  wrapUp: [
    {
      id: 'seq',
      prompt: 'Why put a sequencer in front of the matching engine?',
      options: [
        { id: 'det', text: 'It stamps every order with a sequence number, so matching is deterministic and the day can be replayed exactly', correct: true },
        { id: 'fast', text: 'It makes matching faster', correct: false },
        { id: 'risk', text: 'It checks the broker’s credit', correct: false },
        { id: 'data', text: 'It publishes market data', correct: false },
      ],
      explain: 'With a sequenced input log, the engine is a deterministic state machine: the same events give the same trades. That is what makes it fair, auditable and recoverable: a hot standby replays the same log.',
    },
  ],
  brief: {
    points: [
      'Brokers send buy and sell orders to the exchange.',
      'A matching engine keeps each stock’s order book and matches orders.',
      'Every trade is published as market data to subscribers.',
    ],
    diagram: { nodes: [['u', 'traffic'], ['m', 'matcher'], ['md', 'pubsub']], wires: ['u>m', 'm>md'] },
  },
  chapter: {
    id: 'exchange',
    title: 'Design a stock exchange',
    seed: 113,
    violationLabels: { unfairFills: 'orders were matched out of turn', lostOrders: 'crashes lost the order book (no standby)' },
    rules: {
      requires: [{ kind: 'matcher', why: 'Orders are matched by a matching engine.' }],
    },
    names: [
      { kind: 'traffic', name: 'Brokers' },
      { kind: 'matcher', name: 'Matching engine' },
      { kind: 'pubsub', name: 'Market data' },
    ],
    data: { matcher: ['symbol → order book (bids, asks)', 'sequenced event log'] },
    requestTypes: [
      { id: 'write', label: 'Order', api: 'newOrder(symbol, side, price, qty)', does: { match: 'match against the book', publish: 'publish the trade' }, needs: ['match', 'publish'], weight: 1, consistency: 'any', distanceMs: 0, fanout: 1 },
    ],
    stages: [main, curveball],
  },
}
