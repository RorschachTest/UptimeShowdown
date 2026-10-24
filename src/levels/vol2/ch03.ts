import type { ChapterEntry } from '../types'
import { v2chapter3 } from '../v2chapter3'

export const v2ch03: ChapterEntry = {
  id: 'v2-03',
  volume: 2,
  number: 3,
  title: 'Design a maps app',
  topic: 'SDI Vol 2 · Google Maps',
  play: { kind: 'interview', level: v2chapter3 },
  lesson: {
    summary: 'Pre-render the map as tiles at the edge, compute routes on a graph split into tiles, and stream drivers’ locations into live traffic.',
    cards: [
      {
        title: 'Three different loads',
        body: 'Map tiles are static images: huge volume, served from a CDN. Routes are heavy computation on the road graph. Location updates are a write stream that feeds traffic and history. Each gets its own path.',
        diagram: {
          nodes: [['u', 'traffic'], ['cdn', 'cdn'], ['tiles', 'blob'], ['lb', 'lb'], ['route', 'app'], ['c', 'cache'], ['g', 'kvstore'], ['q', 'queue'], ['w', 'worker'], ['h', 'tsdb']],
          wires: ['u>cdn', 'cdn>tiles', 'u>lb', 'lb>route', 'route>c', 'c>g', 'u>q', 'q>w', 'w>h'],
        },
      },
      {
        title: 'Map tiles',
        body: 'Each zoom level is a grid of square images; zoom in one level and each tile splits into four. Render them once, store them by (zoom, x, y) in object storage, and let a CDN serve them near users.',
        visual: {
          kind: 'bars',
          caption: 'Tiles needed to cover the world, by zoom level.',
          unit: 'tiles',
          rows: [
            { label: 'Zoom 0', value: 1, hue: 'blue', note: 'the whole world' },
            { label: 'Zoom 10', value: 1048576, hue: 'teal' },
            { label: 'Zoom 21', value: 4398046511104, hue: 'purple', note: 'street level: 4.4 trillion' },
          ],
        },
      },
      {
        title: 'Routing tiles',
        body: 'The road graph is too big for one machine’s memory, so it is cut into routing tiles. A route loads only the tiles along the way, with coarser tiles for highways between cities, and caches hot tiles in memory.',
        solves: 'Fast routes on a planet-sized graph.',
        worsens: 'Tile boundaries and levels to maintain.',
      },
      {
        title: 'Location streams',
        body: 'Phones batch their GPS points and send every 15 seconds. Updates flow through a stream (like Kafka) to services that update live traffic, improve ETAs and keep history, each consuming at its own pace.',
        visual: {
          kind: 'bars',
          caption: 'Requests from a million navigating phones.',
          unit: '/s',
          rows: [
            { label: 'Send every second', value: 1000000, hue: 'red' },
            { label: 'Batch every 15 s', value: 66667, hue: 'green' },
          ],
        },
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v2-03-q1',
        prompt: 'How should map images reach users around the world?',
        options: [
          { id: 'cdn', label: 'Pre-rendered tiles served by a CDN', correct: true },
          { id: 'render', label: 'Rendered on our servers for each request', correct: false },
          { id: 'db', label: 'Read straight from the database', correct: false },
        ],
        explain: 'Tiles are static, so the edge can serve them.',
      },
      {
        kind: 'pick',
        id: 'v2-03-q2',
        prompt: 'Zooming in one level multiplies the number of tiles by…',
        options: [
          { id: '4', label: '4', correct: true },
          { id: '2', label: '2', correct: false },
          { id: '10', label: '10', correct: false },
        ],
        explain: 'Each tile splits into a 2 × 2 grid.',
      },
      {
        kind: 'pick',
        id: 'v2-03-q3',
        prompt: 'Why do phones batch location updates?',
        options: [
          { id: 'battery', label: 'Fewer requests save battery and server load', correct: true },
          { id: 'privacy', label: 'For privacy', correct: false },
          { id: 'accuracy', label: 'For accuracy', correct: false },
        ],
        explain: 'Sending every 15 seconds is 15× fewer requests than every second.',
      },
    ],
  },
}
