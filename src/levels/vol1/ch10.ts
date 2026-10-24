import { chapter10 } from '../chapter10'
import type { ChapterEntry } from '../types'

export const v1ch10: ChapterEntry = {
  id: 'v1-10',
  volume: 1,
  number: 10,
  title: 'Design a notification system',
  topic: 'SDI Vol 1 · Design a notification system',
  play: { kind: 'interview', level: chapter10 },
  lesson: {
    summary: 'Accept work instantly, deliver it in the background, and survive outside services that fail.',
    cards: [
      {
        title: 'Don’t make callers wait',
        body: 'Calling the push provider inside the request makes every caller wait for it, and fail when it fails. Put the request on a message queue and answer right away; workers send it.',
        visual: { kind: 'versus', caption: 'Where the provider’s slowness and outages end up.', sides: [{ title: 'Call the provider inline', hue: 'red', good: ['Simple'], bad: ['Callers wait ~100 ms on every send', 'Provider down = callers get errors'] }, { title: 'Queue, then workers', hue: 'green', good: ['Callers are answered in a few ms', 'Provider down = messages wait'], bad: ['Delivery is a little later', 'A queue to run'] }] },
        solves: 'Fast answers; spikes and outages become lag, not errors.',
        worsens: 'Delivery happens a little later, and you now run a queue.',
        diagram: {
          nodes: [['u', 'traffic'], ['lb', 'lb'], ['web', 'app'], ['q', 'queue'], ['w', 'worker'], ['p', 'provider']],
          wires: ['u>lb', 'lb>web', 'web>q', 'q>w', 'w>p'],
        },
      },
      {
        title: 'Workers drain the queue',
        body: 'Workers pull messages and call the provider. If they’re slower than the arrival rate, the queue grows and so does the delay. Size the workers for the peak plus the backlog an outage leaves behind.',
        solves: 'Throughput scales by adding workers, independently of the API.',
        worsens: 'Too few workers means growing lag.',
      },
      {
        title: 'Third parties fail',
        body: 'Push, SMS and email providers have outages and rate limits. Retry failed sends with exponential backoff so messages wait out the outage instead of being lost; send what never succeeds to a dead-letter queue.',
        visual: { kind: 'steps', caption: 'Exponential backoff: wait longer after each failure, so a struggling provider can recover.', steps: [{ title: 'Send', text: 'provider answers 503', hue: 'red' }, { title: 'Wait 1 s', text: 'retry: still down', hue: 'yellow' }, { title: 'Wait 2 s, 4 s…', text: 'retry: delivered', hue: 'green' }, { title: 'Never works?', text: 'park it in a dead-letter queue', hue: 'grey' }] },
        solves: 'No lost notifications.',
        worsens: 'At-least-once delivery: some messages go out twice.',
      },
      {
        title: 'Idempotency keys',
        body: 'Give each notification an ID. If a retry repeats a message the provider already delivered, the ID lets it (or you) drop the duplicate.',
        visual: { kind: 'steps', caption: 'The ack got lost, not the message. The key turns the retry into a no-op.', steps: [{ title: 'Send #msg-77', text: 'the phone buzzes', hue: 'green' }, { title: 'Ack lost', text: 'the worker thinks it failed', hue: 'red' }, { title: 'Retry #msg-77', text: 'same key as before', hue: 'yellow' }, { title: 'Provider', text: 'already sent #msg-77: ignore', hue: 'blue' }] },
        solves: 'Retries without double buzzes.',
        worsens: 'An ID to generate and remember per message.',
      },
      {
        title: 'Around the edges',
        body: 'Templates keep messages consistent, user settings and rate limits stop spamming, and tracking delivered and opened events closes the loop.',
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v1-10-q1',
        prompt: 'The provider is down for 10 seconds. With a queue and retries, what do callers see?',
        options: [
          { id: 'ok', label: 'Normal fast answers; delivery is just delayed', correct: true },
          { id: 'err', label: 'Errors for 10 seconds', correct: false },
          { id: 'slow', label: 'Requests hang for 10 seconds', correct: false },
        ],
        explain: 'Callers are answered once the message is queued. The outage only delays delivery.',
      },
      {
        kind: 'pick',
        id: 'v1-10-q2',
        prompt: 'What stops a retried notification from buzzing twice?',
        options: [
          { id: 'key', label: 'An idempotency key per message', correct: true },
          { id: 'queue', label: 'A bigger queue', correct: false },
          { id: 'workers', label: 'More workers', correct: false },
        ],
        explain: 'Retries make delivery at-least-once; the key lets duplicates be recognised and dropped.',
      },
      {
        kind: 'pick',
        id: 'v1-10-q3',
        prompt: 'Messages arrive at 3,000/s and each worker handles 1,000/s. What happens with two workers?',
        options: [
          { id: 'lag', label: 'The queue grows by 1,000 a second and delivery falls further behind', correct: true },
          { id: 'drop', label: 'A third of requests are rejected at once', correct: false },
          { id: 'fine', label: 'Nothing: the queue makes up the difference', correct: false },
        ],
        explain: 'A queue absorbs bursts, not a permanent shortfall.',
      },
    ],
  },
}
