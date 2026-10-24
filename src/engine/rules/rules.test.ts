import { describe, expect, it } from 'vitest'
import { judgeRun } from '../judge'
import { initSim } from '../simulator'
import { graph, run } from '../test-helpers'
import type { Chapter } from '../types'
import { checkDesign, isBlocked } from './index'

const chapter = (rules?: Chapter['rules']): Chapter => ({
  id: 't',
  title: 'T',
  seed: 1,
  rules,
  requestTypes: [
    { id: 'page', label: 'Page view', needs: ['compute', 'lookup'], weight: 1, consistency: 'any', distanceMs: 0 },
    { id: 'static', label: 'Images', needs: ['static'], weight: 2, consistency: 'any', distanceMs: 0 },
    { id: 'scrape', label: 'Scraper', needs: ['compute', 'lookup'], weight: 1, consistency: 'any', distanceMs: 0, abusive: true },
  ],
  stages: [
    {
      id: 's',
      title: 'S',
      story: '',
      durationS: 10,
      traffic: [{ t: 0, rps: 200 }],
      mix: { page: 0.5, static: 0.3, scrape: 0.2 },
      clients: { page: 100, static: 100, scrape: 2 },
      unlocks: { kinds: ['cdn', 'app', 'sqldb', 'cache', 'ratelimit', 'allinone', 'lb'], settings: [] },
      events: [],
      budget: 1000,
      referenceCost: 100,
      goals: { uptime: 0.99, p95Ms: 300, maxStaleRate: 0.001 },
    },
  ],
})

const texts = (ch: Chapter, g: ReturnType<typeof graph>) => checkDesign(g, ch, 0).map((i) => `${i.severity}: ${i.text}`)

describe('global rules', () => {
  const legal = graph([['u', 'traffic'], ['cdn', 'cdn'], ['web', 'app'], ['db', 'sqldb']], ['u>cdn', 'cdn>web', 'web>db'])

  it('passes a legal design', () => {
    expect(checkDesign(legal, chapter(), 0)).toEqual([])
  })

  it('blocks when a real request type has no complete path', () => {
    const g = graph([['u', 'traffic'], ['web', 'app']], ['u>web'])
    expect(texts(chapter(), g)).toContain('block: Nothing in your design can serve "Page view" yet.')
  })

  it('blocks a piece nothing ever reaches', () => {
    const g = graph([['u', 'traffic'], ['web', 'app'], ['db', 'sqldb'], ['c', 'cache']], ['u>web', 'web>db'])
    expect(texts(chapter(), g).join('\n')).toMatch(/block: The Cache isn't on any request's path/)
  })

  it('blocks a dead branch: a piece that is wired in but can never be used', () => {
    // A cache hanging off the CDN can't help static files and has nothing behind it.
    const g = graph([['u', 'traffic'], ['cdn', 'cdn'], ['web', 'app'], ['db', 'sqldb'], ['c', 'cache']], ['u>cdn', 'cdn>web', 'web>db', 'cdn>c'])
    expect(texts(chapter(), g).join('\n')).toMatch(/The Cache isn't on any request's path/)
  })

  it('blocks a CDN placed behind a server', () => {
    const g = graph([['u', 'traffic'], ['web', 'app'], ['cdn', 'cdn'], ['db', 'sqldb']], ['u>web', 'web>cdn', 'web>db'])
    expect(texts(chapter(), g).join('\n')).toMatch(/A CDN belongs at the edge/)
  })

  it('does not require a path for abusive traffic', () => {
    const ch: Chapter = { ...chapter(), requestTypes: chapter().requestTypes.map((rt) => (rt.id === 'scrape' ? { ...rt, needs: ['write'] as const } : rt)) as Chapter['requestTypes'] }
    expect(isBlocked(checkDesign(legal, ch, 0))).toBe(false)
  })
})

describe('unlocks', () => {
  it('blocks pieces and settings the stage has not unlocked', () => {
    const ch = chapter()
    const locked: Chapter = { ...ch, stages: [{ ...ch.stages[0]!, unlocks: { kinds: ['app', 'sqldb'], settings: [] } }] }
    const g = graph([['u', 'traffic'], ['cdn', 'cdn'], ['web', 'app', 1, { tier: 2 }], ['db', 'sqldb', 1, { replicas: 2 }]], ['u>cdn', 'cdn>web', 'web>db'])
    const t = texts(locked, g).join('\n')
    expect(t).toMatch(/The CDN isn't available in this stage/)
    expect(t).toMatch(/Web Server: "Machine size" isn't unlocked yet/)
    expect(t).toMatch(/SQL Database: "Read replicas" isn't unlocked yet/)
  })
})

describe('level rules', () => {
  const rules: Chapter['rules'] = {
    requires: [{ kind: 'ratelimit', why: 'This API needs a rate limiter.' }],
    mustPassThrough: [{ types: ['page', 'scrape'], kind: 'ratelimit', why: 'All API traffic must go through the rate limiter.' }],
    forbid: [{ kind: 'allinone', why: 'One box is not an answer here.' }],
  }
  const through = graph([['u', 'traffic'], ['cdn', 'cdn'], ['rl', 'ratelimit'], ['web', 'app'], ['db', 'sqldb']], ['u>cdn', 'cdn>rl', 'rl>web', 'web>db'])

  it('passes when every rule holds', () => {
    expect(checkDesign(through, chapter(rules), 0)).toEqual([])
  })

  it('blocks a missing required piece', () => {
    const g = graph([['u', 'traffic'], ['cdn', 'cdn'], ['web', 'app'], ['db', 'sqldb']], ['u>cdn', 'cdn>web', 'web>db'])
    expect(texts(chapter(rules), g)).toContain('block: This API needs a rate limiter.')
  })

  it('blocks a side wire that lets traffic bypass a required piece', () => {
    const bypass = graph(
      [['u', 'traffic'], ['cdn', 'cdn'], ['rl', 'ratelimit'], ['web', 'app'], ['db', 'sqldb']],
      ['u>cdn', 'cdn>rl', 'rl>web', 'web>db', 'cdn>web'],
    )
    expect(texts(chapter(rules), bypass).join('\n')).toMatch(/must go through the rate limiter\. Right now Page view, Scraper can go around it/)
  })

  it('blocks a forbidden piece', () => {
    const g = graph(
      [['u', 'traffic'], ['cdn', 'cdn'], ['rl', 'ratelimit'], ['box', 'allinone']],
      ['u>cdn', 'cdn>rl', 'rl>box'],
    )
    expect(texts(chapter(rules), g)).toContain('block: One box is not an answer here.')
  })
})

describe('judge', () => {
  const g = graph([['u', 'traffic'], ['cdn', 'cdn'], ['web', 'app'], ['db', 'sqldb']], ['u>cdn', 'cdn>web', 'web>db'])
  const finished = run(initSim(g, chapter(), 0), 100)

  it('awards stars to a clean, legal run', () => {
    expect(judgeRun(finished, { issues: [], edited: false }).stars).toBeGreaterThan(0)
  })

  it('gives no stars to an illegal design, even if it ran', () => {
    const r = judgeRun(finished, { issues: [{ severity: 'block', text: 'Broken.' }], edited: false })
    expect(r.stars).toBe(0)
    expect(r.missed[0]).toBe('Illegal design: Broken.')
  })

  it('gives no stars when the design changed mid-run', () => {
    const r = judgeRun(finished, { issues: [], edited: true })
    expect(r.stars).toBe(0)
    expect(r.missed[0]).toMatch(/changed the design during the run/)
  })
})
