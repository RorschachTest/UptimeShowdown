import type { InterviewLevel, Stage } from '../engine/types'

const goals = { uptime: 0.99, p95Ms: 300, maxStaleRate: 0.001, maxViolations: { doubleBooked: 0, duplicateBookings: 0 } }

const main: Stage = {
  id: 'hotel-main',
  title: 'Holiday season',
  story: '3,000 room searches and 300 reservations a second. About 2% of reservations race another one for the same last room; 3% are double-clicked.',
  durationS: 60,
  traffic: [{ t: 0, rps: 2500 }, { t: 10, rps: 3300 }],
  mix: { page: 30 / 33, write: 3 / 33 },
  unlocks: { kinds: ['lb', 'app', 'cache', 'sqldb'], settings: ['tier', 'booking', 'idempotency'] },
  events: [],
  budget: 260,
  referenceCost: 193,
  goals,
}

const curveball: Stage = {
  id: 'hotel-concert',
  title: 'The stadium concert',
  story: 'A huge concert comes to town: 900 reservations a second, and 30% of them race for the same few hotels.',
  durationS: 60,
  traffic: [{ t: 0, rps: 3000 }, { t: 10, rps: 3900 }],
  mix: { page: 30 / 39, write: 9 / 39 },
  unlocks: { kinds: [], settings: [] },
  events: [],
  budget: 790,
  referenceCost: 595,
  goals,
}

/** Volume 2 Chapter 7, inspired by SDI Vol 2 "Hotel reservation system". Scenario and numbers are ours. */
export const v2chapter7: InterviewLevel = {
  id: 'hotel',
  title: 'Design a hotel reservation system',
  prompt: 'Design the booking system for a hotel chain: people search for rooms and reserve them. Never sell the same room twice.',
  questionBudget: 5,
  editBudget: 2,
  curveball: {
    title: 'The stadium concert',
    story: 'Three times the bookings, and many race for the same hotels. You may change at most 2 pieces.',
  },
  questions: [
    { id: 'scale', text: 'How many searches and bookings per second?', leverage: 'high', reveals: ['scale', 'mix'], short: '3,000 searches + 300 bookings/s', answer: 'About 3,000 searches and 300 reservations a second in peak season.' },
    { id: 'race', text: 'Do people compete for the same room?', leverage: 'high', reveals: ['conflicts'], short: 'yes: ~2% race for the last room', answer: 'Yes. About 2% of reservations race another one for the same last room.' },
    { id: 'double', text: 'Do people double-click “Book”?', leverage: 'high', reveals: ['clients'], short: 'yes: ~3% sent twice', answer: 'All the time. About 3% of requests arrive twice (double clicks, retries after a timeout).' },
    { id: 'oversell', text: 'Can we ever sell more rooms than we have?', leverage: 'high', reveals: ['failures'], short: 'never, no duplicates either', answer: 'Never. And one click must make exactly one reservation.' },
    { id: 'latency', text: 'How fast must booking be?', leverage: 'high', reveals: ['latency'], short: 'p95 ≤ 300 ms', answer: 'Under 300 ms at p95.' },
    { id: 'growth', text: 'Any big events?', leverage: 'high', reveals: ['growth'], short: 'concerts: 3× bookings, heavy racing', answer: 'Big concerts triple bookings, and most race for the same few hotels.' },
    { id: 'pay', text: 'Do we take payment here?', leverage: 'low', reveals: [], answer: 'Payment is a separate service.' },
    { id: 'price', text: 'Do prices change by day?', leverage: 'low', reveals: [], answer: 'Yes, but pricing is someone else’s job.' },
    { id: 'nosql', text: 'Should we use NoSQL?', leverage: 'trap', reveals: [], answer: 'Bookings need transactions. Why would NoSQL help?' },
    { id: 'micro', text: 'Should every table be its own microservice?', leverage: 'trap', reveals: [], answer: 'Then a reservation spans services and you need distributed transactions. Keep it simple.' },
  ],
  features: [
    { id: 'search', text: 'Search available rooms', core: true },
    { id: 'reserve', text: 'Reserve a room', core: true },
    { id: 'nooversell', text: 'Never oversell', core: true },
    { id: 'once', text: 'One click, one reservation', core: true },
    { id: 'cancel', text: 'Cancellations', core: false },
    { id: 'overbook', text: 'Deliberate 10% overbooking', core: false },
    { id: 'loyalty', text: 'Loyalty points', core: false },
  ],
  wrapUp: [
    {
      id: 'idem',
      prompt: 'A guest double-clicks “Book”. What stops a second reservation?',
      options: [
        { id: 'key', text: 'An idempotency key: the second request with the same key returns the first result', correct: true },
        { id: 'lock', text: 'Locking the room row', correct: false },
        { id: 'cache', text: 'Caching the search results', correct: false },
        { id: 'ui', text: 'Disabling the button is enough', correct: false },
      ],
      explain: 'Locks stop two different guests taking the last room; they don’t recognise the same guest asking twice. The client generates a reservation ID up front and the server de-duplicates on it. Disabling the button helps but can’t stop network retries.',
    },
  ],
  brief: {
    points: [
      'Guests search for rooms and reserve them through the reservation service.',
      'Room inventory lives in a SQL database: each hotel, room type and date has a total and a reserved count.',
      'Search can use a cache; reservations must hit the database.',
    ],
    diagram: { nodes: [['u', 'traffic'], ['lb', 'lb'], ['api', 'app'], ['c', 'cache'], ['db', 'sqldb']], wires: ['u>lb', 'lb>api', 'api>c', 'c>db'] },
  },
  chapter: {
    id: 'hotel',
    title: 'Design a hotel reservation system',
    seed: 107,
    violationLabels: { doubleBooked: 'rooms were sold twice', duplicateBookings: 'double clicks made two reservations' },
    rules: {
      requires: [{ kind: 'sqldb', why: 'Reservations need a transactional database.' }],
    },
    names: [
      { kind: 'traffic', name: 'Guests' },
      { kind: 'app', name: 'Reservation service' },
      { kind: 'cache', name: 'Search cache' },
      { kind: 'sqldb', name: 'Inventory DB' },
    ],
    data: { sqldb: ['room_inventory: hotel, type, date, total, reserved', 'reservations: id (idempotency key), guest'], cache: ['hotel + dates → availability'] },
    requestTypes: [
      { id: 'page', label: 'Search rooms', api: 'GET /hotels/{id}/rooms', does: { compute: 'find available rooms', lookup: 'read inventory' }, needs: ['compute', 'lookup'], weight: 1, consistency: 'any', distanceMs: 0 },
      { id: 'write', label: 'Reserve', api: 'POST /reservations', does: { compute: 'check the idempotency key', write: 'reserve if rooms are left' }, needs: ['compute', 'write'], weight: 1, consistency: 'any', distanceMs: 0, conflicts: 0.02, resubmits: 0.03 },
    ],
    stages: [main, curveball],
  },
}
