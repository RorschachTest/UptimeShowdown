import type { InterviewLevel, Stage } from '../engine/types'

const goals = { uptime: 0.99, p95Ms: 100, maxStaleRate: 0.001 }

const main: Stage = {
  id: 'sessions-main',
  title: 'Player profiles at peak',
  story: 'Game servers read player profiles 20,000 times a second. Halfway through, a cache node dies for good.',
  durationS: 60,
  traffic: [{ t: 0, rps: 16000 }, { t: 10, rps: 20000 }],
  mix: { page: 0.99, write: 0.01 },
  workingSetGb: 120,
  unlocks: { kinds: ['cache', 'sqldb'], settings: ['tier', 'cacheNodes', 'hashing'] },
  events: [{ t: 30, kind: 'nodeLeave', target: 'cache' }],
  budget: 340,
  referenceCost: 290,
  goals,
}

const curveball: Stage = {
  id: 'sessions-season',
  title: 'Season launch',
  story: 'A new season: 30,000 reads a second and 180 GB of hot profiles. A node dies at 0:20 and ops adds one back at 0:40.',
  durationS: 60,
  traffic: [{ t: 0, rps: 24000 }, { t: 10, rps: 30000 }],
  mix: { page: 0.99, write: 0.01 },
  workingSetGb: 180,
  unlocks: { kinds: [], settings: [] },
  events: [
    { t: 20, kind: 'nodeLeave', target: 'cache' },
    { t: 40, kind: 'nodeJoin', target: 'cache' },
  ],
  budget: 400,
  referenceCost: 340,
  goals,
}

/** Chapter 5, inspired by SDI Vol 1 "Design consistent hashing". Scenario and numbers are ours. */
export const chapter5: InterviewLevel = {
  id: 'consistent-hashing',
  title: 'Design consistent hashing',
  prompt: 'Our game keeps player profiles in a cache in front of the database. Spread them across cache nodes so losing or adding a node doesn’t flatten the database.',
  questionBudget: 5,
  editBudget: 2,
  curveball: {
    title: 'Season launch',
    story: '50% more reads, 180 GB of hot profiles, a node lost and a node added during the peak. You may change at most 2 pieces.',
  },
  questions: [
    { id: 'scale', text: 'How many profile reads and saves per second?', leverage: 'high', reveals: ['scale', 'mix'], short: '20,000/s, 1% saves', answer: 'About 20,000 per second at peak; 1% of them are saves.' },
    { id: 'data', text: 'How much profile data is hot?', leverage: 'high', reveals: ['data'], short: '120 GB hot', answer: 'About 120 GB is read often. One cache node holds 16 to 64 GB, so it won’t fit on one.' },
    {
      id: 'failures',
      text: 'What happens when a cache node dies?',
      leverage: 'high',
      reveals: ['failures'],
      short: 'weekly; DB ~4,000 reads/s',
      answer: 'Every week. A large database box takes about 4,000 reads a second: enough for one node’s share of misses, not the whole load.',
    },
    { id: 'key', text: 'What is the cache key?', leverage: 'low', reveals: [], answer: 'The player ID. Any good hash of it spreads evenly.' },
    { id: 'growth', text: 'Will the cluster change size?', leverage: 'high', reveals: ['growth'], short: 'yes: nodes added for launches', answer: 'Yes. Ops adds nodes before every season launch, often during the peak.' },
    { id: 'latency', text: 'How fast must a profile read be?', leverage: 'high', reveals: ['latency'], short: 'p95 ≤ 100 ms', answer: 'Under 100 ms at p95, including the database on a miss.' },
    { id: 'format', text: 'What format are profiles stored in?', leverage: 'low', reveals: [], answer: 'JSON blobs. It doesn’t change how you spread them.' },
    { id: 'ttl', text: 'How long should profiles stay cached?', leverage: 'low', reveals: [], answer: 'An hour is fine; they change rarely.' },
    { id: 'memcached', text: 'Memcached or Redis?', leverage: 'trap', reveals: [], answer: 'Either works. The question is how the clients pick a node for each key.' },
    { id: 'bigger', text: 'Can we just buy one huge cache box?', leverage: 'trap', reveals: [], answer: 'There isn’t one big enough, and it would be one machine that takes everything down with it.' },
  ],
  features: [
    { id: 'spread', text: 'Spread profiles across cache nodes', core: true },
    { id: 'lose', text: 'Survive losing a node', core: true },
    { id: 'add', text: 'Add nodes without a cache stampede', core: true },
    { id: 'replicate', text: 'Keep two copies of every profile', core: false },
    { id: 'hotkeys', text: 'Detect celebrity profiles', core: false },
    { id: 'regions', text: 'Separate clusters per region', core: false },
    { id: 'evict', text: 'Custom eviction policies', core: false },
  ],
  brief: {
    points: [
      'PlayArena is an online game. Each time a player joins a match, a game server looks up their profile: level, items, friends.',
      'Profiles live in a SQL database. A cache sits in front and answers repeat lookups from memory in about a millisecond, so the database only sees the misses.',
      'The profiles no longer fit in one cache machine, so they must be spread across several cache nodes, and every game server must agree which node holds which player.',
      'Cache nodes come and go: they crash, and ops adds more before big events. Whenever a key ends up on a different node, the next read for it misses and goes to the database.',
    ],
    diagram: { nodes: [['u', 'traffic'], ['c', 'cache'], ['db', 'sqldb']], wires: ['u>c', 'c>db'] },
  },
  wrapUp: [
    {
      id: 'moved',
      prompt: 'A 10-node consistent-hashing ring gains an 11th node. Roughly what share of keys move?',
      options: [
        { id: 'tenth', text: 'About 1/11, taken from its neighbours', correct: true },
        { id: 'all', text: 'Almost all of them', correct: false },
        { id: 'half', text: 'About half', correct: false },
        { id: 'none', text: 'None until a restart', correct: false },
      ],
      explain: 'On a ring, the new node takes over only the arcs just before its points, about 1/N of the keys. With key mod N, changing N moves almost every key.',
    },
  ],
  chapter: {
    id: 'consistent-hashing',
    title: 'Design consistent hashing',
    seed: 5,
    rules: {
      requires: [{ kind: 'cache', why: 'Profiles must be served from a cache: the database alone can’t take 20,000 reads a second.' }],
      mustPassThrough: [{ types: ['page'], kind: 'cache', why: 'Every profile read must ask the cache first.' }],
    },
    names: [{ kind: 'traffic', name: 'Game servers' }, { kind: 'cache', name: 'Profile cache' }, { kind: 'sqldb', name: 'Profiles DB' }],
    data: { cache: ['playerId → profile'], sqldb: ['profiles: id, level, items, friends'] },
    requestTypes: [
      { id: 'page', label: 'Profile read', api: 'get(playerId)', does: { lookup: 'find the profile' }, needs: ['lookup'], weight: 1, consistency: 'any', distanceMs: 0 },
      { id: 'write', label: 'Profile save', api: 'set(playerId)', does: { write: 'save the profile' }, needs: ['write'], weight: 1, consistency: 'any', distanceMs: 0 },
    ],
    stages: [main, curveball],
  },
}
