import type { InterviewLevel, Stage } from '../engine/types'

const goals = { uptime: 0.99, p95Ms: 200, maxStaleRate: 0.001, maxLagMs: 15_000, maxViolations: { lostMessages: 0, duplicateSends: 0 } }

const main: Stage = {
  id: 'notify-main',
  title: 'A normal evening',
  story: 'Our services ask for 3,000 notifications a second. At 0:20 the push provider goes down for 10 seconds.',
  durationS: 60,
  traffic: [{ t: 0, rps: 2000 }, { t: 10, rps: 3000 }],
  mix: { write: 1 },
  unlocks: { kinds: ['lb', 'app', 'queue', 'worker', 'provider'], settings: ['tier'] },
  events: [{ t: 20, kind: 'outage', target: 'provider', durationS: 10 }],
  budget: 170,
  referenceCost: 125,
  goals,
}

const curveball: Stage = {
  id: 'notify-campaign',
  title: 'The marketing blast',
  story: 'Marketing sends a sale alert to everyone: 9,000 requests a second from 0:10 to 0:30, and the provider still drops out at 0:20.',
  durationS: 60,
  traffic: [{ t: 0, rps: 3000 }, { t: 10, rps: 9000 }, { t: 30, rps: 9000 }, { t: 31, rps: 3000 }],
  mix: { write: 1 },
  unlocks: { kinds: [], settings: [] },
  events: [{ t: 20, kind: 'outage', target: 'provider', durationS: 10 }],
  budget: 330,
  referenceCost: 285,
  goals,
}

/** Chapter 10, inspired by SDI Vol 1 "Design a notification system". Scenario and numbers are ours. */
export const chapter10: InterviewLevel = {
  id: 'notifications',
  title: 'Design a notification system',
  prompt: 'Other teams call our API to send push notifications to users. Design the system that gets them delivered.',
  questionBudget: 5,
  editBudget: 2,
  curveball: {
    title: 'The marketing blast',
    story: 'Three times the requests for twenty seconds, during a provider outage. You may change at most 2 pieces.',
  },
  questions: [
    { id: 'scale', text: 'How many notifications per second?', leverage: 'high', reveals: ['scale'], short: '3,000/s', answer: 'About 3,000 a second in the evening peak.' },
    { id: 'latency', text: 'How quickly must the API answer, and the phone buzz?', leverage: 'high', reveals: ['latency'], short: 'API ≤ 200 ms; delivery ≤ 15 s', answer: 'The calling service must get an answer within 200 ms. The phone should buzz within 15 seconds.' },
    { id: 'failures', text: 'What if the push provider is down?', leverage: 'high', reveals: ['failures'], short: 'it happens; never lose one', answer: 'It goes down for seconds at a time every week. We must not lose notifications when it does.' },
    { id: 'dupes', text: 'Is it OK to send one twice?', leverage: 'high', reveals: ['conflicts'], short: 'no: never twice', answer: 'No. Two “your order shipped” buzzes look broken.' },
    { id: 'growth', text: 'Are there big spikes?', leverage: 'high', reveals: ['growth'], short: 'marketing blasts: 3×', answer: 'Marketing blasts triple the rate for a short while.' },
    { id: 'limits', text: 'Does the provider have limits?', leverage: 'high', reveals: ['abuse'], short: '20,000/s max', answer: 'It accepts up to about 20,000 a second from us; beyond that it rejects.' },
    { id: 'channels', text: 'Which devices do we support?', leverage: 'low', reveals: [], answer: 'iOS and Android through one push provider. SMS and email are another team’s job.' },
    { id: 'optout', text: 'Can users opt out?', leverage: 'low', reveals: [], answer: 'Yes, the calling services check that before calling us.' },
    { id: 'kafka', text: 'Kafka or RabbitMQ?', leverage: 'trap', reveals: [], answer: 'Either. Why do you want a queue at all?' },
    { id: 'polling', text: 'Can phones just poll for notifications?', leverage: 'trap', reveals: [], answer: 'That drains batteries. We use push.' },
  ],
  features: [
    { id: 'send', text: 'Accept a send request', core: true },
    { id: 'deliver', text: 'Deliver to the phone', core: true },
    { id: 'reliable', text: 'Never lose a notification', core: true },
    { id: 'once', text: 'Never send one twice', core: true },
    { id: 'templates', text: 'Message templates', core: false },
    { id: 'schedule', text: 'Scheduled sends', core: false },
    { id: 'analytics', text: 'Open-rate analytics', core: false },
  ],
  brief: {
    points: [
      'Other teams’ services call our API when something happens: an order shipped, a friend request, a sale.',
      'We turn each call into a push notification and hand it to the push provider, an outside service that delivers it to the phone.',
      'Callers must not be slowed down by us or by the provider.',
    ],
    diagram: { nodes: [['u', 'traffic'], ['lb', 'lb'], ['web', 'app'], ['q', 'queue'], ['w', 'worker'], ['p', 'provider']], wires: ['u>lb', 'lb>web', 'web>q', 'q>w', 'w>p'] },
  },
  wrapUp: [
    {
      id: 'queue',
      prompt: 'Why put a message queue between the API servers and the workers?',
      options: [
        { id: 'decouple', text: 'The API answers at once, and spikes or outages wait in the queue instead of failing', correct: true },
        { id: 'fast', text: 'It makes each notification faster to deliver', correct: false },
        { id: 'order', text: 'It guarantees exactly-once delivery by itself', correct: false },
        { id: 'cheap', text: 'It removes the need for workers', correct: false },
      ],
      explain: 'The queue decouples accepting work from doing it: callers aren’t slowed by the provider, and a spike or an outage becomes lag instead of errors. Exactly-once still needs retries plus idempotency keys.',
    },
  ],
  chapter: {
    id: 'notifications',
    title: 'Design a notification system',
    seed: 10,
    violationLabels: { lostMessages: 'notifications were lost', duplicateSends: 'notifications were sent twice' },
    rules: {
      requires: [{ kind: 'queue', why: 'Sending must not wait on the provider: put a message queue between the API and the workers.' }],
    },
    names: [{ kind: 'traffic', name: 'Calling services' }, { kind: 'app', name: 'Notification API' }, { kind: 'queue', name: 'Notify queue' }, { kind: 'worker', name: 'Push workers' }, { kind: 'provider', name: 'APNs / FCM' }],
    data: { queue: ['msg id, user, payload'] },
    requestTypes: [{ id: 'write', label: 'Notification', api: 'POST /notify', does: { compute: 'check, load settings', enqueue: 'queue the message', work: 'build the push', deliver: 'push to the phone' }, needs: ['compute', 'enqueue', 'work', 'deliver'], weight: 1, consistency: 'any', distanceMs: 0, asyncAfter: 'enqueue' }],
    stages: [main, curveball],
  },
}
