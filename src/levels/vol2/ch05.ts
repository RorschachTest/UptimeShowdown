import type { ChapterEntry } from '../types'
import { v2chapter5 } from '../v2chapter5'

export const v2ch05: ChapterEntry = {
  id: 'v2-05',
  volume: 2,
  number: 5,
  title: 'Design metrics monitoring',
  topic: 'SDI Vol 2 · Metrics monitoring and alerting system',
  play: { kind: 'interview', level: v2chapter5 },
  lesson: {
    summary: 'Buffer a firehose of metric points, store them in a database built for time, and keep dashboards fast.',
    cards: [
      {
        title: 'Two flows',
        body: 'Collection is write-heavy and never stops: every server reports every few seconds. Dashboards and alerts read time ranges. Keep the two paths apart so a dashboard storm can’t stop collection, and vice versa.',
        diagram: {
          nodes: [['u', 'traffic'], ['q', 'queue'], ['w', 'worker'], ['db', 'tsdb'], ['lb', 'lb'], ['web', 'app'], ['c', 'cache']],
          wires: ['u>q', 'q>w', 'w>db', 'u>lb', 'lb>web', 'web>c', 'c>db'],
        },
      },
      {
        title: 'Pull or push',
        body: 'Pull: the collector scrapes each server’s metrics endpoint on a schedule. Push: an agent on each server sends metrics to the collector. Both work at scale.',
        visual: {
          kind: 'versus',
          caption: 'Who starts the conversation.',
          sides: [
            { title: 'Pull (scrape)', hue: 'blue', good: ['Easy to see who is down: the scrape fails', 'Collector controls the rate'], bad: ['Needs service discovery', 'Hard through firewalls'] },
            { title: 'Push (agents)', hue: 'orange', good: ['Works for short-lived jobs', 'Works through firewalls'], bad: ['A dead server just goes quiet', 'Agents can flood the collector'] },
          ],
        },
      },
      {
        title: 'Buffer with a queue',
        body: 'Put Kafka (or similar) between collectors and storage. When the database is slow or a node dies, points wait in the queue instead of being dropped, and consumers catch up afterwards.',
        visual: {
          kind: 'steps',
          caption: 'A database node dies during an incident; nothing is lost.',
          steps: [
            { title: 'Collect', text: 'points keep arriving', hue: 'blue' },
            { title: 'Queue', text: 'holds them while the DB is down', hue: 'yellow' },
            { title: 'Consumers', text: 'catch up when it recovers', hue: 'orange' },
            { title: 'Stored', text: 'graphs fill in, no gaps', hue: 'green' },
          ],
        },
      },
      {
        title: 'A database built for time',
        body: 'A time-series database appends points per series in compressed blocks and reads time ranges sequentially. A general row table updates an index for every point and falls over at this write rate.',
        visual: {
          kind: 'bars',
          caption: 'Write work per metric point.',
          unit: '× work',
          rows: [
            { label: 'Row table', value: 30, hue: 'red', note: 'index update per insert' },
            { label: 'Time-series DB', value: 1, hue: 'green', note: 'append to the series block' },
          ],
        },
      },
      {
        title: 'Downsample old data',
        body: 'Recent data needs full detail; a graph of last year doesn’t. Roll points up to 1 minute after a week and 1 hour after a month, and expire raw data. Storage shrinks and long-range queries read far fewer points.',
        visual: {
          kind: 'bars',
          caption: 'Points to read for a 30-day graph of one series.',
          unit: 'points',
          rows: [
            { label: 'Raw (10 s)', value: 259200, hue: 'red' },
            { label: '1-minute rollup', value: 43200, hue: 'orange' },
            { label: '1-hour rollup', value: 720, hue: 'green' },
          ],
        },
        solves: 'Cheaper storage, faster dashboards.',
        worsens: 'Old data loses detail.',
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v2-05-q1',
        prompt: 'The database is down for 10 seconds. What keeps metric points from being lost?',
        options: [
          { id: 'queue', label: 'A queue between collectors and the database', correct: true },
          { id: 'cache', label: 'A cache in front of the database', correct: false },
          { id: 'lb', label: 'A load balancer', correct: false },
        ],
        explain: 'The queue holds points until consumers can write them again.',
      },
      {
        kind: 'pick',
        id: 'v2-05-q2',
        prompt: 'Why does a time-series database handle metric writes so much better than a row table?',
        options: [
          { id: 'append', label: 'It appends compressed blocks per series instead of updating indexes per row', correct: true },
          { id: 'memory', label: 'It keeps everything in memory', correct: false },
          { id: 'sql', label: 'It doesn’t support queries', correct: false },
        ],
        explain: 'Metrics arrive in time order per series, which suits append-only storage.',
      },
      {
        kind: 'pick',
        id: 'v2-05-q3',
        prompt: 'What does downsampling trade away?',
        options: [
          { id: 'detail', label: 'Detail in old data, for less storage and faster long-range queries', correct: true },
          { id: 'fresh', label: 'Fresh data', correct: false },
          { id: 'alerts', label: 'Alerting', correct: false },
        ],
        explain: 'Last year at 1-hour resolution is plenty for trends.',
      },
    ],
  },
}
