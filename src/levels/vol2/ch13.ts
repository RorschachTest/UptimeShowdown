import type { ChapterEntry } from '../types'
import { v2chapter13 } from '../v2chapter13'

export const v2ch13: ChapterEntry = {
  id: 'v2-13',
  volume: 2,
  number: 13,
  title: 'Design a stock exchange',
  topic: 'SDI Vol 2 · Stock exchange',
  play: { kind: 'interview', level: v2chapter13 },
  lesson: {
    summary: 'Match orders in microseconds, in a strict order anyone can replay, and never lose the book.',
    cards: [
      {
        title: 'The critical path',
        body: 'An order passes a gateway, risk checks, the sequencer and the matching engine; every trade goes out as market data. Everything on this path is kept in memory and on as few machines as possible.',
        diagram: { nodes: [['u', 'traffic'], ['m', 'matcher'], ['md', 'pubsub']], wires: ['u>m', 'm>md'] },
      },
      {
        title: 'Microseconds, not milliseconds',
        body: 'A database round trip per order would cap the exchange at a few thousand orders a second. The order book lives in memory; durability comes from writing every sequenced event to a log.',
        visual: {
          kind: 'bars',
          caption: 'Time to match one order.',
          unit: 'µs',
          rows: [
            { label: 'Order book in a database', value: 5000, hue: 'red' },
            { label: 'In memory + event log', value: 50, hue: 'green' },
          ],
        },
      },
      {
        title: 'The sequencer',
        body: 'Every incoming order gets a sequence number before matching. The engine processes events strictly in that order, so it is a deterministic state machine: fair to everyone, and the whole day can be replayed to the same trades.',
        visual: {
          kind: 'steps',
          caption: 'Deterministic matching.',
          steps: [
            { title: 'Orders arrive', text: 'from many brokers at once', hue: 'blue' },
            { title: 'Sequencer', text: 'stamps 1001, 1002, 1003…', hue: 'yellow' },
            { title: 'Engine', text: 'matches in stamp order', hue: 'green' },
            { title: 'Replay', text: 'same log → same trades', hue: 'purple' },
          ],
        },
      },
      {
        title: 'Hot standby',
        body: 'A standby engine consumes the same sequenced log and holds an identical order book. When the primary dies, the standby takes over in milliseconds without losing an order.',
        solves: 'No lost orders, almost no downtime.',
        worsens: 'Twice the hardware on the critical path.',
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v2-13-q1',
        prompt: 'Why keep the order book in memory?',
        options: [
          { id: 'speed', label: 'Matching takes microseconds instead of a database round trip', correct: true },
          { id: 'cheap', label: 'Memory is cheaper than disk', correct: false },
          { id: 'safe', label: 'Memory never fails', correct: false },
        ],
        explain: 'Durability comes from the event log and the standby, not from writing each order to a database.',
      },
      {
        kind: 'pick',
        id: 'v2-13-q2',
        prompt: 'What does the sequencer guarantee?',
        options: [
          { id: 'order', label: 'A single, total order of events that matching follows exactly', correct: true },
          { id: 'price', label: 'The best price', correct: false },
          { id: 'speed', label: 'Lower latency', correct: false },
        ],
        explain: 'That total order makes matching fair and replayable.',
      },
      {
        kind: 'pick',
        id: 'v2-13-q3',
        prompt: 'How does a hot standby stay in sync?',
        options: [
          { id: 'log', label: 'It applies the same sequenced event log', correct: true },
          { id: 'copy', label: 'It copies the primary’s memory every second', correct: false },
          { id: 'db', label: 'It reads a shared database', correct: false },
        ],
        explain: 'Deterministic engine + same events = same state.',
      },
    ],
  },
}
