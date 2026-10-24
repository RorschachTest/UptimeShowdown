import { chapter1 } from '../chapter1'
import type { ChapterEntry } from '../types'

export const v1ch01: ChapterEntry = {
  id: 'v1-01',
  volume: 1,
  number: 1,
  title: 'Scale from zero to millions',
  topic: 'SDI Vol 1 · Scale from zero to millions of users',
  play: { kind: 'ladder', chapter: chapter1 },
  lesson: {
    summary: 'Grow a system one bottleneck at a time, and never build the end state on day one.',
    cards: [
      {
        title: 'Start with one box',
        body: 'Web server, code and database on one machine is the right first design: cheap, simple, and enough for a handful of users.',
        solves: 'Ship today with almost no cost or operations.',
        worsens: 'One crash takes everything down, and it cannot grow past one machine.',
        diagram: { nodes: [['u', 'traffic'], ['box', 'allinone']], wires: ['u>box'] },
      },
      {
        title: 'Split web from data',
        body: 'When the box saturates, move the database onto its own machine so the web tier and the data tier can grow separately.',
        solves: 'Each tier can be sized for its own load.',
        worsens: 'A network hop between them, and the database is its own single point of failure.',
        diagram: { nodes: [['u', 'traffic'], ['web', 'app'], ['db', 'sqldb']], wires: ['u>web', 'web>db'] },
      },
      {
        title: 'Scale up, then out',
        body: 'A bigger machine needs no code changes but gets expensive fast and still crashes as one. Many smaller servers behind a load balancer keep going when one dies. Users reach a single address, so extra servers only help behind a load balancer.',
        visual: { kind: 'versus', caption: 'Two ways to add capacity.', sides: [{ title: 'Scale up (bigger box)', hue: 'blue', good: ['No code changes', 'Quick'], bad: ['Price climbs faster than capacity', 'Still one machine that can crash', 'There is a biggest box'] }, { title: 'Scale out (more boxes)', hue: 'green', good: ['Nearly unlimited', 'Survives one crashing'], bad: ['Needs a load balancer', 'Servers must not keep state'] }] },
        solves: 'Capacity that grows with servers, and survival of a crash.',
        worsens: 'Servers must be stateless, and there is another piece to run.',
        diagram: { nodes: [['u', 'traffic'], ['lb', 'lb'], ['web', 'app'], ['db', 'sqldb']], wires: ['u>lb', 'lb>web', 'web>db'] },
      },
      {
        title: 'Take reads off the database',
        body: 'Most traffic is reads. Read replicas copy the data to more machines; a cache keeps hot answers in memory. Both trade freshness for speed: a replica or a cache can be behind the latest write.',
        visual: { kind: 'bars', caption: 'Reads the primary database still serves, out of 2,000 a second.', unit: 'reads/s', rows: [{ label: 'Primary only', value: 2000, hue: 'red' }, { label: '+ 2 read replicas', value: 667, hue: 'orange', note: 'reads spread over three copies' }, { label: '+ cache (85% hits)', value: 300, hue: 'green', note: 'only misses reach the database' }] },
        solves: 'The database stops being the bottleneck for reads.',
        worsens: 'Stale reads, unless own-writes go to the primary or the cache is updated on write.',
        diagram: { nodes: [['u', 'traffic'], ['lb', 'lb'], ['web', 'app'], ['c', 'cache'], ['db', 'sqldb']], wires: ['u>lb', 'lb>web', 'web>c', 'c>db'] },
      },
      {
        title: 'Serve static files from the edge',
        body: 'Images and scripts are the same for everyone. A CDN keeps copies near users, so they load fast across the world and never reach your servers.',
        visual: { kind: 'bars', caption: 'Time to fetch an image for a user on another continent.', unit: 'ms', rows: [{ label: 'From your server', value: 180, hue: 'orange' }, { label: 'From a CDN edge', value: 20, hue: 'teal', note: 'a copy in a city near the user' }] },
        solves: 'Latency for distant users and bandwidth at the origin.',
        worsens: 'Only static files benefit; short cache times send more misses home.',
        diagram: { nodes: [['u', 'traffic'], ['cdn', 'cdn'], ['lb', 'lb'], ['web', 'app'], ['db', 'sqldb']], wires: ['u>cdn', 'cdn>lb', 'lb>web', 'web>db'] },
      },
      {
        title: 'Diagnose before you add',
        body: 'Name the resource that is full first: compute (web servers), storage (the database or cache) or network (bytes and distance). Adding web servers to a storage-bound system only adds load on the database.',
        visual: { kind: 'steps', caption: 'A loop you will repeat in every chapter.', steps: [{ title: 'Watch', text: 'which piece turns amber or red?', hue: 'yellow' }, { title: 'Name it', text: 'compute, storage or network?', hue: 'purple' }, { title: 'Fix that', text: 'the smallest change for that bottleneck', hue: 'blue' }, { title: 'Run again', text: 'the bottleneck moves: repeat', hue: 'green' }] },
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v1-01-q1',
        prompt: 'Web servers sit at 40% load, the database at 130%. What do you add?',
        options: [
          { id: 'web', label: 'More web servers', correct: false },
          { id: 'reads', label: 'A cache or read replicas', correct: true },
          { id: 'cdn', label: 'A CDN', correct: false },
        ],
        explain: 'The database is the full resource, and reads usually dominate. More web servers would just send it more work.',
      },
      {
        kind: 'pick',
        id: 'v1-01-q2',
        prompt: 'You run 3 web servers but no load balancer. What happens?',
        options: [
          { id: 'one', label: 'Users reach only one of them', correct: true },
          { id: 'all', label: 'Traffic spreads across all three', correct: false },
          { id: 'none', label: 'Nothing works at all', correct: false },
        ],
        explain: 'Users reach one address. Something has to spread the requests: that is the load balancer.',
      },
      {
        kind: 'order',
        id: 'v1-01-q3',
        prompt: 'For a typical read-heavy site, order these moves from first to last.',
        items: [
          { id: 'one', label: 'One server', value: 1 },
          { id: 'split', label: 'Split web and database', value: 2 },
          { id: 'lb', label: 'Load balancer + more servers', value: 3 },
          { id: 'cache', label: 'Cache or replicas', value: 4 },
          { id: 'shard', label: 'Shard the database', value: 5 },
        ],
        explain: 'Each step removes the current ceiling. Sharding is the most complex move and comes last, only when one primary cannot hold the writes.',
      },
    ],
  },
}
