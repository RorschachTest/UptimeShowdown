import { describe, expect, it } from 'vitest'
import { COMPONENTS } from '../engine/components'
import type { Chapter, EstimateQuestion } from '../engine/types'
import { CHAPTERS } from './index'

/** Data checks every chapter must pass, so new chapters can't ship malformed content. */

function checkQuestion(q: EstimateQuestion) {
  if (q.kind === 'pick') expect(q.options.filter((o) => o.correct), q.id).toHaveLength(1)
  if (q.kind === 'order') expect(new Set(q.items.map((i) => i.value)).size, q.id).toBe(q.items.length)
  if (q.kind === 'equation') expect(q.cards.length, q.id).toBeGreaterThan(1)
  expect(q.explain.length, q.id).toBeGreaterThan(10)
}

function checkBoardChapter(ch: Chapter) {
  const typeIds = new Set(ch.requestTypes.map((rt) => rt.id))
  for (const stage of ch.stages) {
    const total = Object.values(stage.mix).reduce((s, v) => s + v, 0)
    expect(total, `${stage.id} mix`).toBeCloseTo(1, 6)
    for (const id of Object.keys(stage.mix)) expect(typeIds.has(id), `${stage.id} mix type ${id}`).toBe(true)
    for (const kind of stage.unlocks.kinds) expect(COMPONENTS[kind], `${stage.id} unlock ${kind}`).toBeDefined()
    expect(stage.referenceCost, stage.id).toBeLessThanOrEqual(stage.budget)
    expect(stage.traffic[0]!.rps, stage.id).toBeGreaterThan(0)
  }
  for (const r of ch.rules?.mustPassThrough ?? []) for (const t of r.types) expect(typeIds.has(t), `rule type ${t}`).toBe(true)
}

describe('campaign', () => {
  it('has unique chapter ids and (volume, number) pairs', () => {
    expect(new Set(CHAPTERS.map((c) => c.id)).size).toBe(CHAPTERS.length)
    expect(new Set(CHAPTERS.map((c) => `${c.volume}-${c.number}`)).size).toBe(CHAPTERS.length)
  })

  for (const entry of CHAPTERS) {
    describe(`${entry.id} ${entry.title}`, () => {
      it('has a lesson with cards and a valid quiz', () => {
        expect(entry.lesson.cards.length).toBeGreaterThanOrEqual(3)
        expect(entry.lesson.quiz.length).toBeGreaterThanOrEqual(2)
        expect(new Set(entry.lesson.quiz.map((q) => q.id)).size).toBe(entry.lesson.quiz.length)
        entry.lesson.quiz.forEach(checkQuestion)
        for (const card of entry.lesson.cards) {
          if (!card.diagram) continue
          const ids = new Set(card.diagram.nodes.map(([id]) => id))
          for (const w of card.diagram.wires) for (const end of w.split('>')) expect(ids.has(end), `${card.title}: ${w}`).toBe(true)
        }
      })

      const play = entry.play
      if (play.kind === 'ladder') it('has valid stage data', () => checkBoardChapter(play.chapter))
      if (play.kind === 'interview')
        it('has valid workshop data', () => {
          const lv = play.level
          checkBoardChapter(lv.chapter)
          expect(lv.chapter.stages).toHaveLength(2)
          const high = lv.questions.filter((q) => q.leverage === 'high')
          expect(high.length).toBeGreaterThanOrEqual(lv.questionBudget)
          expect(lv.questions.some((q) => q.leverage === 'trap')).toBe(true)
          for (const q of high) expect(q.reveals.length, q.id).toBeGreaterThan(0)
          expect(lv.features.some((f) => f.core)).toBe(true)
          for (const w of lv.wrapUp) expect(w.options.filter((o) => o.correct), w.id).toHaveLength(1)
        })
      if (play.kind === 'estimate') it('has valid estimation stages', () => play.level.stages.flatMap((s) => s.questions).forEach(checkQuestion))
    })
  }
})
