import type { InterviewLevel, Stage } from '../engine/types'

const goals = { uptime: 0.99, p95Ms: 50, maxStaleRate: 0.001, maxViolations: { lostScores: 0 } }

const main: Stage = {
  id: 'board-main',
  title: 'Season leaderboard',
  story: '25 million players: 5,000 score updates and 2,000 leaderboard views a second. A store node dies at 0:30.',
  durationS: 60,
  traffic: [{ t: 0, rps: 5000 }, { t: 10, rps: 7000 }],
  mix: { write: 5 / 7, page: 2 / 7 },
  workingSetGb: 5,
  unlocks: { kinds: ['leaderboard'], settings: [] },
  events: [{ t: 30, kind: 'crash', target: 'leaderboard', durationS: 10 }],
  budget: 90,
  referenceCost: 60,
  goals,
}

const curveball: Stage = {
  id: 'board-global',
  title: 'Global launch',
  story: '500 million players: 50,000 updates and 40,000 views a second, and 150 GB of scores. A node still dies at 0:30.',
  durationS: 60,
  traffic: [{ t: 0, rps: 45000 }, { t: 10, rps: 90000 }],
  mix: { write: 5 / 9, page: 4 / 9 },
  workingSetGb: 150,
  unlocks: { kinds: [], settings: [] },
  events: [{ t: 30, kind: 'crash', target: 'leaderboard', durationS: 10 }],
  budget: 400,
  referenceCost: 300,
  goals,
}

/** Volume 2 Chapter 10, inspired by SDI Vol 2 "Real-time gaming leaderboard". Scenario and numbers are ours. */
export const v2chapter10: InterviewLevel = {
  id: 'leaderboard',
  title: 'Design a real-time leaderboard',
  prompt: 'Our mobile game shows the top 10 players and each player’s own rank, updated the moment they win a match. Design the leaderboard.',
  questionBudget: 5,
  editBudget: 1,
  curveball: {
    title: 'Global launch',
    story: 'Twenty times the players: 90,000 requests a second and 150 GB of scores. You may change 1 piece.',
  },
  questions: [
    { id: 'scale', text: 'How many players, updates and views?', leverage: 'high', reveals: ['scale', 'mix'], short: '25M players; 5,000 updates + 2,000 views/s', answer: '25 million monthly players. At peak, 5,000 score updates and 2,000 leaderboard views a second.' },
    { id: 'rank', text: 'What does a player see?', leverage: 'high', reveals: ['data'], short: 'top 10 + own rank', answer: 'The top 10, plus their own rank and the players just above and below.' },
    { id: 'realtime', text: 'How quickly must a win show up?', leverage: 'high', reveals: ['freshness'], short: 'immediately', answer: 'Immediately. Players check their rank right after a match.' },
    { id: 'failures', text: 'What if a server holding scores dies?', leverage: 'high', reveals: ['failures'], short: 'never lose a score', answer: 'Servers do die. Losing a season’s scores would be a disaster.' },
    { id: 'latency', text: 'How fast must the leaderboard load?', leverage: 'high', reveals: ['latency'], short: 'p95 ≤ 50 ms', answer: 'Under 50 ms at p95.' },
    { id: 'growth', text: 'Are we growing?', leverage: 'high', reveals: ['growth'], short: 'global launch: 20× players', answer: 'The global launch is next month: about twenty times the players.' },
    { id: 'ties', text: 'How do we break ties?', leverage: 'low', reveals: [], answer: 'Whoever got there first ranks higher.' },
    { id: 'friends', text: 'Do we need friends-only boards?', leverage: 'low', reveals: [], answer: 'Not this season.' },
    { id: 'redis', text: 'Can we use Redis?', leverage: 'trap', reveals: [], answer: 'For what? Which structure, and how big does it get?' },
    { id: 'cheat', text: 'How do we stop cheaters?', leverage: 'trap', reveals: [], answer: 'The game servers validate matches. Scores you receive are trusted.' },
  ],
  features: [
    { id: 'update', text: 'Update a player’s score after a win', core: true },
    { id: 'top', text: 'Show the top 10', core: true },
    { id: 'rank', text: 'Show a player’s own rank', core: true },
    { id: 'durable', text: 'Never lose scores', core: true },
    { id: 'history', text: 'Past seasons', core: false },
    { id: 'friends', text: 'Friends-only leaderboard', core: false },
    { id: 'regions', text: 'Per-country boards', core: false },
  ],
  brief: {
    points: [
      'A mobile game with seasons. Players win matches and their score goes up.',
      'Everyone can see the top 10 and their own rank, and checks it right after every match.',
      'Game servers send score updates; the app asks for the leaderboard.',
    ],
    diagram: { nodes: [['u', 'traffic'], ['b', 'leaderboard']], wires: ['u>b'] },
  },
  wrapUp: [
    {
      id: 'zset',
      prompt: 'Why is a sorted set a good fit for the leaderboard?',
      options: [
        { id: 'log', text: 'Adding a score and finding a rank both take O(log n)', correct: true },
        { id: 'disk', text: 'It stores scores on disk, so they are never lost', correct: false },
        { id: 'sql', text: 'It supports SQL joins', correct: false },
        { id: 'free', text: 'It needs no memory', correct: false },
      ],
      explain: 'A sorted set keeps members ordered by score (a skip list plus a hash), so ZINCRBY, ZREVRANK and ZREVRANGE are logarithmic. It lives in memory, so you size it for every player and replicate it.',
    },
  ],
  chapter: {
    id: 'leaderboard',
    title: 'Design a real-time leaderboard',
    seed: 110,
    violationLabels: { lostScores: 'shard crash(es) wiped scores: no replica' },
    rules: {
      requires: [{ kind: 'leaderboard', why: 'This chapter is about the leaderboard store itself.' }],
    },
    names: [{ kind: 'traffic', name: 'Game servers' }, { kind: 'leaderboard', name: 'Leaderboard' }],
    data: { leaderboard: ['season: player → score, sorted'] },
    requestTypes: [
      { id: 'write', label: 'Score update', api: 'POST /scores', does: { write: 'add to the player’s score' }, needs: ['write'], weight: 1, consistency: 'any', distanceMs: 0 },
      { id: 'page', label: 'Leaderboard view', api: 'GET /leaderboard', does: { lookup: 'top 10 + my rank' }, needs: ['lookup'], weight: 1, consistency: 'any', distanceMs: 0 },
    ],
    stages: [main, curveball],
  },
}
