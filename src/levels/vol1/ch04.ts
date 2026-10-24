import { chapter4 } from '../chapter4'
import type { ChapterEntry } from '../types'

export const v1ch04: ChapterEntry = {
  id: 'v1-04',
  volume: 1,
  number: 4,
  title: 'Design a rate limiter',
  topic: 'SDI Vol 1 · Design a rate limiter',
  play: { kind: 'interview', level: chapter4 },
  lesson: {
    summary: 'Cap how much each client may send, cheaply, without hurting real users.',
    cards: [
      {
        title: 'Why limit',
        body: 'Scrapers, buggy clients and floods can use up capacity meant for everyone. A rate limiter rejects the excess before it reaches your servers.',
        solves: 'Protects the system and keeps costs predictable.',
        worsens: 'Set it too tight and real users get "429 Too Many Requests".',
        diagram: { nodes: [['u', 'traffic'], ['rl', 'ratelimit'], ['web', 'app'], ['db', 'sqldb']], wires: ['u>rl', 'rl>web', 'web>db'] },
      },
      {
        title: 'Token bucket and leaking bucket',
        body: 'A token bucket refills at the limit and lets a client spend saved tokens in a burst. A leaking bucket queues requests and lets them out at a steady rate, smoothing bursts at the cost of waiting.',
        visual: { kind: 'versus', caption: 'Both cap the average rate; they treat bursts differently.', sides: [{ title: 'Token bucket', hue: 'green', good: ['Tokens refill at the limit', 'A quiet client saves tokens for a burst'], bad: ['Bursts reach your servers'] }, { title: 'Leaking bucket', hue: 'blue', good: ['A queue drains at a fixed rate', 'Perfectly smooth outflow'], bad: ['Bursts wait in line: added latency'] }] },
        solves: 'Token bucket suits bursty real users; leaking bucket gives a steady outflow.',
        worsens: 'Leaking bucket adds latency; both need tuning per client.',
      },
      {
        title: 'Counting windows',
        body: 'A fixed window counts per clock minute but lets up to 2× through at the edge of two windows. A sliding log is exact but stores a timestamp per request. A sliding counter blends two windows: nearly exact and cheap.',
        visual: { kind: 'versus', caption: 'Three ways to count requests per minute.', sides: [{ title: 'Fixed window', hue: 'orange', good: ['One counter per minute'], bad: ['Up to 2× at a window edge'] }, { title: 'Sliding log', hue: 'purple', good: ['Exact'], bad: ['A timestamp per request: memory'] }, { title: 'Sliding counter', hue: 'green', good: ['Nearly exact', 'Two counters'], bad: ['An approximation'] }] },
      },
      {
        title: 'Many limiters, one count',
        body: 'At scale the limiter runs on several servers. If each keeps its own counts, a client gets the limit once per server. Keep counters in a shared store with atomic increments so the limit means what it says.',
        visual: { kind: 'bars', caption: 'What a scraper really gets with a limit of 10/s on each of 3 limiters.', unit: 'req/s', rows: [{ label: 'Local counters', value: 30, hue: 'red', note: 'each limiter counts only what it sees' }, { label: 'Shared counter', value: 10, hue: 'green', note: 'one atomic count in a shared store' }] },
        solves: 'One true limit across every limiter.',
        worsens: 'An extra hop (about a millisecond) and a store to run.',
        diagram: { nodes: [['u', 'traffic'], ['lb', 'lb'], ['rl', 'ratelimit'], ['web', 'app']], wires: ['u>lb', 'lb>rl', 'rl>web'] },
      },
      {
        title: 'Tell clients when to come back',
        body: 'Reject with HTTP 429 and a Retry-After header, so well-behaved clients back off instead of retrying immediately.',
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v1-04-q1',
        prompt: 'Real users send ~1 request a second with bursts of 5 when the app opens. Which algorithm lets the bursts through at a low limit?',
        options: [
          { id: 'token', label: 'Token bucket', correct: true },
          { id: 'fixed', label: 'Fixed window', correct: false },
          { id: 'log', label: 'Sliding log', correct: false },
        ],
        explain: 'The bucket saves up tokens while the user is quiet, then spends them on the burst.',
      },
      {
        kind: 'pick',
        id: 'v1-04-q2',
        prompt: 'Three limiter servers each keep local counts with a limit of 10/s. What does a client actually get?',
        options: [
          { id: '10', label: '10/s', correct: false },
          { id: '30', label: '30/s', correct: true },
          { id: '3', label: '3/s', correct: false },
        ],
        explain: 'Each server counts only what it sees, so the client gets 10/s from each. Shared counters fix it.',
      },
      {
        kind: 'pick',
        id: 'v1-04-q3',
        prompt: 'Which response tells a client it was rate-limited?',
        options: [
          { id: '429', label: '429 Too Many Requests', correct: true },
          { id: '503', label: '503 Service Unavailable', correct: false },
          { id: '403', label: '403 Forbidden', correct: false },
        ],
        explain: '429 with Retry-After says "you, specifically, slow down", while 503 means the service itself is struggling.',
      },
    ],
  },
}
