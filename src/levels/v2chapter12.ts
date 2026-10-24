import type { InterviewLevel, Stage } from '../engine/types'

const goals = { uptime: 0.99, p95Ms: 100, maxStaleRate: 0.001, maxViolations: { moneyImbalance: 0 } }

const main: Stage = {
  id: 'wallet-main',
  title: 'An ordinary day',
  story: '30,000 transfers and 5,000 balance checks a second. A ledger shard crashes at 0:30.',
  durationS: 60,
  traffic: [{ t: 0, rps: 25000 }, { t: 10, rps: 35000 }],
  mix: { write: 30 / 35, page: 5 / 35 },
  unlocks: { kinds: ['lb', 'wallet'], settings: [] },
  events: [{ t: 30, kind: 'crash', target: 'wallet', durationS: 10 }],
  budget: 200,
  referenceCost: 135,
  goals,
}

const curveball: Stage = {
  id: 'wallet-payday',
  title: 'Payday',
  story: 'Everyone gets paid and pays their bills: 90,000 transfers a second. A shard still crashes at 0:30.',
  durationS: 60,
  traffic: [{ t: 0, rps: 60000 }, { t: 10, rps: 95000 }],
  mix: { write: 90 / 95, page: 5 / 95 },
  unlocks: { kinds: [], settings: [] },
  events: [{ t: 30, kind: 'crash', target: 'wallet', durationS: 10 }],
  budget: 430,
  referenceCost: 315,
  goals,
}

/** Volume 2 Chapter 12, inspired by SDI Vol 2 "Digital wallet". Scenario and numbers are ours. */
export const v2chapter12: InterviewLevel = {
  id: 'wallet',
  title: 'Design a digital wallet',
  prompt: 'Design a wallet where people hold a balance and send money to each other instantly. Money must never appear or disappear.',
  questionBudget: 5,
  editBudget: 1,
  curveball: {
    title: 'Payday',
    story: 'Three times the transfers. You may change 1 piece.',
  },
  questions: [
    { id: 'scale', text: 'How many transfers per second?', leverage: 'high', reveals: ['scale', 'mix'], short: '30,000 transfers + 5,000 checks/s', answer: 'About 30,000 transfers and 5,000 balance checks a second.' },
    { id: 'correct', text: 'How correct must balances be?', leverage: 'high', reveals: ['conflicts'], short: 'exact: money never appears or vanishes', answer: 'Exactly right. The total of all balances must never change because of a bug or a crash.' },
    { id: 'shards', text: 'Can one database hold every account?', leverage: 'high', reveals: ['data'], short: 'no: sharded; most transfers cross shards', answer: 'No, accounts are spread over shards, so most transfers touch two of them.' },
    { id: 'failures', text: 'What fails?', leverage: 'high', reveals: ['failures'], short: 'shards crash mid-transfer', answer: 'Shards crash, sometimes in the middle of a transfer.' },
    { id: 'audit', text: 'Do we need an audit trail?', leverage: 'high', reveals: ['ordering'], short: 'yes: replay any balance', answer: 'Yes. Regulators can ask how any balance came to be, at any point in time.' },
    { id: 'growth', text: 'Any peaks?', leverage: 'high', reveals: ['growth'], short: 'payday: 3×', answer: 'Payday triples transfers.' },
    { id: 'fx', text: 'Multiple currencies?', leverage: 'low', reveals: [], answer: 'No.' },
    { id: 'kyc', text: 'Identity checks?', leverage: 'low', reveals: [], answer: 'Done at signup by another team.' },
    { id: 'blockchain', text: 'Should we use a blockchain?', leverage: 'trap', reveals: [], answer: 'We control every node. What problem would it solve?' },
    { id: 'cache', text: 'Can we cache balances?', leverage: 'trap', reveals: [], answer: 'A stale balance lets someone spend money they don’t have.' },
  ],
  features: [
    { id: 'send', text: 'Send money instantly', core: true },
    { id: 'balance', text: 'Check my balance', core: true },
    { id: 'exact', text: 'Money never appears or vanishes', core: true },
    { id: 'audit', text: 'Full audit history', core: true },
    { id: 'topup', text: 'Top up from a card', core: false },
    { id: 'requests', text: 'Request money', core: false },
    { id: 'fx', text: 'Currency exchange', core: false },
  ],
  wrapUp: [
    {
      id: 'es',
      prompt: 'How does event sourcing survive a crash in the middle of a transfer?',
      options: [
        { id: 'replay', text: 'The validated transfer is already in the append-only log; the shard rebuilds its state by replaying it', correct: true },
        { id: 'lock', text: 'It locks both accounts until the shard returns', correct: false },
        { id: 'comp', text: 'It runs a compensating transfer', correct: false },
        { id: 'retry', text: 'The client retries until it works', correct: false },
      ],
      explain: 'Commands are validated, then written as events to an ordered log. State (balances) is a pure function of the log, so after a crash it is rebuilt by replay: nothing is half-applied, and the log is the audit trail.',
    },
  ],
  brief: {
    points: [
      'People send money to each other; each transfer debits one account and credits another.',
      'Accounts are spread over ledger shards, so most transfers touch two shards.',
      'The total of all balances must never change, even when a shard crashes mid-transfer.',
    ],
    diagram: { nodes: [['u', 'traffic'], ['lb', 'lb'], ['w', 'wallet']], wires: ['u>lb', 'lb>w'] },
  },
  chapter: {
    id: 'wallet',
    title: 'Design a digital wallet',
    seed: 112,
    violationLabels: { moneyImbalance: 'transfers created or destroyed money' },
    rules: {
      requires: [{ kind: 'wallet', why: 'Balances live in the wallet ledger.' }],
    },
    names: [
      { kind: 'traffic', name: 'Wallet apps' },
      { kind: 'lb', name: 'Load balancer' },
      { kind: 'wallet', name: 'Wallet ledger' },
    ],
    data: { wallet: ['account → balance (+ event log)'] },
    requestTypes: [
      { id: 'write', label: 'Transfer', api: 'POST /transfers', does: { write: 'debit one account, credit another' }, needs: ['write'], weight: 1, consistency: 'any', distanceMs: 0 },
      { id: 'page', label: 'Balance', api: 'GET /balance', does: { lookup: 'read the balance' }, needs: ['lookup'], weight: 0.2, consistency: 'any', distanceMs: 0 },
    ],
    stages: [main, curveball],
  },
}
