import { describe, expect, it } from 'vitest'
import { changedPieces, reviewDesign } from '../engine/interview'
import { initSim } from '../engine/simulator'
import type { CacheSize, GeoIndex } from '../engine/types'
import { blockers, graph, playJudged, type N } from './test-suite'
import { v2chapter1 } from './v2chapter1'

const ch = v2chapter1.chapter
const wires = ['u>lb', 'lb>geo', 'geo>c', 'c>db', 'lb>web', 'web>db']
const design = (servers = 4, geoIndex: GeoIndex = 'geohash', geoNeighbours = true, cacheSize: CacheSize = 'M'): N[] => [
  ['u', 'traffic'],
  ['lb', 'lb'],
  ['geo', 'geoindex', servers, { geoIndex, geoNeighbours }],
  ['c', 'cache', 1, { cacheSize }],
  ['db', 'sqldb'],
  ['web', 'app'],
]
const play = (stage: number, nodes: N[], w = wires) => playJudged(ch, stage, nodes, w)

describe('V2 Chapter 1 main run', () => {
  it('four geohash servers that search neighbouring cells earn three stars', () => {
    const r = play(0, design())
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
    expect(r.cost).toBe(ch.stages[0]!.referenceCost)
  })

  it('a quadtree works too, at a higher price', () => expect(play(0, design(3, 'quadtree')).stars).toBeGreaterThanOrEqual(2))
  it('searching only the own cell misses places across the edge', () =>
    expect(play(0, design(4, 'geohash', false)).missed.join(' ')).toMatch(/missed places just across a cell edge/))
  it('a 2D range scan is far too slow', () => expect(play(0, design(10, 'scan', false)).metrics.uptime).toBeLessThan(0.9))
  it('an even grid needs far more servers for the dense cells', () => expect(play(0, design(4, 'grid', true)).stars).toBe(0))
  it('three servers have no room for a crash', () => expect(play(0, design(3)).stars).toBe(0))
})

describe('V2 Chapter 1 curveball', () => {
  it('New Year’s Eve overwhelms the main design', () => expect(play(1, design()).stars).toBe(0))

  it('more index servers and a bigger cache fix it in two changes', () => {
    const fixed = design(7, 'geohash', true, 'L')
    expect(changedPieces(graph(design(), wires), graph(fixed, wires))).toBeLessThanOrEqual(v2chapter1.editBudget)
    const r = play(1, fixed)
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
  })

  it('more index servers alone leave the database short', () => expect(play(1, design(7)).stars).toBe(0))

  it('the interviewer flags own-cell-only search', () => {
    const notes = reviewDesign(initSim(graph(design(4, 'geohash', false), wires), ch, 0), v2chapter1, [])
    expect(notes.map((n) => n.text).join('\n')).toMatch(/misses places just across the edge/)
  })
})

describe('V2 Chapter 1 rules', () => {
  it('the reference designs are legal', () => {
    expect(blockers(ch, 0, design(), wires)).toEqual([])
    expect(blockers(ch, 1, design(7, 'geohash', true, 'L'), wires)).toEqual([])
  })

  it('blocks a design with no geo index', () => {
    const nodes = design().filter(([id]) => id !== 'geo')
    expect(blockers(ch, 0, nodes, ['u>lb', 'lb>web', 'web>c', 'c>db']).join(' ')).toMatch(/needs a geospatial index/)
  })

  it('blocks place details that skip the cache', () =>
    expect(blockers(ch, 0, design(), [...wires, 'geo>db']).join(' ')).toMatch(/serve them from a cache\. Right now Nearby search can go around it/))

  it('owner edits never leak through the geo index', () =>
    expect(blockers(ch, 0, design(), ['u>lb', 'lb>geo', 'geo>c', 'c>db', 'web>db']).join(' ')).toMatch(/Nothing in your design can serve "Owner edit"/))
})
