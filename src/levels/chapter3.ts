import type { InterviewLevel, Stage } from '../engine/types'

const mix = { static: 0.55, page: 0.34, ryw: 0.08, write: 0.03 }
const goals = { uptime: 0.99, p95Ms: 200, maxStaleRate: 0.001 }

const main: Stage = {
  id: 'photos-main',
  title: 'Your design under load',
  story: 'Traffic ramps up to its daily peak.',
  durationS: 60,
  traffic: [{ t: 0, rps: 2000 }, { t: 20, rps: 4000 }],
  mix,
  unlocks: { kinds: ['app', 'lb', 'sqldb', 'cache', 'cdn'], settings: ['tier', 'replicas', 'readRouting'] },
  events: [{ t: 30, durationS: 12, kind: 'crash', target: 'app' }],
  budget: 220,
  referenceCost: 160,
  goals,
}

const curveball: Stage = {
  id: 'photos-celebrity',
  title: 'A celebrity shares a photo',
  story: 'Traffic climbs to 10,000 rps, uploads included.',
  durationS: 60,
  traffic: [{ t: 0, rps: 4000 }, { t: 20, rps: 10000 }],
  mix,
  unlocks: { kinds: [], settings: [] },
  events: [],
  budget: 300,
  referenceCost: 258,
  goals,
}

/** Chapter 3 practice problem: the interview framework on a photo-sharing app. Story and numbers are ours. */
export const chapter3: InterviewLevel = {
  id: 'photo-sharing',
  title: 'Design a photo-sharing app',
  prompt: 'Design a photo-sharing app. People post photos and scroll a feed of photos from people they follow.',
  questionBudget: 5,
  editBudget: 3,
  curveball: {
    title: 'A celebrity shares a photo',
    story: 'A celebrity joins and their photo goes everywhere. Traffic climbs to 10,000 rps, uploads included. You may change at most 3 pieces.',
  },
  questions: [
    { id: 'scale', text: 'How many people use it, and how busy does it get?', leverage: 'high', reveals: ['scale'], short: '2,000 → 4,000 rps', answer: 'About 2,000 requests per second, peaking at 4,000 every day.' },
    {
      id: 'mix',
      text: 'What do people mostly do: look or post?',
      leverage: 'high',
      reveals: ['mix'],
      short: 'mostly reads: 55% photo files',
      answer: 'Mostly look. 55% of requests are photo files, 34% feed views, 8% people checking their own new photo, 3% uploads.',
    },
    { id: 'where', text: 'Where are the users?', leverage: 'high', reveals: ['geography'], short: 'worldwide', answer: 'Everywhere. Half of them are on another continent from your servers.' },
    {
      id: 'fresh',
      text: 'Must people see their own new photo straight away?',
      leverage: 'high',
      reveals: ['freshness'],
      short: 'see own post at once',
      answer: 'Yes. An old feed right after posting looks like the upload was lost.',
    },
    {
      id: 'failure',
      text: 'What should happen when a server dies?',
      leverage: 'high',
      reveals: ['failures'],
      short: 'a server will crash; 99% uptime',
      answer: 'It will die: expect a web server to crash mid-run. The app must stay up (99%).',
    },
    { id: 'speed', text: 'How fast must the feed load?', leverage: 'high', reveals: ['latency'], short: 'p95 ≤ 200 ms', answer: '95% of requests within 200 ms.' },
    { id: 'language', text: 'Which programming language should we use?', leverage: 'low', reveals: [], answer: "Your call. It doesn't change the architecture." },
    { id: 'likes', text: 'Do we need likes and comments?', leverage: 'low', reveals: [], answer: 'Nice to have. Leave them out for now.' },
    { id: 'colour', text: 'What colour is the upload button?', leverage: 'trap', reveals: [], answer: "Blue. That won't help you design the system." },
    { id: 'kafka', text: 'Should we use Kafka?', leverage: 'trap', reveals: [], answer: "That's an answer, not a question. What need would it serve?" },
  ],
  features: [
    { id: 'upload', text: 'Upload a photo', core: true },
    { id: 'feed', text: 'Scroll a feed of photos', core: true },
    { id: 'own', text: 'See your own photo right after posting', core: true },
    { id: 'likes', text: 'Likes', core: false },
    { id: 'comments', text: 'Comments', core: false },
    { id: 'dms', text: 'Direct messages', core: false },
    { id: 'filters', text: 'Photo filters', core: false },
    { id: 'search', text: 'Search', core: false },
  ],
  wrapUp: [
    {
      id: 'uploads',
      prompt: 'Uploads keep growing. What has to change?',
      options: [
        { id: 'shard', text: 'Split the database across machines (shard it), since every upload is a write', correct: true },
        { id: 'cache', text: 'A bigger cache', correct: false },
        { id: 'cdn', text: 'A second CDN', correct: false },
        { id: 'web', text: 'More web servers', correct: false },
      ],
      explain: 'Caches and CDNs absorb reads, not writes, and web servers are not the limit. Writes all land on one primary until the data is sharded.',
    },
  ],
  chapter: {
    id: 'photo-sharing',
    title: 'Design a photo-sharing app',
    seed: 3,
    names: [{ kind: 'app', name: 'Photo API' }, { kind: 'sqldb', name: 'Photos DB' }, { kind: 'cache', name: 'Feed cache' }],
    data: { sqldb: ['photos: id, owner, caption', 'follows: who → whom'], cache: ['user → recent photos'], cdn: ['photo files'] },
    requestTypes: [
      { id: 'page', label: 'Feed view', api: 'GET /feed', does: { compute: 'build the feed', lookup: 'read followed photos' }, needs: ['compute', 'lookup'], weight: 1, consistency: 'any', distanceMs: 0 },
      { id: 'write', label: 'Upload', api: 'POST /photos', does: { compute: 'check the upload', write: 'save the photo' }, needs: ['compute', 'write'], weight: 1, consistency: 'any', distanceMs: 0 },
      { id: 'ryw', label: 'Own photo', api: 'GET /me/photos', does: { compute: 'list your photos', lookup: 'read your photos' }, needs: ['compute', 'lookup'], weight: 1, consistency: 'ryw', distanceMs: 0 },
      { id: 'static', label: 'Photo files', api: 'GET /img/*', does: { static: 'serve photo files' }, needs: ['static'], weight: 2, consistency: 'any', distanceMs: 250 },
    ],
    stages: [main, curveball],
  },
}
