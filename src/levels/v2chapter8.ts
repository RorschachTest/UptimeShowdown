import type { InterviewLevel, Stage } from '../engine/types'

const goals = {
  uptime: 0.99,
  p95Ms: 300,
  maxStaleRate: 0.001,
  maxLagMs: 30_000,
  maxViolations: { lostMessages: 0, duplicateSends: 0 },
}

const main: Stage = {
  id: 'mail-main',
  title: 'A working day of email',
  story: '3,000 inbox opens, 500 sent and 1,500 incoming emails a second. At 0:20 a big remote mail server stops answering for 15 seconds; at 0:35 a mailbox node is cut off for 15 seconds.',
  durationS: 60,
  traffic: [{ t: 0, rps: 4000 }, { t: 10, rps: 5000 }],
  mix: { page: 0.6, write: 0.1, inbound: 0.3 },
  unlocks: { kinds: ['lb', 'app', 'cache', 'kvstore', 'queue', 'worker', 'provider'], settings: ['tier'] },
  events: [
    { t: 20, kind: 'outage', target: 'provider', durationS: 15 },
    { t: 35, kind: 'partition', target: 'kvstore', durationS: 15 },
  ],
  budget: 290,
  referenceCost: 205,
  goals,
}

const curveball: Stage = {
  id: 'mail-newsletters',
  title: 'Newsletter Monday',
  story: 'Every newsletter goes out at 9 am: incoming mail jumps to 6,000 a second. The same remote outage and node cut-off follow.',
  durationS: 60,
  traffic: [{ t: 0, rps: 5000 }, { t: 10, rps: 9500 }],
  mix: { page: 3000 / 9500, write: 500 / 9500, inbound: 6000 / 9500 },
  unlocks: { kinds: [], settings: [] },
  events: [
    { t: 20, kind: 'outage', target: 'provider', durationS: 15 },
    { t: 35, kind: 'partition', target: 'kvstore', durationS: 15 },
  ],
  budget: 440,
  referenceCost: 330,
  goals,
}

/** Volume 2 Chapter 8, inspired by SDI Vol 2 "Distributed email service". Scenario and numbers are ours. */
export const v2chapter8: InterviewLevel = {
  id: 'email',
  title: 'Design an email service',
  prompt: 'Design a webmail service: people read their inbox in the browser, send mail to anyone on the internet, and receive mail from anyone.',
  questionBudget: 5,
  editBudget: 2,
  curveball: {
    title: 'Newsletter Monday',
    story: 'Incoming mail quadruples at 9 am. You may change at most 2 pieces.',
  },
  questions: [
    { id: 'scale', text: 'How much mail comes and goes per second?', leverage: 'high', reveals: ['scale', 'mix'], short: '3,000 opens, 500 sent, 1,500 incoming/s', answer: 'About 3,000 inbox opens, 500 sends and 1,500 incoming emails a second.' },
    { id: 'lose', text: 'Can an email ever be lost?', leverage: 'high', reveals: ['failures'], short: 'never; remote servers and nodes fail', answer: 'Never. Remote mail servers go down, and our own storage nodes get cut off, and mail must survive both.' },
    { id: 'twice', text: 'Is it OK to deliver an email twice?', leverage: 'high', reveals: ['conflicts'], short: 'no duplicates', answer: 'No. Duplicate emails look broken and annoy people.' },
    { id: 'latency', text: 'How fast must the inbox open?', leverage: 'high', reveals: ['latency'], short: 'p95 ≤ 300 ms', answer: 'Under 300 ms at p95.' },
    { id: 'delivery', text: 'How fast must mail arrive?', leverage: 'high', reveals: ['freshness'], short: 'within 30 s', answer: 'Within about 30 seconds, end to end.' },
    { id: 'growth', text: 'Are there daily peaks?', leverage: 'high', reveals: ['growth'], short: 'newsletters: 4× incoming at 9 am', answer: 'Every Monday at 9 am the newsletters arrive: four times the incoming mail.' },
    { id: 'attach', text: 'How big are attachments?', leverage: 'low', reveals: [], answer: 'Up to 25 MB; they go to object storage. Not today’s problem.' },
    { id: 'search', text: 'Do we need search?', leverage: 'low', reveals: [], answer: 'Yes, but another team is building it.' },
    { id: 'imap', text: 'Should we support IMAP or POP3?', leverage: 'trap', reveals: [], answer: 'Our users only use the web app.' },
    { id: 'gmail', text: 'Can we just forward everything to Gmail?', leverage: 'trap', reveals: [], answer: 'We are building the email service.' },
  ],
  features: [
    { id: 'read', text: 'Read my inbox', core: true },
    { id: 'send', text: 'Send email to anyone', core: true },
    { id: 'receive', text: 'Receive email from anyone', core: true },
    { id: 'safe', text: 'Never lose or duplicate mail', core: true },
    { id: 'search', text: 'Full-text search', core: false },
    { id: 'attach', text: 'Large attachments', core: false },
    { id: 'spam', text: 'Spam filtering', core: false },
  ],
  wrapUp: [
    {
      id: 'retry',
      prompt: 'A recipient’s mail server is down. What should our outgoing path do?',
      options: [
        { id: 'retry', text: 'Keep the message in the outgoing queue and retry with backoff, with a message ID so retries aren’t duplicated', correct: true },
        { id: 'bounce', text: 'Bounce it back to the sender at once', correct: false },
        { id: 'drop', text: 'Drop it; the sender can resend', correct: false },
        { id: 'block', text: 'Make the sender wait until it works', correct: false },
      ],
      explain: 'SMTP is store-and-forward: queue outgoing mail, retry with backoff for hours or days, and only bounce after giving up. Message IDs keep retries from arriving twice.',
    },
  ],
  brief: {
    points: [
      'People use our web app to read and send mail; other mail servers on the internet send mail to our users over SMTP.',
      'Sending must not wait on the recipient’s server, and every message must end up stored in the recipient’s mailbox.',
      'Mailboxes live in a replicated key-value store, partitioned by user.',
    ],
    diagram: {
      nodes: [['u', 'traffic'], ['lb', 'lb'], ['web', 'app'], ['c', 'cache'], ['q', 'queue'], ['w', 'worker'], ['p', 'provider'], ['kv', 'kvstore']],
      wires: ['u>lb', 'lb>web', 'web>c', 'c>kv', 'web>q', 'u>q', 'q>w', 'w>p', 'w>kv'],
    },
  },
  chapter: {
    id: 'email',
    title: 'Design an email service',
    seed: 108,
    violationLabels: { lostMessages: 'emails were lost', duplicateSends: 'emails were delivered twice' },
    rules: {
      requires: [{ kind: 'kvstore', why: 'Mailboxes need a replicated store.' }],
      mustPassThrough: [{ types: ['page'], kind: 'cache', why: 'Inbox opens are the hot path: check a cache before the mailbox store.' }],
    },
    names: [
      { kind: 'traffic', name: 'People & mail servers' },
      { kind: 'lb', name: 'Load balancer' },
      { kind: 'app', name: 'Web servers' },
      { kind: 'cache', name: 'Inbox cache' },
      { kind: 'queue', name: 'Mail queue' },
      { kind: 'worker', name: 'SMTP workers' },
      { kind: 'provider', name: 'Other mail servers' },
      { kind: 'kvstore', name: 'Mailbox store' },
    ],
    data: { kvstore: ['userId → folders → messages'], cache: ['userId → latest inbox page'], queue: ['message id, to, body'] },
    requestTypes: [
      { id: 'page', label: 'Open inbox', api: 'GET /mailboxes/{id}', does: { compute: 'load the folder', lookup: 'read the newest messages' }, needs: ['compute', 'lookup'], weight: 1, consistency: 'any', distanceMs: 0 },
      { id: 'write', label: 'Send email', api: 'POST /messages', does: { compute: 'check and sign the message', enqueue: 'queue for sending', work: 'spam and virus check', deliver: 'SMTP to the recipient’s server' }, needs: ['compute', 'enqueue', 'work', 'deliver'], weight: 1, consistency: 'any', distanceMs: 0, asyncAfter: 'enqueue' },
      { id: 'inbound', label: 'Incoming email', api: 'SMTP in', does: { enqueue: 'accept and queue', work: 'spam and virus check', write: 'store in the mailbox' }, needs: ['enqueue', 'work', 'write'], weight: 1, consistency: 'any', distanceMs: 0, asyncAfter: 'enqueue' },
    ],
    stages: [main, curveball],
  },
}
