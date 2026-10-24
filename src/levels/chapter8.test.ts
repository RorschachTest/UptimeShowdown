import { describe, expect, it } from 'vitest'
import { changedPieces } from '../engine/interview'
import type { CacheSize, NodeConfig, Tier } from '../engine/types'
import { chapter8 } from './chapter8'
import { blockers, graph, playJudged, type N } from './test-suite'

const ch = chapter8.chapter
const snowflake: Partial<NodeConfig> = { idScheme: 'snowflake', idClock: 'wait' }
const wires = ['u>lb', 'lb>web', 'web>c', 'c>db', 'web>g', 'g>db']
interface Opts {
  apps?: number
  appTier?: Tier
  cache?: CacheSize
  dbTier?: Tier
  ids?: number
  idCfg?: Partial<NodeConfig>
}
const design = ({ apps = 9, appTier = 0, cache = 'L', dbTier = 0, ids = 2, idCfg = snowflake }: Opts = {}): N[] => [
  ['u', 'traffic'],
  ['lb', 'lb'],
  ['web', 'app', apps, { tier: appTier }],
  ['c', 'cache', 1, { cacheSize: cache }],
  ['db', 'sqldb', 1, { tier: dbTier }],
  ['g', 'idgen', ids, idCfg],
]
const play = (stage: number, nodes: N[], w = wires) => playJudged(ch, stage, nodes, w)

describe('Chapter 8 main run', () => {
  it('nine web servers, a large cache and two Snowflake servers earn three stars', () => {
    const r = play(0, design())
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
    expect(r.cost).toBe(ch.stages[0]!.referenceCost)
  })

  it('eight web servers have no room for a crash', () => expect(play(0, design({ apps: 8 })).stars).toBe(0))
  it('a medium cache sends too many redirects to the database', () => expect(play(0, design({ cache: 'M' })).stars).toBe(0))
  it('one ID server is a single point of failure', () => expect(play(0, design({ ids: 1 })).stars).toBe(0))
  it('UUIDs make codes too long', () => expect(play(0, design({ idCfg: { idScheme: 'uuid' } })).missed.join(' ')).toMatch(/longer than 7 characters/))
})

describe('Chapter 8 curveball', () => {
  it('the viral link overwhelms the main design', () => expect(play(1, design()).stars).toBe(0))

  it('bigger web servers and a bigger database fix it in two changes', () => {
    const fixed = design({ apps: 14, appTier: 1, dbTier: 1 })
    expect(changedPieces(graph(design(), wires), graph(fixed, wires))).toBeLessThanOrEqual(chapter8.editBudget)
    const r = play(1, fixed)
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
  })

  it('scaling only the web servers leaves the database short', () => expect(play(1, design({ apps: 14, appTier: 1 })).stars).toBe(0))
})

describe('Chapter 8 rules', () => {
  it('the reference designs are legal', () => {
    expect(blockers(ch, 0, design(), wires)).toEqual([])
    expect(blockers(ch, 1, design({ apps: 14, appTier: 1, dbTier: 1 }), wires)).toEqual([])
  })

  it('blocks a design with no ID generator: new links have nowhere to get an ID', () => {
    const nodes = design().filter(([id]) => id !== 'g')
    const text = blockers(ch, 0, nodes, ['u>lb', 'lb>web', 'web>c', 'c>db']).join(' ')
    expect(text).toMatch(/add an ID generator/)
    expect(text).toMatch(/Nothing in your design can serve "New short link"/)
  })

  it('blocks redirects that skip the cache', () => {
    expect(blockers(ch, 0, design(), [...wires, 'web>db']).join(' ')).toMatch(/must check a cache before the database\. Right now Redirect can go around it/)
  })

  it('redirects never leak through the ID generator', () => {
    // Without the cache wire the only way to the database runs through the ID generator, which serves IDs only.
    expect(blockers(ch, 0, design(), ['u>lb', 'lb>web', 'web>g', 'g>db', 'web>c']).join(' ')).toMatch(/Nothing in your design can serve "Redirect"/)
  })
})
