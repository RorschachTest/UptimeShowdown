import type { InterviewLevel, Stage } from '../engine/types'

const goals = { uptime: 0.99, p95Ms: 200, maxStaleRate: 0.001, maxViolations: { duplicateId: 0, unordered: 0, tooLong: 0 } }
const mix = { page: 0.95, write: 0.05 }

const main: Stage = {
  id: 'links-main',
  title: 'Short links at peak',
  story: '3,800 redirects and 200 new short links a second. A web server crashes at 0:20 and an ID server at 0:40.',
  durationS: 60,
  traffic: [{ t: 0, rps: 3000 }, { t: 10, rps: 4000 }],
  mix,
  unlocks: { kinds: ['lb', 'app', 'cache', 'sqldb', 'idgen'], settings: ['tier', 'replicas', 'readRouting'] },
  events: [
    { t: 20, kind: 'crash', target: 'app', durationS: 20 },
    { t: 40, kind: 'crash', target: 'idgen', durationS: 15 },
  ],
  budget: 270,
  referenceCost: 205,
  goals,
}

const curveball: Stage = {
  id: 'links-viral',
  title: 'A link goes viral',
  story: 'A celebrity posts one of your links: 12,000 redirects a second, and the same two crashes.',
  durationS: 60,
  traffic: [{ t: 0, rps: 6000 }, { t: 10, rps: 12200 }],
  mix: { page: 12000 / 12200, write: 200 / 12200 },
  unlocks: { kinds: [], settings: [] },
  events: [
    { t: 20, kind: 'crash', target: 'app', durationS: 20 },
    { t: 40, kind: 'crash', target: 'idgen', durationS: 15 },
  ],
  budget: 560,
  referenceCost: 471,
  goals,
}

/** Chapter 8, inspired by SDI Vol 1 "Design a URL shortener". Scenario and numbers are ours. */
export const chapter8: InterviewLevel = {
  id: 'url-shortener',
  title: 'Design a URL shortener',
  prompt: 'Design a service that turns long URLs into short links like sho.rt/aZ3kQ9x and redirects anyone who opens one.',
  questionBudget: 5,
  editBudget: 2,
  curveball: {
    title: 'A link goes viral',
    story: 'One link gets 12,000 opens a second, three times your whole peak. You may change at most 2 pieces.',
  },
  questions: [
    { id: 'scale', text: 'How many links are created and opened per second?', leverage: 'high', reveals: ['scale', 'mix'], short: '4,000/s, 1 new per 19 opens', answer: 'About 200 new links and 3,800 redirects a second at peak.' },
    { id: 'length', text: 'How short must the code be?', leverage: 'high', reveals: ['data'], short: '7 chars, 64-bit IDs', answer: 'Seven characters at most. Our IDs are 64-bit numbers; base62 of one fits in seven characters for decades.' },
    { id: 'unique', text: 'Can two long URLs ever share a code?', leverage: 'high', reveals: ['ordering'], short: 'never; codes unique', answer: 'Never. Each new link gets its own unique ID, then we encode it in base62.' },
    { id: 'failures', text: 'What happens when a server dies?', leverage: 'high', reveals: ['failures'], short: 'servers crash; links must keep working', answer: 'Web servers crash every few days. Links printed on posters must always work.' },
    { id: 'latency', text: 'How fast must a redirect be?', leverage: 'high', reveals: ['latency'], short: 'p95 ≤ 200 ms', answer: 'Under 200 ms at p95, or people think the link is broken.' },
    { id: 'growth', text: 'What happens when a link goes viral?', leverage: 'high', reveals: ['growth'], short: 'one link can triple traffic', answer: 'It happens: one link can bring three times our normal peak within minutes.' },
    { id: 'custom', text: 'Can users pick their own code?', leverage: 'low', reveals: [], answer: 'Not in this version.' },
    { id: 'expire', text: 'Do links expire?', leverage: 'low', reveals: [], answer: 'No, they live forever.' },
    { id: 'md5', text: 'Should we use MD5 or SHA-1?', leverage: 'trap', reveals: [], answer: 'For what, exactly? Tell me how you turn a URL into a code first.' },
    { id: 'nosql', text: 'SQL or NoSQL?', leverage: 'trap', reveals: [], answer: 'Either can store a code-to-URL table. What matters is the read load.' },
  ],
  features: [
    { id: 'shorten', text: 'Shorten a long URL', core: true },
    { id: 'redirect', text: 'Redirect from a short link', core: true },
    { id: 'reliable', text: 'Links always work', core: true },
    { id: 'custom', text: 'Custom short codes', core: false },
    { id: 'analytics', text: 'Click analytics dashboard', core: false },
    { id: 'expiry', text: 'Expiring links', core: false },
    { id: 'qr', text: 'QR codes', core: false },
  ],
  wrapUp: [
    {
      id: 'redirect',
      prompt: 'Marketing now wants to count every click. Which redirect should the service return?',
      options: [
        { id: '302', text: '302 Found: the browser asks us every time', correct: true },
        { id: '301', text: '301 Moved Permanently: the browser caches it', correct: false },
        { id: '200', text: '200 with the long URL in the page', correct: false },
        { id: '404', text: '404 and a link', correct: false },
      ],
      explain: 'A 301 lets browsers remember the target and skip us next time: less load, but we never see those clicks. A 302 sends every click through us, so we can count them.',
    },
  ],
  chapter: {
    id: 'url-shortener',
    title: 'Design a URL shortener',
    seed: 8,
    violationLabels: { duplicateId: 'short codes handed out twice', unordered: 'IDs out of time order', tooLong: 'codes longer than 7 characters' },
    rules: {
      requires: [{ kind: 'idgen', why: 'Short codes come from unique IDs: add an ID generator.' }],
      mustPassThrough: [
        { types: ['page'], kind: 'cache', why: 'Redirects are read 19 times for every write: they must check a cache before the database.' },
      ],
    },
    requestTypes: [
      { id: 'page', label: 'Redirect', needs: ['compute', 'lookup'], weight: 1, consistency: 'any', distanceMs: 0 },
      { id: 'write', label: 'New short link', needs: ['compute', 'id', 'write'], weight: 1, consistency: 'any', distanceMs: 0 },
    ],
    stages: [main, curveball],
  },
}
