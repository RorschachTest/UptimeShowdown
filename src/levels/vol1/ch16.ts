import type { EstimateQuestion } from '../../engine/types'
import { chapter16 } from '../chapter16'
import type { ChapterEntry } from '../types'
import { v1ch05 } from './ch05'
import { v1ch06 } from './ch06'
import { v1ch07 } from './ch07'
import { v1ch10 } from './ch10'
import { v1ch11 } from './ch11'
import { v1ch14 } from './ch14'
import { v2ch04 } from '../vol2/ch04'
import { v2ch12 } from '../vol2/ch12'
import { v2ch13 } from '../vol2/ch13'

/** One question from a chapter's own quiz, for the mixed review. */
function from(entry: ChapterEntry, id: string): EstimateQuestion {
  const q = entry.lesson.quiz.find((x) => x.id === id)
  if (!q) throw new Error(`No question ${id} in ${entry.id}`)
  return q
}

export const v1ch16: ChapterEntry = {
  id: 'v1-16',
  volume: 1,
  number: 16,
  title: 'The grand tour',
  topic: 'SDI Vol 1 · The learning continues',
  play: { kind: 'ladder', chapter: chapter16 },
  lesson: {
    summary: 'The patterns behind every chapter, a mixed review, and one product to grow from launch to viral with everything you’ve learned.',
    cards: [
      {
        title: 'Find the bottleneck, fix that',
        body: 'Every chapter followed the same loop: put traffic on a design, find the piece that breaks first, and apply the smallest change that fixes that kind of bottleneck. Then the bottleneck moves.',
        visual: {
          kind: 'steps',
          caption: 'The loop behind every design.',
          steps: [
            { title: 'Requirements', text: 'ask what changes the design', hue: 'blue' },
            { title: 'Simple design', text: 'the fewest pieces that work', hue: 'teal' },
            { title: 'Load it', text: 'find what breaks first', hue: 'yellow' },
            { title: 'Fix that', text: 'smallest change, then repeat', hue: 'green' },
          ],
        },
        diagram: {
          nodes: [['u', 'traffic'], ['cdn', 'cdn'], ['lb', 'lb'], ['web', 'app'], ['c', 'cache'], ['kv', 'kvstore'], ['q', 'queue'], ['w', 'worker']],
          wires: ['u>cdn', 'cdn>lb', 'lb>web', 'web>c', 'c>kv', 'web>q', 'q>w'],
        },
      },
      {
        title: 'Scaling reads',
        body: 'Most systems read far more than they write. Push reads as close to the user as possible and as far from the database as possible.',
        visual: {
          kind: 'versus',
          caption: 'Three ways to take reads off the database.',
          sides: [
            { title: 'CDN', hue: 'teal', good: ['Static bytes near users'], bad: ['Only for files'] },
            { title: 'Cache', hue: 'blue', good: ['Hot data in memory'], bad: ['Staleness, cold starts'] },
            { title: 'Replicas', hue: 'purple', good: ['More read capacity'], bad: ['Replication lag'] },
          ],
        },
      },
      {
        title: 'Scaling writes',
        body: 'Writes can’t be cached away. Split the data (sharding, consistent hashing), absorb bursts with queues, and do slow work in the background.',
        visual: {
          kind: 'versus',
          caption: 'Three ways to handle more writes.',
          sides: [
            { title: 'Shard', hue: 'purple', good: ['Each node owns a slice'], bad: ['Cross-shard operations get hard'] },
            { title: 'Queue', hue: 'yellow', good: ['Bursts become lag, not errors'], bad: ['Results arrive later'] },
            { title: 'Batch / sample', hue: 'orange', good: ['Far less work'], bad: ['Less detail or freshness'] },
          ],
        },
      },
      {
        title: 'Failure is normal',
        body: 'Servers, disks, networks and outside providers fail every day at scale. Keep spare capacity (N + 1), keep copies, fail over, and back off when retrying.',
        visual: {
          kind: 'steps',
          caption: 'Survive the crash you know is coming.',
          steps: [
            { title: 'Headroom', text: 'one spare of everything', hue: 'blue' },
            { title: 'Copies', text: 'replicas, quorums, erasure coding', hue: 'purple' },
            { title: 'Failover', text: 'standbys and load balancers', hue: 'teal' },
            { title: 'Back off', text: 'retries with jitter', hue: 'green' },
          ],
        },
      },
      {
        title: 'Correctness is a feature',
        body: 'The worst bugs return 200 OK: duplicate charges, double bookings, lost messages, money that appears. Each has a known fix: idempotency keys, concurrency control, acks and commits, atomic transfers, sequencers.',
        visual: {
          kind: 'bars',
          caption: 'Chapters where a silent wrong answer was the real enemy.',
          unit: 'chapters',
          rows: [
            { label: 'Duplicates', value: 6, hue: 'orange', note: 'IDs, notifications, payments, bookings, clicks, messages' },
            { label: 'Lost data', value: 7, hue: 'red', note: 'queues, storage, ledgers, order books' },
            { label: 'Ordering', value: 3, hue: 'purple', note: 'IDs, chat, exchange' },
          ],
        },
      },
    ],
    quiz: [
      from(v1ch05, 'v1-05-q4'),
      from(v1ch06, 'v1-06-q1'),
      from(v1ch07, 'v1-07-q1'),
      from(v1ch10, 'v1-10-q2'),
      from(v1ch11, 'v1-11-q1'),
      from(v1ch14, 'v1-14-q2'),
      from(v2ch04, 'v2-04-q3'),
      from(v2ch12, 'v2-12-q1'),
      from(v2ch13, 'v2-13-q2'),
    ],
  },
}
