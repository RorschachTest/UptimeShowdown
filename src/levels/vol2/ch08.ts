import type { ChapterEntry } from '../types'
import { v2chapter8 } from '../v2chapter8'

export const v2ch08: ChapterEntry = {
  id: 'v2-08',
  volume: 2,
  number: 8,
  title: 'Design an email service',
  topic: 'SDI Vol 2 · Distributed email service',
  play: { kind: 'interview', level: v2chapter8 },
  lesson: {
    summary: 'Three flows share one mailbox store: reading in the browser, sending out over SMTP, and receiving in.',
    cards: [
      {
        title: 'Three flows',
        body: 'Webmail reads go through web servers and a cache to the mailbox store. Outgoing mail is queued and sent by SMTP workers to the recipient’s server. Incoming mail arrives over SMTP, is checked and stored. Each flow scales on its own.',
        diagram: {
          nodes: [['u', 'traffic'], ['lb', 'lb'], ['web', 'app'], ['c', 'cache'], ['q', 'queue'], ['w', 'worker'], ['p', 'provider'], ['kv', 'kvstore']],
          wires: ['u>lb', 'lb>web', 'web>c', 'c>kv', 'web>q', 'u>q', 'q>w', 'w>p', 'w>kv'],
        },
      },
      {
        title: 'Store and forward',
        body: 'Email was built for unreliable networks. A sender’s server keeps a message in its queue and retries delivery for hours or days, with growing waits between tries, and only bounces it after giving up.',
        visual: {
          kind: 'steps',
          caption: 'The recipient’s server is down for a while.',
          steps: [
            { title: 'Send', text: 'recipient’s server refuses', hue: 'red' },
            { title: 'Queue', text: 'message waits, retry in 1 min', hue: 'yellow' },
            { title: 'Retry', text: '5 min, 15 min… still keyed by message ID', hue: 'orange' },
            { title: 'Delivered', text: 'once, thanks to the ID', hue: 'green' },
          ],
        },
        solves: 'Mail survives outages anywhere on the internet.',
        worsens: 'Delivery can be late, and retries need IDs to avoid duplicates.',
      },
      {
        title: 'Mailboxes by user',
        body: 'Almost every query is “this user’s folder, newest first”. Partition the mailbox store by user ID and keep each folder sorted by time, with several copies so a cut-off node loses nothing.',
        visual: {
          kind: 'versus',
          caption: 'Where to keep mailboxes.',
          sides: [
            { title: 'One SQL database', hue: 'red', good: ['Familiar'], bad: ['Billions of messages on one box', 'One box down = everyone’s mail down'] },
            { title: 'Partitioned, replicated store', hue: 'green', good: ['Grows by adding nodes', 'Quorum copies survive a cut-off'], bad: ['Cross-user queries are hard'] },
          ],
        },
      },
      {
        title: 'Checks before storing',
        body: 'Incoming and outgoing mail pass through workers that scan for spam and viruses before anything is stored or sent. Doing this in the background keeps both the web app and the SMTP connections fast.',
        visual: {
          kind: 'bars',
          caption: 'Incoming mail on a normal day vs newsletter Monday.',
          unit: '/s',
          rows: [
            { label: 'Normal', value: 1500, hue: 'teal' },
            { label: 'Monday 9 am', value: 6000, hue: 'red', note: 'workers and mailbox nodes must absorb it' },
          ],
        },
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v2-08-q1',
        prompt: 'The recipient’s server is down. What does our outgoing path do?',
        options: [
          { id: 'retry', label: 'Keep it queued and retry with backoff', correct: true },
          { id: 'drop', label: 'Drop it', correct: false },
          { id: 'block', label: 'Make the sender wait', correct: false },
        ],
        explain: 'Store and forward: retry for a long time before bouncing.',
      },
      {
        kind: 'pick',
        id: 'v2-08-q2',
        prompt: 'How should mailboxes be partitioned?',
        options: [
          { id: 'user', label: 'By user ID', correct: true },
          { id: 'date', label: 'By date', correct: false },
          { id: 'sender', label: 'By sender', correct: false },
        ],
        explain: 'Nearly every read is one user’s folder, so keep a user’s mail together.',
      },
      {
        kind: 'pick',
        id: 'v2-08-q3',
        prompt: 'What stops a retried email from arriving twice?',
        options: [
          { id: 'id', label: 'A message ID the receiver can de-duplicate on', correct: true },
          { id: 'queue', label: 'A bigger queue', correct: false },
          { id: 'cache', label: 'An inbox cache', correct: false },
        ],
        explain: 'Retries are at-least-once; IDs make them safe.',
      },
    ],
  },
}
