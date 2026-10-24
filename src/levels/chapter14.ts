import type { InterviewLevel, Stage } from '../engine/types'

const goals = { uptime: 0.99, p95Ms: 300, maxStaleRate: 0.001, maxLagMs: 15_000, maxViolations: { lostMessages: 0, lostObjects: 0 } }

const main: Stage = {
  id: 'video-main',
  title: 'Prime time',
  story: 'Viewers stream 20,000 video chunks a second (2 MB each); creators upload 500 chunks a second (4 MB each). Each store holds about 300 TB. A disk node dies at 0:30.',
  durationS: 60,
  traffic: [{ t: 0, rps: 15000 }, { t: 10, rps: 20500 }],
  mix: { page: 20000 / 20500, write: 500 / 20500 },
  workingSetGb: 300_000,
  unlocks: { kinds: ['cdn', 'blob', 'lb', 'app', 'queue', 'worker'], settings: ['tier'] },
  events: [{ t: 30, kind: 'crash', target: 'blob', durationS: 15 }],
  budget: 520,
  referenceCost: 380,
  goals,
}

const curveball: Stage = {
  id: 'video-festival',
  title: 'Festival uploads',
  story: 'Every creator is uploading from a music festival: 1,000 chunks a second, twice the usual. A disk node still dies at 0:30.',
  durationS: 60,
  traffic: [{ t: 0, rps: 18000 }, { t: 10, rps: 21000 }],
  mix: { page: 20000 / 21000, write: 1000 / 21000 },
  workingSetGb: 300_000,
  unlocks: { kinds: [], settings: [] },
  events: [{ t: 30, kind: 'crash', target: 'blob', durationS: 15 }],
  budget: 620,
  referenceCost: 460,
  goals,
}

/** Chapter 14, inspired by SDI Vol 1 "Design YouTube". Scenario and numbers are ours. */
export const chapter14: InterviewLevel = {
  id: 'video',
  title: 'Design a video platform',
  prompt: 'Design a video site: creators upload videos, we convert them for every device, and millions of people watch.',
  questionBudget: 5,
  editBudget: 2,
  curveball: {
    title: 'Festival uploads',
    story: 'Twice the uploads, all needing transcoding. You may change at most 2 pieces.',
  },
  questions: [
    { id: 'scale', text: 'How much is watched and uploaded?', leverage: 'high', reveals: ['scale', 'mix'], short: '20,000 chunks/s watched; 500/s uploaded', answer: 'Viewers fetch about 20,000 two-megabyte chunks a second; creators upload 500 four-megabyte chunks a second.' },
    { id: 'storage', text: 'How much video do we store?', leverage: 'high', reveals: ['data'], short: '~300 TB per store', answer: 'About 300 TB of originals and another 300 TB of converted videos.' },
    { id: 'devices', text: 'Which devices must play the videos?', leverage: 'high', reveals: ['clients'], short: 'all: transcode every upload', answer: 'Phones, TVs, browsers: every upload must be converted into several formats and bitrates.' },
    { id: 'loss', text: 'Can we ever lose a video?', leverage: 'high', reveals: ['failures'], short: 'never; disks fail daily', answer: 'Never. And with this many disks, one fails every day.' },
    { id: 'ready', text: 'How soon must an upload be watchable?', leverage: 'high', reveals: ['freshness'], short: 'within 15 s per chunk', answer: 'Each chunk should be converted within about 15 seconds.' },
    { id: 'growth', text: 'Any spikes in uploads?', leverage: 'high', reveals: ['growth'], short: 'events: 2× uploads', answer: 'Big events (festivals, sports) double uploads.' },
    { id: 'comments', text: 'Do we need comments and likes?', leverage: 'low', reveals: [], answer: 'Not in this design.' },
    { id: 'live', text: 'Do we need live streaming?', leverage: 'low', reveals: [], answer: 'No, uploaded videos only.' },
    { id: 'ffmpeg', text: 'Should we use FFmpeg?', leverage: 'trap', reveals: [], answer: 'Fine for the transcoder. How does the system around it scale?' },
    { id: 'p2p', text: 'Could viewers share videos peer to peer?', leverage: 'trap', reveals: [], answer: 'Interesting, but no. Design the service.' },
  ],
  features: [
    { id: 'upload', text: 'Upload videos', core: true },
    { id: 'transcode', text: 'Convert for every device', core: true },
    { id: 'watch', text: 'Stream smoothly worldwide', core: true },
    { id: 'durable', text: 'Never lose a video', core: true },
    { id: 'live', text: 'Live streaming', core: false },
    { id: 'recs', text: 'Recommendations', core: false },
    { id: 'comments', text: 'Comments and likes', core: false },
  ],
  wrapUp: [
    {
      id: 'cdn',
      prompt: 'Why stream from a CDN instead of straight from our storage?',
      options: [
        { id: 'edge', text: 'Copies near viewers carry almost all the bytes, so our storage only serves the misses', correct: true },
        { id: 'cheap', text: 'CDNs store videos for free', correct: false },
        { id: 'transcode', text: 'The CDN transcodes videos', correct: false },
        { id: 'durable', text: 'The CDN keeps the only copy', correct: false },
      ],
      explain: 'Streaming is bandwidth. At 40 GB/s, serving from our own storage would need dozens of nodes just for network. The CDN absorbs ~95%; storage sees the misses. Rarely watched videos can skip the CDN to save cost.',
    },
  ],
  brief: {
    points: [
      'Viewers stream videos in small chunks; creators upload in chunks too.',
      'Uploads land in original storage, are queued, transcoded by workers into many formats, and saved to transcoded storage.',
      'Everything big lives in object storage; the question is where the bytes travel and how many copies you keep.',
    ],
    diagram: {
      nodes: [['u', 'traffic'], ['cdn', 'cdn'], ['tr', 'blob'], ['lb', 'lb'], ['api', 'app'], ['orig', 'blob'], ['q', 'queue'], ['w', 'worker']],
      wires: ['u>cdn', 'cdn>tr', 'u>lb', 'lb>api', 'api>orig', 'orig>q', 'q>w', 'w>tr'],
    },
  },
  chapter: {
    id: 'video',
    title: 'Design a video platform',
    seed: 14,
    violationLabels: { lostMessages: 'uploaded chunks were never transcoded', lostObjects: 'disk failures lost videos for good (one copy)' },
    rules: {
      requires: [{ kind: 'cdn', why: 'Streaming 40 GB/s from our own storage is not an option: put a CDN in front.' }],
    },
    names: [
      { kind: 'traffic', name: 'Viewers & creators' },
      { kind: 'blob', name: 'Original storage', when: ['write'] },
      { kind: 'blob', name: 'Transcoded storage' },
      { kind: 'app', name: 'Upload API' },
      { kind: 'queue', name: 'Transcode queue' },
      { kind: 'worker', name: 'Transcoders' },
    ],
    data: { blob: ['videoId/chunk → bytes'], queue: ['videoId, chunk, formats'] },
    requestTypes: [
      { id: 'page', label: 'Watch chunk', api: 'GET /videos/{id}/chunk', does: { static: 'stream the chunk' }, needs: ['static'], weight: 1, consistency: 'any', distanceMs: 0, sizeMb: 2 },
      { id: 'write', label: 'Upload chunk', api: 'PUT /uploads/{id}', does: { compute: 'authorise the upload', blob: 'store the bytes', enqueue: 'queue a transcode job', work: 'transcode to every format' }, needs: ['compute', 'blob', 'enqueue', 'work', 'blob'], weight: 1, consistency: 'any', distanceMs: 0, sizeMb: 4, bytes: 'in', asyncAfter: 'blob', workCost: 20 },
    ],
    stages: [main, curveball],
  },
}
