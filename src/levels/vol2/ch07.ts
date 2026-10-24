import type { ChapterEntry } from '../types'
import { v2chapter7 } from '../v2chapter7'

export const v2ch07: ChapterEntry = {
  id: 'v2-07',
  volume: 2,
  number: 7,
  title: 'Design a hotel reservation system',
  topic: 'SDI Vol 2 · Hotel reservation system',
  play: { kind: 'interview', level: v2chapter7 },
  lesson: {
    summary: 'Two different bugs sell rooms wrongly: two guests racing for the last room, and one guest clicking twice. Each has its own fix.',
    cards: [
      {
        title: 'Inventory as counts',
        body: 'Store, per hotel, room type and date, how many rooms exist and how many are reserved. A reservation increments the reserved count if it stays at or below the total, inside one transaction.',
        diagram: { nodes: [['u', 'traffic'], ['lb', 'lb'], ['api', 'app'], ['c', 'cache'], ['db', 'sqldb']], wires: ['u>lb', 'lb>api', 'api>c', 'c>db'] },
      },
      {
        title: 'Two guests, one room',
        body: 'Both read “1 left”, both write “reserved + 1”, and the room is sold twice. Pessimistic locking makes the second wait; optimistic locking (a version number or a database constraint) lets both try and rejects the loser, who retries.',
        visual: {
          kind: 'versus',
          caption: 'Stopping the race.',
          sides: [
            { title: 'Pessimistic (lock rows)', hue: 'blue', good: ['Never a conflict at commit'], bad: ['Locks hold up every writer', 'Deadlock risk'] },
            { title: 'Optimistic (version check)', hue: 'green', good: ['No locks; cheap when conflicts are rare'], bad: ['Retries pile up when everyone wants the same room'] },
          ],
        },
      },
      {
        title: 'One guest, two clicks',
        body: 'A double click or a retry after a timeout sends the same reservation twice. Locks don’t help: it isn’t a race between guests. Give each reservation an idempotency key generated on the booking page; the server returns the first result for a repeated key.',
        visual: {
          kind: 'steps',
          caption: 'Idempotency key in action.',
          steps: [
            { title: 'Page loads', text: 'reservation id r-81 is generated', hue: 'blue' },
            { title: 'Click', text: 'POST r-81 → reserved', hue: 'green' },
            { title: 'Click again', text: 'POST r-81 → same reservation returned', hue: 'yellow' },
          ],
        },
      },
      {
        title: 'Scaling',
        body: 'Searches can come from a cache; reservations must hit the database. Shard inventory by hotel when one database is not enough: a reservation touches only one hotel, so it stays a single-shard transaction.',
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v2-07-q1',
        prompt: 'Two guests try to book the last room at the same moment. Which prevents selling it twice?',
        options: [
          { id: 'cc', label: 'Optimistic or pessimistic concurrency control on the inventory row', correct: true },
          { id: 'idem', label: 'An idempotency key', correct: false },
          { id: 'cache', label: 'A cache', correct: false },
        ],
        explain: 'It’s a race between different requests; concurrency control serialises them.',
      },
      {
        kind: 'pick',
        id: 'v2-07-q2',
        prompt: 'One guest clicks “Book” twice. Which prevents two reservations?',
        options: [
          { id: 'idem', label: 'An idempotency key', correct: true },
          { id: 'lock', label: 'Row locks', correct: false },
          { id: 'replica', label: 'Read replicas', correct: false },
        ],
        explain: 'The repeat carries the same key, so the server recognises it.',
      },
      {
        kind: 'pick',
        id: 'v2-07-q3',
        prompt: 'When does optimistic locking struggle?',
        options: [
          { id: 'contention', label: 'When many writers want the same rows at once', correct: true },
          { id: 'reads', label: 'When reads are heavy', correct: false },
          { id: 'small', label: 'When the database is small', correct: false },
        ],
        explain: 'Every conflict means a retry; under heavy contention, retries dominate.',
      },
    ],
  },
}
