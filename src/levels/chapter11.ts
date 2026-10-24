import type { InterviewLevel, Stage } from '../engine/types'

const goals = { uptime: 0.99, p95Ms: 150, maxStaleRate: 0.001, maxLagMs: 10_000, maxViolations: { lostMessages: 0 } }

const main: Stage = {
  id: 'feed-main',
  title: 'Evening scrolling',
  story: '20,000 feed opens and 1,000 new posts a second. Each post goes to about 200 followers. A feed server crashes at 0:30.',
  durationS: 60,
  traffic: [{ t: 0, rps: 15000 }, { t: 10, rps: 21000 }],
  mix: { page: 20 / 21, write: 1 / 21 },
  unlocks: { kinds: ['lb', 'queue', 'feed'], settings: [] },
  events: [{ t: 30, kind: 'crash', target: 'feed', durationS: 10 }],
  budget: 110,
  referenceCost: 75,
  goals,
}

const curveball: Stage = {
  id: 'feed-celebrities',
  title: 'The celebrities arrive',
  story: 'Pop stars with 20 million followers each join and post about once a second between them. Reads grow to 30,000 a second.',
  durationS: 60,
  traffic: [{ t: 0, rps: 20000 }, { t: 10, rps: 31001 }],
  mix: { page: 30000 / 31001, write: 1000 / 31001, celeb: 1 / 31001 },
  unlocks: { kinds: [], settings: [] },
  events: [{ t: 30, kind: 'crash', target: 'feed', durationS: 10 }],
  budget: 140,
  referenceCost: 95,
  goals,
}

/** Chapter 11, inspired by SDI Vol 1 "Design a news feed system". Scenario and numbers are ours. */
export const chapter11: InterviewLevel = {
  id: 'news-feed',
  title: 'Design a news feed system',
  prompt: 'Design the home feed of a social app: people post, and everyone who follows them sees the post in their feed.',
  questionBudget: 5,
  editBudget: 2,
  curveball: {
    title: 'The celebrities arrive',
    story: 'Accounts with 20 million followers start posting, and reads grow by half. You may change at most 2 pieces.',
  },
  questions: [
    { id: 'scale', text: 'How many feed opens and posts per second?', leverage: 'high', reveals: ['scale', 'mix'], short: '20,000 opens + 1,000 posts/s', answer: 'About 20,000 feed opens and 1,000 new posts a second in the evening.' },
    { id: 'followers', text: 'How many followers does a typical account have?', leverage: 'high', reveals: ['data'], short: '~200; we follow ~100', answer: 'About 200 followers, and people follow about 100 accounts.' },
    { id: 'fresh', text: 'How soon must a post appear in followers’ feeds?', leverage: 'high', reveals: ['freshness'], short: 'within 10 s', answer: 'Within about 10 seconds.' },
    { id: 'latency', text: 'How fast must the feed open?', leverage: 'high', reveals: ['latency'], short: 'p95 ≤ 150 ms', answer: 'Under 150 ms at p95, or people close the app.' },
    { id: 'celebs', text: 'Are there accounts with huge followings?', leverage: 'high', reveals: ['growth'], short: 'soon: 20M-follower celebrities', answer: 'Not yet, but we are signing pop stars with 20 million followers each.' },
    { id: 'failures', text: 'What happens when a feed server dies?', leverage: 'high', reveals: ['failures'], short: 'happens; feeds must stay up', answer: 'It happens. Feeds must keep loading.' },
    { id: 'ranking', text: 'Is the feed ranked or newest first?', leverage: 'low', reveals: [], answer: 'Newest first for now.' },
    { id: 'media', text: 'Can posts have photos?', leverage: 'low', reveals: [], answer: 'Yes, served from a CDN. Not your problem today.' },
    { id: 'graphdb', text: 'Should we use a graph database?', leverage: 'trap', reveals: [], answer: 'For the follow graph, maybe. What does that change about building feeds?' },
    { id: 'ml', text: 'Should we use machine learning to rank?', leverage: 'trap', reveals: [], answer: 'Another team’s job. Get posts into feeds first.' },
  ],
  features: [
    { id: 'post', text: 'Publish a post', core: true },
    { id: 'feed', text: 'Open my feed', core: true },
    { id: 'fresh', text: 'Posts reach followers quickly', core: true },
    { id: 'rank', text: 'Ranked feed', core: false },
    { id: 'likes', text: 'Likes and comments', core: false },
    { id: 'ads', text: 'Ads in the feed', core: false },
    { id: 'stories', text: 'Stories', core: false },
  ],
  wrapUp: [
    {
      id: 'hybrid',
      prompt: 'Why does a hybrid feed treat celebrities differently?',
      options: [
        { id: 'pull', text: 'Pushing one celebrity post means millions of writes; pulling it when a feed opens costs one read per follower who looks', correct: true },
        { id: 'privacy', text: 'Celebrity posts are private', correct: false },
        { id: 'rank', text: 'Celebrity posts are ranked higher', correct: false },
        { id: 'cdn', text: 'Celebrity posts are served from a CDN', correct: false },
      ],
      explain: 'Fanout on write makes reads cheap but costs a write per follower. For most users that’s ~200 writes; for a celebrity it’s tens of millions per post. Pull those few accounts at read time instead.',
    },
  ],
  chapter: {
    id: 'news-feed',
    title: 'Design a news feed system',
    seed: 11,
    violationLabels: { lostMessages: 'posts never reached their followers’ feeds' },
    rules: {
      requires: [{ kind: 'feed', why: 'Feeds are built and served by a news feed service.' }],
      mustPassThrough: [{ types: ['write', 'celeb'], kind: 'queue', why: 'Posting must not wait for fanout: put a queue in front of it.' }],
    },
    requestTypes: [
      { id: 'page', label: 'Open feed', needs: ['feed'], weight: 1, consistency: 'any', distanceMs: 0 },
      { id: 'write', label: 'New post', needs: ['enqueue', 'fanout'], weight: 1, consistency: 'any', distanceMs: 0, asyncAfter: 'enqueue', fanout: 200 },
      { id: 'celeb', label: 'Celebrity post', needs: ['enqueue', 'fanout'], weight: 1, consistency: 'any', distanceMs: 0, asyncAfter: 'enqueue', fanout: 20_000_000 },
    ],
    stages: [main, curveball],
  },
}
