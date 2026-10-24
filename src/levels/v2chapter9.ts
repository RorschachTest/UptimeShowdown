import type { InterviewLevel, Stage } from '../engine/types'

const goals = { uptime: 0.99, p95Ms: 300, maxStaleRate: 0.001, maxViolations: { lostObjects: 0 } }

const main: Stage = {
  id: 's3-main',
  title: 'Steady state',
  story: '1,000 uploads and 5,000 downloads a second, objects about 1 MB. We hold 500 TB. A data node’s disks fail at 0:30.',
  durationS: 60,
  traffic: [{ t: 0, rps: 5000 }, { t: 10, rps: 6000 }],
  mix: { write: 1 / 6, page: 5 / 6 },
  workingSetGb: 500_000,
  unlocks: { kinds: ['lb', 'app', 'kvstore', 'blob'], settings: ['tier'] },
  events: [{ t: 30, kind: 'crash', target: 'blob', durationS: 20 }],
  budget: 420,
  referenceCost: 315,
  goals,
}

const curveball: Stage = {
  id: 's3-growth',
  title: 'A year later',
  story: 'Customers kept uploading: we now hold 1 PB, with the same traffic. A data node still fails at 0:30.',
  durationS: 60,
  traffic: [{ t: 0, rps: 5000 }, { t: 10, rps: 6000 }],
  mix: { write: 1 / 6, page: 5 / 6 },
  workingSetGb: 1_000_000,
  unlocks: { kinds: [], settings: [] },
  events: [{ t: 30, kind: 'crash', target: 'blob', durationS: 20 }],
  budget: 590,
  referenceCost: 455,
  goals,
}

/** Volume 2 Chapter 9, inspired by SDI Vol 2 "S3-like object storage". Scenario and numbers are ours. */
export const v2chapter9: InterviewLevel = {
  id: 'object-storage',
  title: 'Design object storage',
  prompt: 'Design an object store like S3: put and get objects by bucket and key, with eleven nines of durability.',
  questionBudget: 5,
  editBudget: 1,
  curveball: {
    title: 'A year later',
    story: 'Twice the data, same traffic. You may change 1 piece.',
  },
  questions: [
    { id: 'scale', text: 'How many puts and gets per second?', leverage: 'high', reveals: ['scale', 'mix'], short: '1,000 puts + 5,000 gets/s, ~1 MB', answer: 'About 1,000 uploads and 5,000 downloads a second; objects average 1 MB.' },
    { id: 'data', text: 'How much data do we store?', leverage: 'high', reveals: ['data'], short: '500 TB, doubling yearly', answer: '500 TB today, roughly doubling every year.' },
    { id: 'durability', text: 'How durable must objects be?', leverage: 'high', reveals: ['failures'], short: '11 nines; disks fail daily', answer: 'Eleven nines. With thousands of disks, some fail every day.' },
    { id: 'immutable', text: 'Can objects be edited in place?', leverage: 'high', reveals: ['ordering'], short: 'no: write once, read many', answer: 'No. Objects are immutable: you replace them with a new version.' },
    { id: 'latency', text: 'How fast must a get start?', leverage: 'high', reveals: ['latency'], short: 'p95 ≤ 300 ms', answer: 'The first byte within 300 ms at p95.' },
    { id: 'cost', text: 'What matters most for cost?', leverage: 'high', reveals: ['growth'], short: 'disk: it doubles yearly', answer: 'Disk. Whatever we pay per terabyte, we pay twice as much next year.' },
    { id: 'acl', text: 'Do we need access control?', leverage: 'low', reveals: [], answer: 'Yes, but assume the API checks it.' },
    { id: 'versioning', text: 'Do we keep old versions?', leverage: 'low', reveals: [], answer: 'Optional per bucket; ignore it today.' },
    { id: 'posix', text: 'Should it support POSIX file operations?', leverage: 'trap', reveals: [], answer: 'No. It’s object storage, not a file system.' },
    { id: 'raid', text: 'Can we just use RAID?', leverage: 'trap', reveals: [], answer: 'RAID protects one server. What about losing the server?' },
  ],
  features: [
    { id: 'put', text: 'Upload objects', core: true },
    { id: 'get', text: 'Download objects', core: true },
    { id: 'durable', text: 'Eleven nines of durability', core: true },
    { id: 'multipart', text: 'Multipart upload for huge objects', core: false },
    { id: 'versioning', text: 'Object versioning', core: false },
    { id: 'lifecycle', text: 'Lifecycle rules', core: false },
    { id: 'list', text: 'Listing by prefix', core: false },
  ],
  wrapUp: [
    {
      id: 'ec',
      prompt: 'With 8 data + 4 parity pieces, how many failures can an object survive, and what does it cost?',
      options: [
        { id: '4', text: 'Any 4 lost pieces, for 1.5× the disk', correct: true },
        { id: '2', text: '2 lost pieces, for 3× the disk', correct: false },
        { id: '8', text: '8 lost pieces, for 1.2× the disk', correct: false },
        { id: '0', text: 'None: parity is only for checksums', correct: false },
      ],
      explain: 'Any 8 of the 12 pieces rebuild the object, so up to 4 can be lost. 12 pieces for 8 pieces of data is 1.5× the storage, against 3× for three full copies.',
    },
  ],
  brief: {
    points: [
      'Clients put and get objects by bucket and key over HTTP.',
      'An API service authenticates, looks up or records where the object lives in a metadata store, then streams the bytes to or from data nodes.',
      'Disks and whole data nodes fail regularly, and data keeps growing.',
    ],
    diagram: {
      nodes: [['u', 'traffic'], ['lb', 'lb'], ['api', 'app'], ['meta', 'kvstore'], ['data', 'blob']],
      wires: ['u>lb', 'lb>api', 'api>meta', 'meta>data'],
    },
  },
  chapter: {
    id: 'object-storage',
    title: 'Design object storage',
    seed: 109,
    violationLabels: { lostObjects: 'disk failures lost objects for good (one copy)' },
    rules: {
      requires: [{ kind: 'blob', why: 'Object bytes live on data nodes.' }],
      mustPassThrough: [{ types: ['write', 'page'], kind: 'kvstore', why: 'Every object is found through the metadata store.' }],
    },
    names: [
      { kind: 'traffic', name: 'Clients' },
      { kind: 'lb', name: 'Load balancer' },
      { kind: 'app', name: 'API service' },
      { kind: 'kvstore', name: 'Metadata store' },
      { kind: 'blob', name: 'Data nodes' },
    ],
    data: { kvstore: ['bucket/key → object id, placement'], blob: ['object id → pieces'] },
    requestTypes: [
      { id: 'write', label: 'Put object', api: 'PUT /{bucket}/{key}', does: { compute: 'authenticate', write: 'record the object’s placement', blob: 'write the pieces' }, needs: ['compute', 'write', 'blob'], weight: 0.25, consistency: 'any', distanceMs: 0, sizeMb: 1, bytes: 'in' },
      { id: 'page', label: 'Get object', api: 'GET /{bucket}/{key}', does: { compute: 'authenticate', lookup: 'find the placement', blob: 'stream the pieces' }, needs: ['compute', 'lookup', 'blob'], weight: 0.25, consistency: 'any', distanceMs: 0, sizeMb: 1 },
    ],
    stages: [main, curveball],
  },
}
