import { describe, expect, it } from 'vitest'
import { evaluate, formatQuantity, formatUnits, gradeQuestion, stageStars } from '../engine/estimate'
import type { EquationQuestion, EquationStep } from '../engine/types'
import { chapter2 } from './chapter2'

const questions = chapter2.stages.flatMap((s) => s.questions)
const eq = (id: string) => questions.find((q) => q.id === id) as EquationQuestion
const chain = (...steps: [string, 'mul' | 'div'][]): EquationStep[] => steps.map(([cardId, op]) => ({ cardId, op }))

describe('Chapter 2 content', () => {
  it('has exactly one correct option on every pick question', () => {
    for (const q of questions) if (q.kind === 'pick') expect(q.options.filter((o) => o.correct)).toHaveLength(1)
  })

  it('has distinct values to order', () => {
    for (const q of questions) if (q.kind === 'order') expect(new Set(q.items.map((i) => i.value)).size).toBe(q.items.length)
  })

  it('makes every equation answer reachable from its own cards with the right units', () => {
    const intended: Record<string, EquationStep[]> = {
      'avg-qps': chain(['dau', 'mul'], ['views', 'mul'], ['s-per-day', 'div']),
      'peak-qps': chain(['dau', 'mul'], ['views', 'mul'], ['s-per-day', 'div'], ['peak', 'mul']),
      'five-years': chain(['uploads', 'mul'], ['photo-size', 'mul'], ['days-per-year', 'mul'], ['years', 'mul']),
      egress: chain(['dau', 'mul'], ['photo-views', 'mul'], ['photo-size', 'mul'], ['s-per-day', 'div']),
    }
    for (const q of questions.filter((q): q is EquationQuestion => q.kind === 'equation')) {
      const steps = intended[q.id]!
      expect(gradeQuestion(q, { kind: 'equation', steps })?.stars, q.id).toBe(3)
    }
  })
})

describe('equation strip', () => {
  const avg = eq('avg-qps')

  it('tracks units through the chain', () => {
    const r = evaluate(avg, chain(['dau', 'mul'], ['views', 'mul']))!
    expect(formatUnits(r.unit)).toBe('views/day')
    expect(formatQuantity(r.value, r.unit)).toBe('200M views/day')
  })

  it('rejects the right number in the wrong units', () => {
    // Dividing by hours in a day gives views per hour.
    const g = gradeQuestion(avg, { kind: 'equation', steps: chain(['dau', 'mul'], ['views', 'mul'], ['h-per-day', 'div']) })!
    expect(g.stars).toBe(0)
    expect(g.message).toMatch(/views\/hour.*views\/s/)
  })

  it('grades by order of magnitude', () => {
    // The full chain is exact; forgetting the peak factor is 2× low: right order of magnitude only.
    const peakQ = eq('peak-qps')
    const exact = chain(['dau', 'mul'], ['views', 'mul'], ['s-per-day', 'div'], ['peak', 'mul'])
    const noPeak = chain(['dau', 'mul'], ['views', 'mul'], ['s-per-day', 'div'])
    expect(gradeQuestion(peakQ, { kind: 'equation', steps: exact })!.stars).toBe(3)
    expect(gradeQuestion(peakQ, { kind: 'equation', steps: noPeak })!.stars).toBe(1)
  })

  it('formats bytes in base 10', () => {
    const r = evaluate(eq('five-years'), chain(['uploads', 'mul'], ['photo-size', 'mul'], ['days-per-year', 'mul'], ['years', 'mul']))!
    expect(formatQuantity(r.value, r.unit)).toBe('1.095 PB')
    const bw = evaluate(eq('egress'), chain(['dau', 'mul'], ['photo-views', 'mul'], ['photo-size', 'mul'], ['s-per-day', 'div']))!
    expect(formatQuantity(bw.value, bw.unit)).toBe('10.42 GB/s')
  })
})

describe('order and stage grading', () => {
  const order = questions.find((q) => q.id === 'fastest-first')!

  it('needs every item placed, and gives partial credit for near misses', () => {
    expect(gradeQuestion(order, { kind: 'order', ids: ['l1', 'ram'] })!.stars).toBe(0)
    expect(gradeQuestion(order, { kind: 'order', ids: ['l1', 'ram', 'ssd', 'dc', 'disk', 'ocean'] })!.stars).toBe(3)
    expect(gradeQuestion(order, { kind: 'order', ids: ['l1', 'ram', 'dc', 'ssd', 'disk', 'ocean'] })!.stars).toBe(1)
  })

  it('averages question stars into stage stars once all are answered', () => {
    const stage = chapter2.stages[0]!
    const three = { stars: 3 as const, message: '' }
    const zero = { stars: 0 as const, message: '' }
    expect(stageStars(stage, { 'billion-kb': three })).toBeNull()
    expect(stageStars(stage, { 'billion-kb': three, 'two-thirty': three, movies: zero })).toBe(2)
  })
})
