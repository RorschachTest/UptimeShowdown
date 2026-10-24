import type { InterviewLevel, Stage } from '../engine/types'

const goals = { uptime: 0.99, p95Ms: 150, maxStaleRate: 0.001, maxViolations: { missedNearby: 0 } }

const main: Stage = {
  id: 'nearby-main',
  title: 'Lunchtime searches',
  story: '5,000 “restaurants near me” searches a second, plus a trickle of owners editing their pages. An index server crashes at 0:20.',
  durationS: 60,
  traffic: [{ t: 0, rps: 3500 }, { t: 10, rps: 5050 }],
  mix: { page: 5000 / 5050, write: 50 / 5050 },
  unlocks: { kinds: ['lb', 'app', 'geoindex', 'cache', 'sqldb'], settings: ['tier', 'replicas', 'readRouting'] },
  events: [{ t: 20, kind: 'crash', target: 'geoindex', durationS: 10 }],
  budget: 220,
  referenceCost: 165,
  goals,
}

const curveball: Stage = {
  id: 'nearby-newyear',
  title: 'New Year’s Eve',
  story: 'Everyone is looking for somewhere to go: 10,000 searches a second, and an index server still crashes at 0:20.',
  durationS: 60,
  traffic: [{ t: 0, rps: 6000 }, { t: 10, rps: 10050 }],
  mix: { page: 10000 / 10050, write: 50 / 10050 },
  unlocks: { kinds: [], settings: [] },
  events: [{ t: 20, kind: 'crash', target: 'geoindex', durationS: 10 }],
  budget: 320,
  referenceCost: 245,
  goals,
}

/** Volume 2 Chapter 1, inspired by SDI Vol 2 "Proximity service". Scenario and numbers are ours. */
export const v2chapter1: InterviewLevel = {
  id: 'proximity',
  title: 'Design a proximity service',
  prompt: 'Design the backend for “find restaurants near me”: given a location and a radius, return the places nearby.',
  questionBudget: 5,
  editBudget: 2,
  curveball: {
    title: 'New Year’s Eve',
    story: 'Twice the searches, all evening. You may change at most 2 pieces.',
  },
  questions: [
    { id: 'scale', text: 'How many searches per second?', leverage: 'high', reveals: ['scale', 'mix'], short: '5,000 searches/s; edits rare', answer: 'About 5,000 searches a second at lunchtime. Owners edit their pages only about 50 times a second.' },
    { id: 'density', text: 'Are places spread evenly?', leverage: 'high', reveals: ['geography'], short: 'no: dense cities, empty oceans', answer: 'Not at all. A few city blocks hold thousands of places; deserts and oceans hold none.' },
    { id: 'radius', text: 'Must every place inside the radius be found?', leverage: 'high', reveals: ['data'], short: 'yes: none missed at the edges', answer: 'Yes. Missing the café across the street because it’s in the next cell is a bug.' },
    { id: 'freshness', text: 'How fast must an owner’s edit show up?', leverage: 'high', reveals: ['freshness'], short: 'next day is fine', answer: 'Next day is fine. Places rarely move.' },
    { id: 'failures', text: 'What happens when a server dies?', leverage: 'high', reveals: ['failures'], short: 'crashes happen; search must stay up', answer: 'They crash now and then. Search must stay up anyway.' },
    { id: 'growth', text: 'Are there peak days?', leverage: 'high', reveals: ['growth'], short: 'holidays: 2× searches', answer: 'Holidays double the searches for a whole evening.' },
    { id: 'latency', text: 'How fast must a search be?', leverage: 'low', reveals: [], answer: 'A couple of hundred milliseconds is fine.' },
    { id: 'reviews', text: 'Do we show reviews?', leverage: 'low', reveals: [], answer: 'Another team owns reviews. Just return the places.' },
    { id: 'postgis', text: 'Should we use PostGIS?', leverage: 'trap', reveals: [], answer: 'Maybe. First tell me how you would index locations.' },
    { id: 'gps', text: 'How accurate is phone GPS?', leverage: 'trap', reveals: [], answer: 'Accurate enough. That isn’t the hard part.' },
  ],
  features: [
    { id: 'search', text: 'Search places near a location', core: true },
    { id: 'complete', text: 'Find every place in the radius', core: true },
    { id: 'details', text: 'Show a place’s details', core: true },
    { id: 'edit', text: 'Owners edit their place', core: true },
    { id: 'route', text: 'Driving directions', core: false },
    { id: 'live', text: 'Live wait times', core: false },
    { id: 'reviews', text: 'Reviews and ratings', core: false },
  ],
  brief: {
    points: [
      'A local-search app: open it and see restaurants, shops and cafés near you.',
      'Places almost never move; owners occasionally edit their page.',
      'Two kinds of request reach us through a load balancer: nearby searches, and owners’ edits.',
    ],
    diagram: { nodes: [['u', 'traffic'], ['lb', 'lb'], ['geo', 'geoindex'], ['c', 'cache'], ['web', 'app'], ['db', 'sqldb']], wires: ['u>lb', 'lb>geo', 'geo>c', 'c>db', 'lb>web', 'web>db'] },
  },
  wrapUp: [
    {
      id: 'precision',
      prompt: 'Geohash cells are too big for a 500 m search in a dense city. What should the service do?',
      options: [
        { id: 'longer', text: 'Use a longer geohash (smaller cells) for small radii, plus the neighbouring cells', correct: true },
        { id: 'scan', text: 'Fall back to scanning every place', correct: false },
        { id: 'shorter', text: 'Use a shorter geohash so fewer cells are read', correct: false },
        { id: 'cache', text: 'Cache every possible search', correct: false },
      ],
      explain: 'Each extra geohash character shrinks the cell. Pick the precision from the radius, then read the user’s cell and its 8 neighbours so nothing near an edge is missed.',
    },
  ],
  chapter: {
    id: 'proximity',
    title: 'Design a proximity service',
    seed: 101,
    violationLabels: { missedNearby: 'searches missed places just across a cell edge' },
    rules: {
      requires: [{ kind: 'geoindex', why: 'Nearby search needs a geospatial index.' }],
      mustPassThrough: [{ types: ['page'], kind: 'cache', why: 'Place details are read on every search: serve them from a cache.' }],
    },
    names: [{ kind: 'lb', name: 'API gateway' }, { kind: 'geoindex', name: 'Location service' }, { kind: 'app', name: 'Business service' }, { kind: 'cache', name: 'Place cache' }, { kind: 'sqldb', name: 'Places DB' }],
    data: { geoindex: ['geohash → place ids'], cache: ['place id → details'], sqldb: ['places: id, name, lat, lng'] },
    requestTypes: [
      { id: 'page', label: 'Nearby search', api: 'GET /search?lat,lng,r', does: { geo: 'find nearby place ids', lookup: 'load place details' }, needs: ['geo', 'lookup'], weight: 1, consistency: 'any', distanceMs: 0 },
      { id: 'write', label: 'Owner edit', api: 'PUT /places/{id}', does: { compute: 'check the edit', write: 'save the place' }, needs: ['compute', 'write'], weight: 1, consistency: 'any', distanceMs: 0 },
    ],
    stages: [main, curveball],
  },
}
