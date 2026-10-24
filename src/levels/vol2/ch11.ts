import type { ChapterEntry } from '../types'
import { v2chapter11 } from '../v2chapter11'

export const v2ch11: ChapterEntry = {
  id: 'v2-11',
  volume: 2,
  number: 11,
  title: 'Design a payment system',
  topic: 'SDI Vol 2 · Payment system',
  play: { kind: 'interview', level: v2chapter11 },
  lesson: {
    summary: 'Move money exactly once through systems that fail: record first, retry safely, and reconcile.',
    cards: [
      {
        title: 'The pay-in flow',
        body: 'The payment service accepts the order and answers at once. An executor records the payment order in the ledger, then asks the payment provider (PSP) to charge the card, retrying until it gets a definite answer.',
        diagram: {
          nodes: [['u', 'traffic'], ['lb', 'lb'], ['api', 'app'], ['q', 'queue'], ['w', 'worker'], ['l', 'kvstore'], ['psp', 'provider']],
          wires: ['u>lb', 'lb>api', 'api>q', 'q>w', 'w>l', 'l>psp'],
        },
      },
      {
        title: 'Exactly once = retries + idempotency',
        body: 'Networks time out, so you must retry. A retry of a charge that actually went through would charge twice, unless every request carries an idempotency key the receiver de-duplicates on. Use one key from the shopper to us, and one from us to the PSP.',
        visual: {
          kind: 'steps',
          caption: 'A timeout that would have charged twice.',
          steps: [
            { title: 'Charge', text: 'PSP charges the card…', hue: 'blue' },
            { title: 'Timeout', text: '…but the reply is lost', hue: 'red' },
            { title: 'Retry, same key', text: 'PSP sees the key', hue: 'yellow' },
            { title: 'Once', text: 'returns the first result, no second charge', hue: 'green' },
          ],
        },
      },
      {
        title: 'Double-entry ledger',
        body: 'Every payment is recorded as a debit on one account and an equal credit on another. The sum of all entries is always zero, which makes mistakes visible.',
        visual: {
          kind: 'bars',
          caption: 'One $40 purchase in the ledger.',
          unit: '$',
          rows: [
            { label: 'Buyer: debit', value: 40, hue: 'red' },
            { label: 'Seller: credit', value: 40, hue: 'green', note: 'debits and credits always balance' },
          ],
        },
      },
      {
        title: 'Reconciliation',
        body: 'Every night, compare our ledger with the PSP’s settlement file. Mismatches (timeouts, bugs, partial failures) are flagged and fixed. It is the safety net behind every other guarantee.',
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v2-11-q1',
        prompt: 'A charge request times out. What is safe?',
        options: [
          { id: 'retry', label: 'Retry with the same idempotency key', correct: true },
          { id: 'new', label: 'Retry with a new request', correct: false },
          { id: 'give', label: 'Give up and tell the shopper it failed', correct: false },
        ],
        explain: 'The PSP returns the original result if the first attempt actually succeeded.',
      },
      {
        kind: 'pick',
        id: 'v2-11-q2',
        prompt: 'Why record the payment order before calling the PSP?',
        options: [
          { id: 'trace', label: 'So a crash mid-charge leaves a record to retry or reconcile', correct: true },
          { id: 'fast', label: 'It makes the charge faster', correct: false },
          { id: 'cache', label: 'To cache card numbers', correct: false },
        ],
        explain: 'If you charge first and crash, nothing remembers that money moved.',
      },
      {
        kind: 'pick',
        id: 'v2-11-q3',
        prompt: 'What does reconciliation compare?',
        options: [
          { id: 'ledger', label: 'Our ledger with the provider’s settlement records', correct: true },
          { id: 'cache', label: 'The cache with the database', correct: false },
          { id: 'queue', label: 'The queue with the workers', correct: false },
        ],
        explain: 'Two independent records of the same money must agree.',
      },
    ],
  },
}
