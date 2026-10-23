import type { EstimateLevel, NumberCard } from '../engine/types'

// Shared number cards. Units are exponent maps so the strip can check them.
const card = (id: string, label: string, value: number, unit: NumberCard['unit']): NumberCard => ({ id, label, value, unit })
const secondsPerDay = card('s-per-day', '86,400 seconds in a day', 86_400, { s: 1, day: -1 })
const hoursPerDay = card('h-per-day', '24 hours in a day', 24, { hour: 1, day: -1 })
const daysPerYear = card('days-per-year', '365 days in a year', 365, { day: 1, year: -1 })
const daysPerMonth = card('days-per-month', '30 days in a month', 30, { day: 1, month: -1 })
const peak = card('peak', 'Peak is 2× average', 2, {})
const dailyUsers = card('dau', '10M daily users', 10_000_000, { user: 1 })
const photoSize = card('photo-size', '3 MB per photo', 3_000_000, { byte: 1, photo: -1 })

/** Chapter 2, inspired by SDI Vol 1 "Back-of-the-envelope estimation". Scenarios and numbers are ours. */
export const chapter2: EstimateLevel = {
  id: 'estimation',
  title: 'Back-of-the-envelope estimation',
  stages: [
    {
      id: 'sizes',
      title: 'Sizes',
      story: 'Powers of ten and two. Round hard: the order of magnitude is what changes a design.',
      questions: [
        {
          kind: 'pick',
          id: 'billion-kb',
          prompt: 'One billion user records, 1 KB each. How much storage is that?',
          options: [
            { id: 'gb', label: '1 GB', correct: false },
            { id: 'tb', label: '1 TB', correct: true },
            { id: 'pb', label: '1 PB', correct: false },
            { id: 'eb', label: '1 EB', correct: false },
          ],
          explain: '10^9 records × 10^3 bytes = 10^12 bytes = 1 TB. That fits on one disk, but not in one machine’s memory.',
        },
        {
          kind: 'pick',
          id: 'two-thirty',
          prompt: '2^30 bytes is about…',
          options: [
            { id: 'thousand', label: 'a thousand bytes (KB)', correct: false },
            { id: 'million', label: 'a million bytes (MB)', correct: false },
            { id: 'billion', label: 'a billion bytes (GB)', correct: true },
            { id: 'trillion', label: 'a trillion bytes (TB)', correct: false },
          ],
          explain: '2^10 ≈ 1,000, so 2^30 = (2^10)^3 ≈ 1,000^3 = a billion. Memory is counted in powers of two; disks in powers of ten.',
        },
        {
          kind: 'pick',
          id: 'movies',
          prompt: 'A 4K movie is about 20 GB. How many fit on a 10 TB disk?',
          options: [
            { id: '50', label: '50', correct: false },
            { id: '500', label: '500', correct: true },
            { id: '5000', label: '5,000', correct: false },
            { id: '50000', label: '50,000', correct: false },
          ],
          explain: '10 TB ÷ 20 GB = 10,000 GB ÷ 20 GB = 500.',
        },
      ],
    },
    {
      id: 'latency',
      title: 'Latency',
      story: 'Memory is fast, disks are slow, and the speed of light is the slowest of all. This is why caches and CDNs win.',
      questions: [
        {
          kind: 'order',
          id: 'fastest-first',
          prompt: 'Put these in order, fastest first.',
          items: [
            { id: 'l1', label: 'CPU cache hit', value: 1 },
            { id: 'ram', label: 'Read from memory', value: 100 },
            { id: 'ssd', label: 'Random read from an SSD', value: 100_000 },
            { id: 'dc', label: 'Round trip inside a data centre', value: 500_000 },
            { id: 'disk', label: 'Disk seek', value: 10_000_000 },
            { id: 'ocean', label: 'Round trip to another continent', value: 150_000_000 },
          ],
          explain:
            'Roughly 1 ns, 100 ns, 100 µs, 500 µs, 10 ms, 150 ms. Each step is about 10–100× the last; one trip across an ocean costs as much as a million memory reads.',
        },
        {
          kind: 'pick',
          id: 'round-trips',
          prompt: 'A page makes 5 requests one after another to a server on another continent. Roughly how long does it wait?',
          options: [
            { id: '75ms', label: '75 ms', correct: false },
            { id: '750ms', label: '750 ms', correct: true },
            { id: '7s', label: '7.5 s', correct: false },
          ],
          explain: '5 × 150 ms ≈ 750 ms, before the server does any work. Fewer round trips or an edge server (CDN) close to the user fixes this; a faster CPU does not.',
        },
      ],
    },
    {
      id: 'nines',
      title: 'Nines',
      story: 'Availability in "nines". Each extra nine costs much more redundancy.',
      questions: [
        {
          kind: 'pick',
          id: 'three-nines',
          prompt: '99.9% uptime allows about how much downtime a year?',
          options: [
            { id: '52m', label: '52 minutes', correct: false },
            { id: '8.8h', label: '8.8 hours', correct: true },
            { id: '3.65d', label: '3.65 days', correct: false },
          ],
          explain: '0.1% of 8,760 hours ≈ 8.8 hours.',
        },
        {
          kind: 'pick',
          id: 'four-nines',
          prompt: 'And at 99.99%?',
          options: [
            { id: '5m', label: '5 minutes', correct: false },
            { id: '52m', label: '52 minutes', correct: true },
            { id: '8.8h', label: '8.8 hours', correct: false },
          ],
          explain: 'Ten times less than three nines: about 52 minutes a year.',
        },
        {
          kind: 'pick',
          id: 'chain',
          prompt: 'A request passes through two services, each up 99.9% of the time. How available is the whole path?',
          options: [
            { id: '99.99', label: '99.99%', correct: false },
            { id: '99.9', label: '99.9%', correct: false },
            { id: '99.8', label: '99.8%', correct: true },
          ],
          explain: 'In a chain, availabilities multiply: 0.999 × 0.999 ≈ 0.998. Every hop you add lowers the total; redundant copies side by side raise it.',
        },
      ],
    },
    {
      id: 'qps',
      title: 'Requests per second',
      story: 'A recipe app has 10M daily users, and each views about 20 recipes a day. Build each answer as one chain of × and ÷.',
      questions: [
        {
          kind: 'equation',
          id: 'avg-qps',
          prompt: 'On average, how many recipe views per second?',
          cards: [dailyUsers, card('views', '20 views per user per day', 20, { view: 1, user: -1, day: -1 }), secondsPerDay, hoursPerDay, daysPerMonth, peak],
          answer: (10_000_000 * 20) / 86_400,
          unit: { view: 1, s: -1 },
          explain: '10M users × 20 views/user/day ÷ 86,400 s/day ≈ 2,300 views/s. Hours in a day would give views per hour.',
        },
        {
          kind: 'equation',
          id: 'peak-qps',
          prompt: 'Size for the peak, not the average. Peak views per second?',
          cards: [dailyUsers, card('views', '20 views per user per day', 20, { view: 1, user: -1, day: -1 }), secondsPerDay, peak, daysPerYear],
          answer: ((10_000_000 * 20) / 86_400) * 2,
          unit: { view: 1, s: -1 },
          explain: 'The average × 2 ≈ 4,600 views/s. That is above what one SQL database handles (~1,000/s), which is what this number is for: it tells you a cache or replicas are needed.',
        },
      ],
    },
    {
      id: 'storage',
      title: 'Storage & bandwidth',
      story: 'The recipe app adds photos: users upload 200,000 a day, about 3 MB each, and every photo is kept for 5 years.',
      questions: [
        {
          kind: 'equation',
          id: 'five-years',
          prompt: 'How much photo storage after 5 years?',
          cards: [
            card('uploads', '200,000 photos uploaded a day', 200_000, { photo: 1, day: -1 }),
            photoSize,
            daysPerYear,
            card('years', 'Kept for 5 years', 5, { year: 1 }),
            secondsPerDay,
            dailyUsers,
          ],
          answer: 200_000 * 3_000_000 * 365 * 5,
          unit: { byte: 1 },
          explain: '200k photos/day × 3 MB × 365 days × 5 years ≈ 1.1 PB. Petabytes mean object storage, not a database.',
        },
        {
          kind: 'equation',
          id: 'egress',
          prompt: 'Each daily user views 30 photos a day. On average, how much data leaves your servers per second?',
          cards: [dailyUsers, card('photo-views', '30 photo views per user per day', 30, { photo: 1, user: -1, day: -1 }), photoSize, secondsPerDay, daysPerYear, peak],
          answer: (10_000_000 * 30 * 3_000_000) / 86_400,
          unit: { byte: 1, s: -1 },
          explain: '10M × 30 × 3 MB ÷ 86,400 s ≈ 10 GB/s on average. Egress like that is the case for a CDN.',
        },
      ],
    },
  ],
}
