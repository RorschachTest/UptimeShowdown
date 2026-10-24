import { chapter8 } from '../chapter8'
import type { ChapterEntry } from '../types'

export const v1ch08: ChapterEntry = {
  id: 'v1-08',
  volume: 1,
  number: 8,
  title: 'Design a URL shortener',
  topic: 'SDI Vol 1 · Design a URL shortener',
  play: { kind: 'interview', level: chapter8 },
  lesson: {
    summary: 'Turn a unique ID into a short code, and serve a read-heavy redirect from cache.',
    cards: [
      {
        title: 'Two endpoints',
        body: 'POST a long URL and get a short one back; GET the short URL and get redirected. Redirects outnumber new links many times over, so the design is shaped by reads.',
        solves: 'A tiny API that is easy to scale.',
        worsens: 'Every redirect is a lookup that must be fast.',
        diagram: {
          nodes: [['u', 'traffic'], ['lb', 'lb'], ['web', 'app'], ['c', 'cache'], ['g', 'idgen'], ['db', 'sqldb']],
          wires: ['u>lb', 'lb>web', 'web>c', 'c>db', 'web>g', 'g>db'],
        },
      },
      {
        title: '301 or 302',
        body: 'A 301 (permanent) lets browsers remember the target and skip you next time: less load. A 302 (temporary) sends every click through you: more load, but you can count clicks.',
        visual: { kind: 'versus', caption: 'The status code decides whether the browser comes back to you next time.', sides: [{ title: '301 Moved Permanently', hue: 'teal', good: ['Browser caches it: repeat clicks never reach you', 'Less load'], bad: ['You can’t count those clicks'] }, { title: '302 Found', hue: 'orange', good: ['Every click passes through you', 'Click analytics work'], bad: ['Every click costs you a request'] }] },
        solves: '301 cuts load; 302 enables analytics.',
        worsens: '301 hides clicks; 302 costs capacity.',
      },
      {
        title: 'Hash and fix collisions',
        body: 'Hash the long URL (e.g. CRC32 or MD5) and keep the first 7 characters. Different URLs can collide, so check the database and re-hash with a salt until the code is free.',
        visual: { kind: 'steps', caption: 'Short hashes collide, so every write must check first.', steps: [{ title: 'Hash', text: 'CRC32(long URL) → take 7 chars', hue: 'blue' }, { title: 'Look up', text: 'is that code already taken?', hue: 'purple' }, { title: 'Taken?', text: 'add a salt and hash again', hue: 'red' }, { title: 'Free', text: 'store code → URL', hue: 'green' }] },
        solves: 'No ID service needed; the same URL can map to the same code.',
        worsens: 'An extra database read on every write, and collisions grow with the table.',
      },
      {
        title: 'Base62 of a unique ID',
        body: 'Ask an ID generator for a unique number and write it in base 62 (0-9, a-z, A-Z). Seven characters cover 62^7 ≈ 3.5 trillion codes, and there are no collisions by construction.',
        visual: { kind: 'steps', caption: 'Base62 is just another way to write the number, so unique IDs give unique codes.', steps: [{ title: 'Get an ID', text: '2,009,215,674,938 from the ID generator', hue: 'green' }, { title: 'Divide by 62', text: 'keep the remainders, again and again', hue: 'blue' }, { title: 'Map digits', text: '0–9, a–z, A–Z', hue: 'purple' }, { title: 'Short code', text: 'zn9edcu', hue: 'orange' }] },
        solves: 'No collisions, no extra lookups.',
        worsens: 'Depends on a unique ID generator; codes are guessable in sequence.',
      },
      {
        title: 'Cache the hot links',
        body: 'Most clicks go to a small set of popular links. A cache in front of the database answers them in a millisecond and keeps a viral link from flattening the database.',
        visual: { kind: 'bars', caption: 'Database reads per second for 3,800 redirects a second.', unit: 'reads/s', rows: [{ label: 'No cache', value: 3800, hue: 'red', note: 'one database read per click' }, { label: '95% cache hits', value: 190, hue: 'green', note: 'only the misses reach the database' }] },
        solves: 'Redirects stay fast and the database stays calm.',
        worsens: 'More memory to pay for.',
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v1-08-q1',
        prompt: 'How many distinct codes do 7 base62 characters give?',
        options: [
          { id: '3.5t', label: 'About 3.5 trillion', correct: true },
          { id: '78b', label: 'About 78 billion', correct: false },
          { id: '10m', label: 'About 10 million', correct: false },
        ],
        explain: '62^7 ≈ 3.5 × 10^12. Six characters give about 57 billion.',
      },
      {
        kind: 'pick',
        id: 'v1-08-q2',
        prompt: 'You need to count every click. Which redirect?',
        options: [
          { id: '302', label: '302 Found', correct: true },
          { id: '301', label: '301 Moved Permanently', correct: false },
        ],
        explain: 'Browsers cache 301s and stop asking you, so you’d miss repeat clicks.',
      },
      {
        kind: 'pick',
        id: 'v1-08-q3',
        prompt: 'Why does base62-of-an-ID never collide?',
        options: [
          { id: 'unique', label: 'Each ID is unique, and base62 is just another way to write the number', correct: true },
          { id: 'random', label: 'The characters are random', correct: false },
          { id: 'check', label: 'It checks the database first', correct: false },
        ],
        explain: 'Base conversion is one-to-one, so unique IDs give unique codes.',
      },
    ],
  },
}
