import { defineComponent, tierSetting } from './shared'

export const allinone = defineComponent({
  kind: 'allinone',
  label: 'Single Server',
  blurb: 'Web server, code and database on one machine.',
  solves: 'The cheapest, simplest way to start.',
  worsens: "One crash takes everything down, and it can't grow past one box.",
  capacityRps: 300,
  baseLatencyMs: 30,
  costPerMin: 20,
  queueTicks: 2,
  serves: ['compute', 'lookup', 'write', 'static'],
  tiered: true,
  choices: [tierSetting],
  actions: [
    {
      gate: 'split',
      label: 'Split into web server + database',
      solves: 'Web and data scale on their own, on separate machines.',
      worsens: 'A network hop between them, and the database is now its own single point of failure.',
      into: [
        { kind: 'app', dx: 0, dy: 0 },
        { kind: 'sqldb', dx: 40, dy: 170 },
      ],
    },
  ],
})
