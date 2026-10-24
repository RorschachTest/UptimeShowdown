import type { ChapterEntry } from '../types'
import { v2chapter1 } from '../v2chapter1'

export const v2ch01: ChapterEntry = {
  id: 'v2-01',
  volume: 2,
  number: 1,
  title: 'Design a proximity service',
  topic: 'SDI Vol 2 · Proximity service',
  play: { kind: 'interview', level: v2chapter1 },
  lesson: {
    summary: 'Index places by location so “near me” reads a few cells instead of the whole map.',
    cards: [
      {
        title: 'Two services',
        body: 'A location-based service answers nearby searches from an in-memory index; it’s read-only and easy to copy. A business service handles owners’ edits to the database. A load balancer routes each to its own.',
        solves: 'Search scales separately from the rare writes.',
        worsens: 'The index must be refreshed from the database (nightly is fine for places).',
        diagram: {
          nodes: [['u', 'traffic'], ['lb', 'lb'], ['geo', 'geoindex'], ['c', 'cache'], ['web', 'app'], ['db', 'sqldb']],
          wires: ['u>lb', 'lb>geo', 'geo>c', 'c>db', 'lb>web', 'web>db'],
        },
      },
      {
        title: 'Why not a 2D range query',
        body: 'Filtering latitude between a and b and longitude between c and d makes the database intersect two huge sets on every search. It works for a demo and falls over at scale.',
        solves: 'No index to build.',
        worsens: 'Slow and expensive per search.',
      },
      {
        title: 'Grids and geohash',
        body: 'Divide the map into cells and search the user’s cell. An even grid overloads city cells. Geohash encodes cells as strings: each extra character makes a smaller cell, and nearby places share a prefix.',
        solves: 'A search becomes a lookup of a few cell keys.',
        worsens: 'Places just across a cell edge have a different prefix: also search the 8 neighbouring cells.',
      },
      {
        title: 'Quadtree',
        body: 'Split the map into four, and keep splitting any square with too many places. Dense cities get small squares, empty areas stay big, so every leaf holds about the same number of places.',
        solves: 'Even load whatever the density.',
        worsens: 'Built in memory: a restarted server needs minutes to rebuild before it can serve.',
      },
      {
        title: 'Scale the reads',
        body: 'Searches vastly outnumber edits. Copy the index to every server behind the load balancer, cache place details, and add read replicas if the database is still busy.',
        solves: 'Read capacity grows by adding copies.',
        worsens: 'Copies are refreshed in batches, so edits show up later.',
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v2-01-q1',
        prompt: 'Why search the 8 neighbouring geohash cells too?',
        options: [
          { id: 'edge', label: 'Places just across a cell edge have a different geohash', correct: true },
          { id: 'speed', label: 'It makes the search faster', correct: false },
          { id: 'dense', label: 'To spread load across servers', correct: false },
        ],
        explain: 'Two places a few metres apart can sit in different cells with no shared prefix.',
      },
      {
        kind: 'pick',
        id: 'v2-01-q2',
        prompt: 'Places are packed into cities and absent from oceans. Which index keeps the work per cell even?',
        options: [
          { id: 'qt', label: 'Quadtree', correct: true },
          { id: 'grid', label: 'Even grid', correct: false },
          { id: 'scan', label: '2D range scan', correct: false },
        ],
        explain: 'A quadtree keeps splitting busy squares until each holds about the same number of places.',
      },
      {
        kind: 'pick',
        id: 'v2-01-q3',
        prompt: 'What does adding one character to a geohash do?',
        options: [
          { id: 'smaller', label: 'Makes the cell smaller', correct: true },
          { id: 'bigger', label: 'Makes the cell bigger', correct: false },
          { id: 'move', label: 'Moves the cell east', correct: false },
        ],
        explain: 'Each character subdivides the cell, so longer geohashes mean finer cells.',
      },
    ],
  },
}
