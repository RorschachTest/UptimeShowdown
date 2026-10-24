import type { InterviewLevel, Stage } from '../engine/types'

const goals = { uptime: 0.99, p95Ms: 400, maxStaleRate: 0.001, maxViolations: { lostObjects: 0 } }

const main: Stage = {
  id: 'drive-main',
  title: 'A working day',
  story: '2,000 file saves, 200 downloads and 1,500 folder syncs a second. Files average 10 MB; we store about 200 TB. A storage node dies at 0:30.',
  durationS: 60,
  traffic: [{ t: 0, rps: 3000 }, { t: 10, rps: 3700 }],
  mix: { write: 2000 / 3700, page: 200 / 3700, ryw: 1500 / 3700 },
  workingSetGb: 200_000,
  unlocks: { kinds: ['lb', 'blocksrv', 'blob', 'app', 'sqldb', 'cache'], settings: ['tier', 'replicas', 'readRouting'] },
  events: [{ t: 30, kind: 'crash', target: 'blob', durationS: 15 }],
  budget: 410,
  referenceCost: 308,
  goals,
}

const curveball: Stage = {
  id: 'drive-term',
  title: 'First week of term',
  story: 'Students everywhere are saving homework: 6,000 saves a second, three times the usual. A storage node still dies at 0:30.',
  durationS: 60,
  traffic: [{ t: 0, rps: 5000 }, { t: 10, rps: 7700 }],
  mix: { write: 6000 / 7700, page: 200 / 7700, ryw: 1500 / 7700 },
  workingSetGb: 200_000,
  unlocks: { kinds: [], settings: [] },
  events: [{ t: 30, kind: 'crash', target: 'blob', durationS: 15 }],
  budget: 680,
  referenceCost: 503,
  goals,
}

/** Chapter 15, inspired by SDI Vol 1 "Design Google Drive". Scenario and numbers are ours. */
export const chapter15: InterviewLevel = {
  id: 'drive',
  title: 'Design a file sync service',
  prompt: 'Design a cloud drive: people save files from any device, the files sync to their other devices, and nothing is ever lost.',
  questionBudget: 5,
  editBudget: 2,
  curveball: {
    title: 'First week of term',
    story: 'Three times the saves. You may change at most 2 pieces.',
  },
  questions: [
    { id: 'scale', text: 'How many saves, downloads and syncs per second?', leverage: 'high', reveals: ['scale', 'mix'], short: '2,000 saves, 200 downloads, 1,500 syncs/s', answer: 'About 2,000 saves, 200 downloads and 1,500 folder syncs a second.' },
    { id: 'size', text: 'How big are files, and what changes on a save?', leverage: 'high', reveals: ['data'], short: '10 MB files; small edits', answer: 'Around 10 MB on average, and most saves change only a small part of the file.' },
    { id: 'consistency', text: 'Must another device see a save at once?', leverage: 'high', reveals: ['freshness'], short: 'yes: never an old version', answer: 'Yes. Opening the folder on your laptop must never show an older version than the one you just saved on your phone.' },
    { id: 'loss', text: 'Can we lose a file?', leverage: 'high', reveals: ['failures'], short: 'never; disks fail', answer: 'Never. Storage nodes fail; files must survive.' },
    { id: 'storage', text: 'How much do we store?', leverage: 'high', reveals: ['ordering'], short: '~200 TB', answer: 'About 200 TB, growing.' },
    { id: 'growth', text: 'Any busy seasons?', leverage: 'high', reveals: ['growth'], short: 'term start: 3× saves', answer: 'The first week of term triples the saves.' },
    { id: 'share', text: 'Can people share folders?', leverage: 'low', reveals: [], answer: 'Yes, but sharing is out of scope today.' },
    { id: 'preview', text: 'Do we show previews?', leverage: 'low', reveals: [], answer: 'Later.' },
    { id: 'dropbox', text: 'Can we just resell Dropbox?', leverage: 'trap', reveals: [], answer: 'We are building it.' },
    { id: 'nfs', text: 'Should we mount NFS?', leverage: 'trap', reveals: [], answer: 'This is a cloud service, not a file share.' },
  ],
  features: [
    { id: 'save', text: 'Save files from any device', core: true },
    { id: 'sync', text: 'Sync folders to my other devices', core: true },
    { id: 'download', text: 'Download files', core: true },
    { id: 'safe', text: 'Never lose a file', core: true },
    { id: 'share', text: 'Shared folders', core: false },
    { id: 'versions', text: 'Version history', core: false },
    { id: 'preview', text: 'File previews', core: false },
  ],
  wrapUp: [
    {
      id: 'delta',
      prompt: 'Why split files into blocks and upload only the changed ones?',
      options: [
        { id: 'bytes', text: 'A small edit moves one block instead of the whole file: far less bandwidth and storage I/O', correct: true },
        { id: 'secure', text: 'It encrypts the file', correct: false },
        { id: 'meta', text: 'It replaces the metadata database', correct: false },
        { id: 'cdn', text: 'It lets the CDN cache the file', correct: false },
      ],
      explain: 'Hash each block; when a file changes, only blocks with new hashes are uploaded. Identical blocks across files are stored once (de-duplication).',
    },
  ],
  brief: {
    points: [
      'Desktop and phone apps save and download files, and regularly sync folder listings.',
      'File contents go through block servers into object storage; file and folder records live in a metadata database.',
      'Another device must never see an older version than the one you just saved.',
    ],
    diagram: {
      nodes: [['u', 'traffic'], ['lb', 'lb'], ['bs', 'blocksrv'], ['blob', 'blob'], ['api', 'app'], ['db', 'sqldb']],
      wires: ['u>lb', 'lb>bs', 'bs>blob', 'lb>api', 'api>db'],
    },
  },
  chapter: {
    id: 'drive',
    title: 'Design a file sync service',
    seed: 15,
    violationLabels: { lostObjects: 'storage failures lost files for good (one copy)' },
    rules: {
      requires: [{ kind: 'blocksrv', why: 'Files move through block servers, not straight into storage.' }],
    },
    names: [
      { kind: 'traffic', name: 'Desktop & phone apps' },
      { kind: 'blocksrv', name: 'Block servers' },
      { kind: 'blob', name: 'Block storage' },
      { kind: 'app', name: 'Metadata API' },
      { kind: 'sqldb', name: 'Metadata DB' },
      { kind: 'cache', name: 'Metadata cache' },
    ],
    data: { blob: ['block hash → bytes'], sqldb: ['files: id, path, version, block list'], cache: ['folder → listing'] },
    requestTypes: [
      { id: 'write', label: 'Save file', api: 'PUT /files/{id}', does: { chunk: 'hash blocks, send what changed', blob: 'store new blocks' }, needs: ['chunk', 'blob'], weight: 1, consistency: 'any', distanceMs: 0, sizeMb: 10, bytes: 'in' },
      { id: 'page', label: 'Download file', api: 'GET /files/{id}', does: { chunk: 'assemble the blocks', blob: 'read the blocks' }, needs: ['chunk', 'blob'], weight: 1, consistency: 'any', distanceMs: 0, sizeMb: 10 },
      { id: 'ryw', label: 'Sync folder', api: 'GET /changes?since=', does: { compute: 'list what changed', lookup: 'read file versions' }, needs: ['compute', 'lookup'], weight: 1, consistency: 'ryw', distanceMs: 0 },
    ],
    stages: [main, curveball],
  },
}
