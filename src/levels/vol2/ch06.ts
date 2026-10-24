import type { ChapterEntry } from '../types'
import { v2chapter6 } from '../v2chapter6'

export const v2ch06: ChapterEntry = {
  id: 'v2-06',
  volume: 2,
  number: 6,
  title: 'Design ad click aggregation',
  topic: 'SDI Vol 2 · Ad click event aggregation',
  play: { kind: 'interview', level: v2chapter6 },
  lesson: {
    summary: 'Count a firehose of events per key per minute, exactly, even when events are late, repeated or concentrated on one key.',
    cards: [
      {
        title: 'Stream, aggregate, store',
        body: 'Clicks land in a queue. A stream aggregator reads them and keeps running counts per ad per minute. When a minute closes, its totals are written to a database that dashboards and billing query.',
        diagram: {
          nodes: [['u', 'traffic'], ['q', 'queue'], ['agg', 'aggregator'], ['db', 'tsdb'], ['lb', 'lb'], ['api', 'app']],
          wires: ['u>q', 'q>agg', 'agg>db', 'u>lb', 'lb>api', 'api>db'],
        },
      },
      {
        title: 'Event time and watermarks',
        body: 'Count a click in the minute it happened (event time), not when it arrived. Some arrive late. A watermark keeps each window open a little after it ends so stragglers still count; longer watermarks are more accurate but later.',
        visual: {
          kind: 'steps',
          caption: 'The 10:01 window with a 15-second watermark.',
          steps: [
            { title: '10:01:00', text: 'window opens', hue: 'blue' },
            { title: '10:02:00', text: 'minute ends; window stays open', hue: 'yellow' },
            { title: '10:02:09', text: 'a late 10:01 click arrives: counted', hue: 'green' },
            { title: '10:02:15', text: 'watermark passes: total is final', hue: 'purple' },
          ],
        },
      },
      {
        title: 'Exactly once',
        body: 'Upstream retries mean some clicks arrive twice. Keep each click ID seen in the window (or use a transactional pipeline) so each click is counted once.',
        visual: {
          kind: 'bars',
          caption: 'Clicks miscounted per minute at 50,000 clicks a second. Watermarks plus dedupe bring both to zero.',
          unit: 'clicks',
          rows: [
            { label: 'Drop late events', value: 150000, hue: 'red' },
            { label: 'No dedupe', value: 30000, hue: 'orange' },
          ],
        },
      },
      {
        title: 'Hot keys',
        body: 'Partitioning by ad sends every click for a viral ad to one node. Split hot ads across several nodes with a salt, count partially, then merge.',
        visual: {
          kind: 'versus',
          caption: 'One viral ad.',
          sides: [
            { title: 'By ad ID', hue: 'red', good: ['Simple'], bad: ['One node does a third of all the work'] },
            { title: 'Ad ID + salt', hue: 'green', good: ['Load spread evenly'], bad: ['An extra merge step'] },
          ],
        },
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v2-06-q1',
        prompt: 'A click from 10:01:50 arrives at 10:02:07. Which minute should count it?',
        options: [
          { id: '1001', label: '10:01, its event time', correct: true },
          { id: '1002', label: '10:02, when it arrived', correct: false },
          { id: 'none', label: 'Neither: it’s late', correct: false },
        ],
        explain: 'Bill for when the click happened; a watermark gives late events time to land in the right window.',
      },
      {
        kind: 'pick',
        id: 'v2-06-q2',
        prompt: 'What stops a retried click from being billed twice?',
        options: [
          { id: 'dedupe', label: 'De-duplicating by click ID', correct: true },
          { id: 'water', label: 'A longer watermark', correct: false },
          { id: 'salt', label: 'Salting hot keys', correct: false },
        ],
        explain: 'The click ID identifies the duplicate.',
      },
      {
        kind: 'pick',
        id: 'v2-06-q3',
        prompt: 'One ad gets a third of all clicks. What keeps its node from being swamped?',
        options: [
          { id: 'salt', label: 'Split its key across nodes and merge the partial counts', correct: true },
          { id: 'bigger', label: 'A bigger single node', correct: false },
          { id: 'drop', label: 'Drop some of its clicks', correct: false },
        ],
        explain: 'Spread the hot key, then sum.',
      },
    ],
  },
}
