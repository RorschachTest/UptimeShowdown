import { chapter11 } from '../chapter11'
import type { ChapterEntry } from '../types'

export const v1ch11: ChapterEntry = {
  id: 'v1-11',
  volume: 1,
  number: 11,
  title: 'Design a news feed system',
  topic: 'SDI Vol 1 · Design a news feed system',
  play: { kind: 'interview', level: chapter11 },
  lesson: {
    summary: 'Precompute feeds by pushing posts to followers, except for the accounts too big to push.',
    cards: [
      {
        title: 'Two flows',
        body: 'Publishing stores the post and hands it to a fanout service through a queue. Retrieval reads a ready-made list of post IDs for the user from the feed cache.',
        solves: 'Posting answers instantly; feeds open from cache.',
        worsens: 'Feeds are eventually consistent: a post appears a few seconds later.',
        diagram: { nodes: [['u', 'traffic'], ['lb', 'lb'], ['q', 'queue'], ['f', 'feed']], wires: ['u>lb', 'lb>q', 'q>f', 'lb>f'] },
      },
      {
        title: 'Fanout on write (push)',
        body: 'When someone posts, add the post ID to every follower’s feed right away. Reading a feed is then one cache lookup.',
        visual: { kind: 'bars', caption: 'Feed writes caused by one post with fanout on write.', unit: 'writes', rows: [{ label: 'Typical account', value: 200, hue: 'green' }, { label: 'Celebrity', value: 20000000, hue: 'red', note: 'one post, twenty million feed writes' }] },
        solves: 'Fast, simple reads.',
        worsens: 'One write per follower: catastrophic for accounts with millions of followers, and wasted on inactive users.',
      },
      {
        title: 'Fanout on read (pull)',
        body: 'Store posts once; when a user opens their feed, fetch recent posts from everyone they follow and merge them.',
        visual: { kind: 'bars', caption: 'Work to open one feed.', unit: 'fetches', rows: [{ label: 'Push (precomputed)', value: 1, hue: 'green' }, { label: 'Hybrid', value: 6, hue: 'teal', note: 'your feed + the ~5 celebrities you follow' }, { label: 'Pull', value: 100, hue: 'red', note: 'everyone you follow, on every open' }] },
        solves: 'Posting costs one write, whoever posts.',
        worsens: 'Every feed open fetches from ~100 accounts: slow and expensive at read time.',
      },
      {
        title: 'Hybrid',
        body: 'Push posts from ordinary accounts; for the few celebrities a user follows, pull their recent posts at read time and merge. Most of the work stays precomputed, and no post fans out to millions.',
        visual: { kind: 'versus', caption: 'Each post takes the path that is cheap for it.', sides: [{ title: 'Normal accounts: push', hue: 'blue', good: ['~200 cheap writes per post', 'Feeds ready before anyone asks'], bad: [] }, { title: 'Celebrities: pull', hue: 'purple', good: ['One write per post', 'Merged in when a follower opens their feed'], bad: ['A few extra reads per feed open'] }] },
        solves: 'Fast reads without the celebrity problem.',
        worsens: 'Two paths to build and keep consistent.',
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v1-11-q1',
        prompt: 'An account with 20 million followers posts. With fanout on write, how many feed writes does that cause?',
        options: [
          { id: '20m', label: 'About 20 million', correct: true },
          { id: '1', label: 'One', correct: false },
          { id: '100', label: 'About 100', correct: false },
        ],
        explain: 'Push writes the post into every follower’s feed.',
      },
      {
        kind: 'pick',
        id: 'v1-11-q2',
        prompt: 'Which strategy makes opening the feed slowest?',
        options: [
          { id: 'read', label: 'Fanout on read', correct: true },
          { id: 'write', label: 'Fanout on write', correct: false },
          { id: 'hybrid', label: 'Hybrid', correct: false },
        ],
        explain: 'Pull fetches posts from everyone you follow at the moment you open the feed.',
      },
      {
        kind: 'pick',
        id: 'v1-11-q3',
        prompt: 'Why put a queue between posting and fanout?',
        options: [
          { id: 'fast', label: 'The poster gets an answer at once; fanout runs in the background', correct: true },
          { id: 'order', label: 'To rank the posts', correct: false },
          { id: 'dedupe', label: 'To stop duplicate posts', correct: false },
        ],
        explain: 'Fanout can take seconds; nobody should wait for it.',
      },
    ],
  },
}
