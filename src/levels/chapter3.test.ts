import { describe, expect, it } from 'vitest'
import { bottleneckQuestion, changedPieces, interviewReport, reviewDesign, scopeScore } from '../engine/interview'
import { stageResult, type StageResult } from '../engine/scoring'
import { initSim, TICKS_PER_SEC } from '../engine/simulator'
import { graph, run, type N } from '../engine/test-helpers'
import { chapter3 } from './chapter3'

const ch = chapter3.chapter
const through = { writeStrategy: 'through' } as const
const wires = ['u>cdn', 'cdn>lb', 'lb>web', 'web>c', 'c>db']

const design = (web: number, dbTier: 0 | 1): N[] => [
  ['u', 'traffic'],
  ['cdn', 'cdn'],
  ['lb', 'lb'],
  ['web', 'app', web],
  ['c', 'cache', 1, through],
  ['db', 'sqldb', 1, { tier: dbTier }],
]

function play(stage: number, nodes: N[], w = wires) {
  return stageResult(run(initSim(graph(nodes, w), ch, stage), ch.stages[stage]!.durationS * TICKS_PER_SEC))
}

describe('Chapter 3 photo-sharing level', () => {
  it('the reference design earns three stars on the main run, through the crash', () => {
    const r = play(0, design(6, 0))
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
    expect(r.cost).toBe(ch.stages[0]!.referenceCost)
  })

  it('the reference design is overwhelmed by the curveball', () => {
    expect(play(1, design(6, 0)).stars).toBe(0)
  })

  it('two changes (more web servers, a bigger database) handle the curveball', () => {
    const before = graph(design(6, 0), wires)
    const after = graph(design(11, 1), wires)
    expect(changedPieces(before, after)).toBe(2)
    const r = play(1, design(11, 1))
    expect(r.missed).toEqual([])
    expect(r.stars).toBe(3)
  })

  it('a bigger cache alone does not save the uploads', () => {
    const nodes = design(11, 0).map((n) => (n[1] === 'cache' ? (['c', 'cache', 1, { ...through, cacheSize: 'L' }] as N) : n))
    expect(play(1, nodes).stars).toBe(0)
  })

  it('without a CDN, distant users wait too long for photos', () => {
    const r = play(0, design(12, 0).filter((n) => n[1] !== 'cdn'), ['u>lb', 'lb>web', 'web>c', 'c>db'])
    expect(r.missed.join(' ')).toMatch(/p95/)
  })
})

describe('interviewer review', () => {
  const allHigh = chapter3.questions.filter((q) => q.leverage === 'high').map((q) => q.id)

  it('approves the reference design when every key question was asked', () => {
    const s = initSim(graph(design(6, 0), wires), ch, 0)
    expect(reviewDesign(s, chapter3, allHigh)).toEqual([{ tone: 'ok', text: "Looks reasonable. Let's see it under load." }])
  })

  it('flags a lone server, unserved requests and unasked questions', () => {
    const s = initSim(graph([['u', 'traffic'], ['web', 'app']], ['u>web']), ch, 0)
    const text = reviewDesign(s, chapter3, ['scale']).map((n) => n.text).join('\n')
    expect(text).toMatch(/single Web Server/)
    expect(text).toMatch(/Nothing in your design can serve "Feed view"/)
    expect(text).toMatch(/question to spare\. You could have asked: "Where are the users\?"/)
  })

  it('does not blame the player for the one fact a full budget of good questions leaves unknown', () => {
    const s = initSim(graph(design(6, 0), wires), ch, 0)
    const notes = reviewDesign(s, chapter3, ['scale', 'mix', 'where', 'fresh', 'failure'])
    expect(notes.filter((n) => n.tone === 'warn')).toEqual([])
    expect(notes[0]!.tone).toBe('ok')
    expect(notes.find((n) => n.tone === 'info')?.text).toMatch(/How fast must the feed load\?/)
  })

  it('points at a missed question when one was spent on a trap', () => {
    const s = initSim(graph(design(6, 0), wires), ch, 0)
    const warns = reviewDesign(s, chapter3, ['scale', 'mix', 'where', 'fresh', 'kafka']).filter((n) => n.tone === 'warn')
    expect(warns.map((n) => n.text)).toEqual(['You had a question to spare. You could have asked: "What should happen when a server dies?"'])
  })

  it('flags extra instances without a load balancer', () => {
    const s = initSim(graph([['u', 'traffic'], ['web', 'app', 3], ['db', 'sqldb']], ['u>web', 'web>db']), ch, 0)
    expect(reviewDesign(s, chapter3, allHigh).map((n) => n.text).join('\n')).toMatch(/no load balancer/)
  })

  it('raises stale reads only once freshness is known', () => {
    const aside = design(6, 0).map((n) => (n[1] === 'cache' ? (['c', 'cache'] as N) : n))
    const s = initSim(graph(aside, wires), ch, 0)
    expect(reviewDesign(s, chapter3, ['scale']).some((n) => /old copy/.test(n.text))).toBe(false)
    expect(reviewDesign(s, chapter3, ['fresh']).some((n) => /old copy/.test(n.text))).toBe(true)
  })
})

describe('scoring the interview', () => {
  it('scores scope on question leverage and feature cuts', () => {
    expect(scopeScore(chapter3, ['scale', 'mix', 'where', 'fresh', 'failure'], ['upload', 'feed', 'own']).ok).toBe(true)
    expect(scopeScore(chapter3, ['scale', 'mix', 'where', 'fresh', 'kafka'], ['upload', 'feed', 'own']).ok).toBe(false)
    const s = scopeScore(chapter3, ['scale', 'mix', 'where', 'fresh'], ['upload', 'feed', 'likes', 'comments'])
    expect(s.coreMissing).toEqual(['See your own photo right after posting'])
    expect(s.extras).toBe(2)
  })

  it('counts removed pieces and ignores pure re-wiring', () => {
    const a = graph([['u', 'traffic'], ['web', 'app'], ['db', 'sqldb']], ['u>web', 'web>db'])
    const rewired = graph([['u', 'traffic'], ['web', 'app'], ['db', 'sqldb']], ['u>web', 'u>db', 'web>db'])
    const removed = graph([['u', 'traffic'], ['web', 'app']], ['u>web'])
    expect(changedPieces(a, rewired)).toBe(0)
    expect(changedPieces(a, removed)).toBe(1)
  })

  it('grades the bottleneck question against peak loads', () => {
    const g = graph(design(6, 0), wires)
    const q = bottleneckQuestion(g, { web: 0.7, db: 1.1, c: 0.2 })
    expect(q.options.find((o) => o.correct)?.id).toBe('sqldb')
  })

  it('combines the steps into stars', () => {
    const good: StageResult = { stars: 3, metrics: {} as never, cost: 0, missed: [] }
    const failed: StageResult = { stars: 0, metrics: {} as never, cost: 0, missed: ['Uptime low'] }
    const scope = scopeScore(chapter3, ['scale', 'mix', 'where', 'fresh', 'failure'], ['upload', 'feed', 'own'])
    const base = { scope, run: good, deep: good, changes: 2, editBudget: 3, wrapUpCorrect: 2, wrapUpTotal: 2 }
    expect(interviewReport(base).stars).toBe(3)
    expect(interviewReport({ ...base, wrapUpCorrect: 1 }).stars).toBe(2)
    expect(interviewReport({ ...base, changes: 5 }).stars).toBe(0)
    expect(interviewReport({ ...base, run: failed }).stars).toBe(0)
  })
})
