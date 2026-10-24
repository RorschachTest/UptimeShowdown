import type { ChapterEntry } from '../types'
import { v2chapter12 } from '../v2chapter12'

export const v2ch12: ChapterEntry = {
  id: 'v2-12',
  volume: 2,
  number: 12,
  title: 'Design a digital wallet',
  topic: 'SDI Vol 2 · Digital wallet',
  play: { kind: 'interview', level: v2chapter12 },
  lesson: {
    summary: 'Move money between accounts on different shards at high speed, without ever creating or destroying it.',
    cards: [
      {
        title: 'One transfer, two shards',
        body: 'A transfer debits one account and credits another. With accounts spread over shards, those are two databases: if one update happens and the other doesn’t, money is created or destroyed.',
        diagram: { nodes: [['u', 'traffic'], ['lb', 'lb'], ['w', 'wallet']], wires: ['u>lb', 'lb>w'] },
      },
      {
        title: 'Distributed transactions',
        body: 'Two-phase commit asks every shard to prepare, then commit: atomic, but locks are held across the network and a dead participant blocks everyone. Sagas commit step by step and undo with compensating steps when one fails.',
        visual: {
          kind: 'versus',
          caption: 'Keeping two shards in step.',
          sides: [
            { title: 'Two-phase commit', hue: 'blue', good: ['Atomic'], bad: ['Slow: locks across shards', 'Blocks when a shard dies'] },
            { title: 'Saga', hue: 'orange', good: ['No global locks'], bad: ['Briefly inconsistent', 'Compensation for every step'] },
          ],
        },
      },
      {
        title: 'Event sourcing',
        body: 'Validate each transfer command once, then append it as an event to an ordered log. Balances are state computed by replaying events. A crash loses nothing that was logged: replay rebuilds the state. The log doubles as a perfect audit trail.',
        visual: {
          kind: 'steps',
          caption: 'Command → event → state.',
          steps: [
            { title: 'Command', text: 'transfer $10 A → B', hue: 'blue' },
            { title: 'Validate', text: 'A has $50: ok', hue: 'yellow' },
            { title: 'Event', text: 'append “A −10, B +10” to the log', hue: 'purple' },
            { title: 'State', text: 'apply: A = 40, B = +10; replay after a crash', hue: 'green' },
          ],
        },
      },
      {
        title: 'Throughput',
        body: 'Appending to a log is sequential and fast; state machines can be partitioned and replicated with Raft. That is how event-sourced ledgers reach very high transfer rates while staying exact.',
        visual: {
          kind: 'bars',
          caption: 'Transfers per shard per second (illustrative).',
          unit: '/s',
          rows: [
            { label: 'Event sourcing', value: 10000, hue: 'green' },
            { label: 'Saga', value: 6600, hue: 'orange' },
            { label: 'Two-phase commit', value: 4000, hue: 'red' },
          ],
        },
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v2-12-q1',
        prompt: 'A shard dies after debiting A but before crediting B (no transaction). What happened?',
        options: [
          { id: 'destroy', label: 'Money was destroyed', correct: true },
          { id: 'fine', label: 'Nothing: B will be credited later', correct: false },
          { id: 'created', label: 'Money was created', correct: false },
        ],
        explain: 'The debit stuck and the credit didn’t: the total shrank.',
      },
      {
        kind: 'pick',
        id: 'v2-12-q2',
        prompt: 'What is the main weakness of two-phase commit?',
        options: [
          { id: 'block', label: 'Locks across shards make it slow, and a failed participant blocks others', correct: true },
          { id: 'wrong', label: 'It isn’t atomic', correct: false },
          { id: 'audit', label: 'It can’t be audited', correct: false },
        ],
        explain: 'It is correct, but costly and fragile under failure.',
      },
      {
        kind: 'pick',
        id: 'v2-12-q3',
        prompt: 'How does an event-sourced ledger recover after a crash?',
        options: [
          { id: 'replay', label: 'It replays its event log to rebuild balances', correct: true },
          { id: 'backup', label: 'It restores last night’s backup', correct: false },
          { id: 'ask', label: 'It asks users for their balances', correct: false },
        ],
        explain: 'State is a function of the log.',
      },
    ],
  },
}
