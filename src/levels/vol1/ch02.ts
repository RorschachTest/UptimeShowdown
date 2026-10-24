import { chapter2 } from '../chapter2'
import type { ChapterEntry } from '../types'

export const v1ch02: ChapterEntry = {
  id: 'v1-02',
  volume: 1,
  number: 2,
  title: 'Back-of-the-envelope estimation',
  topic: 'SDI Vol 1 · Back-of-the-envelope estimation',
  play: { kind: 'estimate', level: chapter2 },
  lesson: {
    summary: 'Turn "lots of traffic" into a few numbers that decide the design. Round hard, keep the units.',
    cards: [
      {
        title: 'Estimate first, choose second',
        body: 'A design for 1,000 requests a second and one for 1,000,000 are different systems. A quick estimate tells you whether one database is enough, whether you need a cache, or whether you must shard.',
      },
      {
        title: 'Requests per second',
        body: 'Daily users × actions per user per day ÷ 86,400 seconds in a day. Then size for the peak, typically about 2× the average.',
        visual: { kind: 'steps', caption: 'From users to requests per second, keeping the units.', steps: [{ title: 'Users', text: '10M daily users', hue: 'blue' }, { title: '× actions', text: '× 20 views each per day', hue: 'orange' }, { title: '÷ seconds', text: '÷ ~100,000 s per day', hue: 'purple' }, { title: 'Average', text: '≈ 2,000 requests/s', hue: 'teal' }, { title: 'Peak', text: '× 2–3 ≈ 5,000/s', hue: 'red' }] },
      },
      {
        title: 'Storage and bandwidth',
        body: 'Storage = writes per day × size × days kept. Bandwidth = requests per second × response size. Reads usually dominate egress, which is what a CDN cuts.',
      },
      {
        title: 'Latency numbers to know',
        body: 'Memory ~100 ns, SSD read ~100 µs, a round trip inside a data centre ~0.5 ms, a disk seek ~10 ms, across an ocean ~150 ms. Each step is about 10–100× the last.',
        visual: { kind: 'bars', caption: 'Rough costs worth remembering.', unit: 'µs', rows: [{ label: 'Read from memory', value: 0.1, hue: 'green' }, { label: 'SSD random read', value: 150, hue: 'blue' }, { label: 'Same-datacenter call', value: 500, hue: 'teal' }, { label: 'Disk seek', value: 10000, hue: 'orange' }, { label: 'Cross-continent trip', value: 150000, hue: 'red' }] },
      },
      {
        title: 'Nines',
        body: '99.9% uptime allows about 8.8 hours of downtime a year; 99.99% about 52 minutes. Services in a chain multiply their availability, so every hop lowers the total.',
        visual: { kind: 'bars', caption: 'Downtime allowed per year.', unit: 'minutes', rows: [{ label: '99%', value: 5256, hue: 'red', note: 'about 3.7 days' }, { label: '99.9%', value: 526, hue: 'orange', note: 'about 9 hours' }, { label: '99.99%', value: 53, hue: 'teal' }, { label: '99.999%', value: 5, hue: 'green' }] },
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v1-02-q1',
        prompt: 'Peak load is usually about how many times the daily average?',
        options: [
          { id: '1', label: '1×', correct: false },
          { id: '2', label: '2×', correct: true },
          { id: '10', label: '10×', correct: false },
        ],
        explain: 'About 2× is the usual starting assumption; bursty products can be higher. Size for the peak, not the average.',
      },
      {
        kind: 'pick',
        id: 'v1-02-q2',
        prompt: 'Your estimate says 7,000 writes a second. One SQL database handles roughly 1,000. What does that tell you?',
        options: [
          { id: 'fine', label: 'One database is fine', correct: false },
          { id: 'cache', label: 'Add a cache', correct: false },
          { id: 'shard', label: 'The writes need sharding or a higher-throughput store', correct: true },
        ],
        explain: 'Caches absorb reads, not writes. 7× over one primary means splitting the data. That conclusion is the whole point of estimating.',
      },
    ],
  },
}
