import type { InterviewLevel, Stage } from '../engine/types'

const goals = { uptime: 0.99, p95Ms: 300, maxStaleRate: 0.001, maxLagMs: 30_000, maxViolations: { lostMessages: 0, duplicateSends: 0, duplicateBookings: 0 } }

const main: Stage = {
  id: 'pay-main',
  title: 'A normal day of checkouts',
  story: '1,000 payments a second. 2% of shoppers submit twice. At 0:20 the payment provider (PSP) fails for 15 seconds.',
  durationS: 60,
  traffic: [{ t: 0, rps: 800 }, { t: 10, rps: 1000 }],
  mix: { write: 1 },
  unlocks: { kinds: ['lb', 'app', 'queue', 'worker', 'provider', 'kvstore'], settings: ['tier', 'idempotency'] },
  events: [{ t: 20, kind: 'outage', target: 'provider', durationS: 15 }],
  budget: 150,
  referenceCost: 110,
  goals,
}

const curveball: Stage = {
  id: 'pay-blackfriday',
  title: 'Black Friday',
  story: 'Three times the checkouts, and the PSP is down for 15 seconds again at 0:20.',
  durationS: 60,
  traffic: [{ t: 0, rps: 2000 }, { t: 10, rps: 3000 }],
  mix: { write: 1 },
  unlocks: { kinds: [], settings: [] },
  events: [{ t: 20, kind: 'outage', target: 'provider', durationS: 15 }],
  budget: 250,
  referenceCost: 185,
  goals,
}

/** Volume 2 Chapter 11, inspired by SDI Vol 2 "Payment system". Scenario and numbers are ours. */
export const v2chapter11: InterviewLevel = {
  id: 'payments',
  title: 'Design a payment system',
  prompt: 'Design the payment backend for an online shop: take payments through an outside payment provider and record every one in a ledger.',
  questionBudget: 5,
  editBudget: 3,
  curveball: {
    title: 'Black Friday',
    story: 'Three times the checkouts during another provider outage. You may change at most 3 pieces.',
  },
  questions: [
    { id: 'scale', text: 'How many payments per second?', leverage: 'high', reveals: ['scale'], short: '1,000/s', answer: 'About 1,000 a second at peak.' },
    { id: 'twice', text: 'Do shoppers submit twice?', leverage: 'high', reveals: ['clients'], short: 'yes: ~2%', answer: 'About 2% do: double clicks, or a retry after the page hangs.' },
    { id: 'psp', text: 'How reliable is the payment provider?', leverage: 'high', reveals: ['failures'], short: 'it has outages', answer: 'It has short outages and timeouts. We can’t fix it, only cope.' },
    { id: 'money', text: 'What must never happen?', leverage: 'high', reveals: ['conflicts'], short: 'never charge twice, never lose one', answer: 'Never charge a customer twice, and never lose a payment.' },
    { id: 'latency', text: 'How fast must checkout respond?', leverage: 'high', reveals: ['latency'], short: 'p95 ≤ 300 ms; settle ≤ 30 s', answer: 'The page must answer within 300 ms; the payment can settle within 30 seconds.' },
    { id: 'growth', text: 'Any peaks?', leverage: 'high', reveals: ['growth'], short: 'Black Friday: 3×', answer: 'Black Friday triples checkouts.' },
    { id: 'currency', text: 'Multiple currencies?', leverage: 'low', reveals: [], answer: 'One currency for now.' },
    { id: 'refunds', text: 'Do we handle refunds?', leverage: 'low', reveals: [], answer: 'Later.' },
    { id: 'cards', text: 'Should we store card numbers?', leverage: 'trap', reveals: [], answer: 'No! The provider holds card data; we only see tokens.' },
    { id: 'crypto', text: 'Should we accept crypto?', leverage: 'trap', reveals: [], answer: 'Not today.' },
  ],
  features: [
    { id: 'pay', text: 'Take a payment', core: true },
    { id: 'once', text: 'Never charge twice', core: true },
    { id: 'durable', text: 'Never lose a payment', core: true },
    { id: 'ledger', text: 'Record every payment in a ledger', core: true },
    { id: 'payout', text: 'Pay out to sellers', core: false },
    { id: 'refunds', text: 'Refunds', core: false },
    { id: 'fraud', text: 'Fraud checks', core: false },
  ],
  wrapUp: [
    {
      id: 'recon',
      prompt: 'Our ledger and the provider’s report disagree about one payment. What catches this?',
      options: [
        { id: 'recon', text: 'Nightly reconciliation comparing our ledger with the provider’s settlement files', correct: true },
        { id: 'retry', text: 'More retries', correct: false },
        { id: 'cache', text: 'A cache', correct: false },
        { id: 'nothing', text: 'It can’t happen with idempotency keys', correct: false },
      ],
      explain: 'Systems drift: timeouts, bugs, partial failures. Reconciliation compares records from both sides every day and flags mismatches for fixing.',
    },
  ],
  brief: {
    points: [
      'Shoppers pay at checkout; the payment service answers at once and processes the payment in the background.',
      'Payment executors first record the payment order in a replicated ledger, then call the outside payment provider (PSP), which charges the card.',
      'If the provider fails, the recorded order is retried until it succeeds.',
    ],
    diagram: {
      nodes: [['u', 'traffic'], ['lb', 'lb'], ['api', 'app'], ['q', 'queue'], ['w', 'worker'], ['l', 'kvstore'], ['psp', 'provider']],
      wires: ['u>lb', 'lb>api', 'api>q', 'q>w', 'w>l', 'l>psp'],
    },
  },
  chapter: {
    id: 'payments',
    title: 'Design a payment system',
    seed: 111,
    violationLabels: { lostMessages: 'payments were lost', duplicateSends: 'customers were charged twice by retries', duplicateBookings: 'double submits were charged twice' },
    rules: {
      requires: [{ kind: 'provider', why: 'Cards are charged by an outside payment provider.' }],
    },
    names: [
      { kind: 'traffic', name: 'Shoppers' },
      { kind: 'app', name: 'Payment service' },
      { kind: 'queue', name: 'Payment queue' },
      { kind: 'worker', name: 'Payment executors' },
      { kind: 'provider', name: 'Payment provider (PSP)' },
      { kind: 'kvstore', name: 'Ledger' },
    ],
    data: { kvstore: ['payment id → debit, credit, status'], queue: ['payment id, amount, card token'] },
    requestTypes: [
      { id: 'write', label: 'Payment', api: 'POST /payments', does: { compute: 'check the idempotency key', enqueue: 'queue the payment', work: 'prepare the charge', write: 'record the payment order', deliver: 'charge via the PSP' }, needs: ['compute', 'enqueue', 'work', 'write', 'deliver'], weight: 1, consistency: 'any', distanceMs: 0, asyncAfter: 'enqueue', resubmits: 0.02 },
    ],
    stages: [main, curveball],
  },
}
