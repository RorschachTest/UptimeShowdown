import { describe, expect, it } from 'vitest'
import { changedPieces, reviewDesign } from '../engine/interview'
import { initSim } from '../engine/simulator'
import type { NodeConfig } from '../engine/types'
import { chapter9 } from './chapter9'
import { blockers, graph, playJudged, type N } from './test-suite'

const ch = chapter9.chapter
const wires = ['u>f', 'f>d']
const F = { crawlPolite: true, crawlRobots: true, crawlDepth: true }
const D = { dlDns: true, dlDedupe: true }
const crawler = (downloaders = 3, f: Partial<NodeConfig> = F, d: Partial<NodeConfig> = D): N[] => [
  ['u', 'traffic'],
  ['f', 'frontier', 1, f],
  ['d', 'downloader', downloaders, d],
]
const play = (stage: number, nodes: N[], w = wires) => playJudged(ch, stage, nodes, w)
const missed = (stage: number, nodes: N[]) => play(stage, nodes).missed.join(' ')

describe('Chapter 9 main run', () => {
  it('a polite frontier and three downloaders with DNS cache and dedupe earn three stars', () => {
    const r = play(0, crawler())
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
    expect(r.cost).toBe(ch.stages[0]!.referenceCost)
  })

  it('without per-host queues the crawler hammers sites', () => expect(missed(0, crawler(3, { ...F, crawlPolite: false }))).toMatch(/hammered the same site/))
  it('ignoring robots.txt fetches forbidden pages', () => expect(missed(0, crawler(3, { ...F, crawlRobots: false }))).toMatch(/against robots\.txt/))
  it('no depth limit falls into spider traps', () => expect(missed(0, crawler(3, { ...F, crawlDepth: false }))).toMatch(/spider traps/))
  it('storing everything keeps duplicates', () => expect(missed(0, crawler(3, F, { dlDns: true }))).toMatch(/duplicate pages stored/))
  it('without a DNS cache the outage stalls the crawl', () => expect(missed(0, crawler(6, F, { dlDedupe: true }))).toMatch(/Background work took/))
})

describe('Chapter 9 curveball', () => {
  it('three downloaders cannot crawl the news hourly', () => expect(play(1, crawler()).stars).toBe(0))

  it('eight downloaders fix it with one change', () => {
    expect(changedPieces(graph(crawler(), wires), graph(crawler(8), wires))).toBeLessThanOrEqual(chapter9.editBudget)
    const r = play(1, crawler(8))
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
  })

  it('the interviewer flags an impolite frontier', () => {
    const notes = reviewDesign(initSim(graph(crawler(3, { ...F, crawlPolite: false }), wires), ch, 0), chapter9, [])
    expect(notes.map((n) => n.text).join('\n')).toMatch(/hammer the same site/)
  })
})

describe('Chapter 9 rules', () => {
  it('the reference designs are legal', () => {
    expect(blockers(ch, 0, crawler(), wires)).toEqual([])
    expect(blockers(ch, 1, crawler(8), wires)).toEqual([])
  })
  it('blocks a crawler with no frontier', () =>
    expect(blockers(ch, 0, [['u', 'traffic'], ['d', 'downloader', 3, D]], ['u>d']).join(' ')).toMatch(/needs a URL frontier/))
  it('blocks a frontier with no downloaders', () =>
    expect(blockers(ch, 0, [['u', 'traffic'], ['f', 'frontier', 1, F]], ['u>f']).join(' ')).toMatch(/Something has to download the pages/))
  it('blocks pieces this chapter has not unlocked', () =>
    expect(blockers(ch, 0, [...crawler(), ['q', 'queue']], [...wires, 'u>q']).join(' ')).toMatch(/Message Queue isn't available/))
})
