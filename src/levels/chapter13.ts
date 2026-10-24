import type { InterviewLevel, Stage } from '../engine/types'

const goals = { uptime: 0.99, p95Ms: 100, maxStaleRate: 0.001, maxLagMs: 30_000, maxViolations: { lostMessages: 0 } }

const main: Stage = {
  id: 'typeahead-main',
  title: 'Everyone is searching',
  story: '20,000 keystrokes a second ask for suggestions, and 4,000 finished searches a second are logged. A trie server crashes at 0:30.',
  durationS: 60,
  traffic: [{ t: 0, rps: 16000 }, { t: 10, rps: 24000 }],
  mix: { page: 20 / 24, write: 4 / 24 },
  unlocks: { kinds: ['trie', 'queue', 'worker'], settings: ['sampling'] },
  events: [{ t: 30, kind: 'crash', target: 'trie', durationS: 10 }],
  budget: 130,
  referenceCost: 90,
  goals,
}

const curveball: Stage = {
  id: 'typeahead-launch',
  title: 'Launch in five new countries',
  story: 'Five times the traffic: 100,000 keystrokes and 20,000 logged searches a second. A trie server still crashes at 0:30.',
  durationS: 60,
  traffic: [{ t: 0, rps: 60000 }, { t: 10, rps: 120000 }],
  mix: { page: 100 / 120, write: 20 / 120 },
  unlocks: { kinds: [], settings: [] },
  events: [{ t: 30, kind: 'crash', target: 'trie', durationS: 10 }],
  budget: 260,
  referenceCost: 180,
  goals,
}

/** Chapter 13, inspired by SDI Vol 1 "Design a search autocomplete system". Scenario and numbers are ours. */
export const chapter13: InterviewLevel = {
  id: 'autocomplete',
  title: 'Design search autocomplete',
  prompt: 'As someone types in the search box, show the 5 most popular searches that start with what they typed.',
  questionBudget: 5,
  editBudget: 2,
  curveball: {
    title: 'Launch in five new countries',
    story: 'Five times the keystrokes and five times the logs. You may change at most 2 pieces.',
  },
  questions: [
    { id: 'scale', text: 'How many keystrokes per second?', leverage: 'high', reveals: ['scale', 'mix'], short: '20,000 keystrokes + 4,000 searches/s', answer: 'About 20,000 keystrokes a second ask for suggestions; 4,000 finished searches a second are logged.' },
    { id: 'latency', text: 'How fast must suggestions appear?', leverage: 'high', reveals: ['latency'], short: 'p95 ≤ 100 ms', answer: 'Under 100 ms, or they show up after the user has typed the next letter.' },
    { id: 'fresh', text: 'How fresh must the suggestions be?', leverage: 'high', reveals: ['freshness'], short: 'weekly is fine', answer: 'Popularity changes slowly. Updating the suggestions weekly is fine.' },
    { id: 'skew', text: 'Are prefixes spread evenly?', leverage: 'high', reveals: ['geography'], short: 'no: far more “s” than “x”', answer: 'No. Far more searches start with “s” or “c” than with “x” or “z”.' },
    { id: 'failures', text: 'What if a server dies?', leverage: 'high', reveals: ['failures'], short: 'crashes happen; stay up', answer: 'They crash now and then; the search box must keep working.' },
    { id: 'growth', text: 'Are we growing?', leverage: 'high', reveals: ['growth'], short: '5× soon', answer: 'We launch in five countries soon: five times the traffic.' },
    { id: 'lang', text: 'Do we need other languages?', leverage: 'low', reveals: [], answer: 'English only for now.' },
    { id: 'spell', text: 'Do we correct spelling?', leverage: 'low', reveals: [], answer: 'Not in this version.' },
    { id: 'es', text: 'Should we just use Elasticsearch?', leverage: 'trap', reveals: [], answer: 'Maybe for search itself. How would you make prefix lookups this fast?' },
    { id: 'ml', text: 'Should suggestions be personalised by ML?', leverage: 'trap', reveals: [], answer: 'Out of scope. Popularity is enough.' },
  ],
  features: [
    { id: 'suggest', text: 'Top 5 suggestions for a prefix', core: true },
    { id: 'fast', text: 'Fast enough to keep up with typing', core: true },
    { id: 'popular', text: 'Ranked by popularity', core: true },
    { id: 'spell', text: 'Spelling correction', core: false },
    { id: 'personal', text: 'Personalised suggestions', core: false },
    { id: 'trending', text: 'Real-time trending searches', core: false },
    { id: 'multi', text: 'Multiple languages', core: false },
  ],
  wrapUp: [
    {
      id: 'topk',
      prompt: 'Why store the top 5 completions at every node of the trie?',
      options: [
        { id: 'o1', text: 'A lookup becomes one read at the prefix’s node, instead of walking every word under it', correct: true },
        { id: 'mem', text: 'It makes the trie use less memory', correct: false },
        { id: 'fresh', text: 'It keeps suggestions up to date in real time', correct: false },
        { id: 'shard', text: 'It removes the need to shard', correct: false },
      ],
      explain: 'Caching the answer at each node trades memory for speed: “be” already knows its top 5, so nobody has to search the subtree. The lists are rebuilt with the trie each week.',
    },
  ],
  brief: {
    points: [
      'A search box: each keystroke sends the prefix typed so far and gets back up to 5 suggestions.',
      'Every finished search is logged, and the logs decide which searches are popular.',
      'You have a trie of popular searches to answer prefixes, and a queue with workers to process the logs.',
    ],
    diagram: { nodes: [['u', 'traffic'], ['t', 'trie'], ['q', 'queue'], ['w', 'worker']], wires: ['u>t', 'u>q', 'q>w'] },
  },
  chapter: {
    id: 'autocomplete',
    title: 'Design search autocomplete',
    seed: 13,
    violationLabels: { lostMessages: 'search logs were dropped' },
    rules: {
      requires: [{ kind: 'trie', why: 'Suggestions come from a trie of popular searches.' }],
    },
    names: [{ kind: 'traffic', name: 'Search box' }, { kind: 'trie', name: 'Suggestion trie' }, { kind: 'queue', name: 'Log queue' }, { kind: 'worker', name: 'Aggregators' }],
    data: { trie: ['prefix → top 5 searches'], queue: ['query, time'] },
    requestTypes: [
      { id: 'page', label: 'Keystroke', api: 'GET /suggest?q=', does: { suggest: 'top 5 for the prefix' }, needs: ['suggest'], weight: 1, consistency: 'any', distanceMs: 0 },
      { id: 'write', label: 'Search log', api: 'log(query)', does: { enqueue: 'queue the log line', work: 'count queries for the rebuild' }, needs: ['enqueue', 'work'], weight: 1, consistency: 'any', distanceMs: 0, asyncAfter: 'enqueue' },
    ],
    stages: [main, curveball],
  },
}
