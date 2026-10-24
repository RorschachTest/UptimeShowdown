import { COMPONENTS } from './components'
import { graphCostPerMin, type StageResult } from './scoring'
import type { ComponentKind, FactId, Graph, InterviewLevel, SimState, WrapUpQuestion } from './types'

export function revealedFacts(level: InterviewLevel, asked: string[]): Set<FactId> {
  return new Set(level.questions.filter((q) => asked.includes(q.id)).flatMap((q) => q.reveals))
}

export interface ReviewNote {
  tone: 'ok' | 'info' | 'warn'
  text: string
}

/** The interviewer's read of a proposed design, before it runs. Advisory; hard rules live in rules/. */
export function reviewDesign(state: SimState, level: InterviewLevel, asked: string[]): ReviewNote[] {
  const stage = state.chapter.stages[0]!
  const facts = revealedFacts(level, asked)
  const notes: ReviewNote[] = []
  const warn = (text: string) => notes.push({ tone: 'warn', text })

  for (const node of state.graph.nodes) {
    const def = COMPONENTS[node.kind]
    for (const text of def.review?.(node, { balanced: !!state.lbFed[node.id] }) ?? []) warn(text)
    if (def.count?.field === 'instances') {
      if (node.instances === 1) warn(`A single ${def.label}: if it crashes, everything behind it goes with it.`)
      else if (!state.lbFed[node.id]) warn(`${node.instances} ${def.label}s, but no load balancer in front: users can only reach one.`)
    }
    // Only an interviewer who knows freshness matters would push on stale reads.
    if (facts.has('freshness')) {
      if (node.kind === 'cache' && node.config.writeStrategy === 'aside')
        warn('Cache-aside can hand people an old copy right after they post. You said that must not happen.')
      if (node.kind === 'sqldb' && node.config.replicas > 0 && node.config.readRouting === 'replicas')
        warn('Reading from lagging replicas can hide a photo someone just posted. You said that must not happen.')
    }
  }

  const cost = graphCostPerMin(state.graph)
  if (cost > stage.budget) warn(`This costs ${cost}/min; the budget is ${stage.budget}/min.`)

  // The budget can't cover every useful question, so only call out ones a wasted question could have bought.
  const askedCards = level.questions.filter((q) => asked.includes(q.id))
  let spare = level.questionBudget - askedCards.filter((q) => q.leverage === 'high').length
  for (const q of level.questions) {
    if (q.leverage !== 'high' || asked.includes(q.id)) continue
    if (spare-- > 0) warn(`You had a question to spare. You could have asked: "${q.text}"`)
    else notes.push({ tone: 'info', text: `Unknown going in: "${q.text}" Leave some headroom.` })
  }

  if (!notes.some((n) => n.tone === 'warn')) notes.unshift({ tone: 'ok', text: "Looks reasonable. Let's see it under load." })
  return notes
}

/** Pieces changed since `before`: added, removed, or re-configured nodes. Re-wiring is free. */
export function changedPieces(before: Graph, after: Graph): number {
  const old = new Map(before.nodes.map((n) => [n.id, n]))
  const now = new Set(after.nodes.map((n) => n.id))
  let changed = 0
  for (const n of after.nodes) {
    const prev = old.get(n.id)
    if (!prev || prev.instances !== n.instances || JSON.stringify(prev.config) !== JSON.stringify(n.config)) changed++
  }
  for (const id of old.keys()) if (!now.has(id)) changed++
  return changed
}

export interface ScopeScore {
  highAsked: number
  traps: number
  coreMissing: string[]
  extras: number
  ok: boolean
}

export function scopeScore(level: InterviewLevel, asked: string[], inScope: string[]): ScopeScore {
  const askedCards = level.questions.filter((q) => asked.includes(q.id))
  const highAsked = askedCards.filter((q) => q.leverage === 'high').length
  const traps = askedCards.filter((q) => q.leverage === 'trap').length
  const coreMissing = level.features.filter((f) => f.core && !inScope.includes(f.id)).map((f) => f.text)
  const extras = level.features.filter((f) => !f.core && inScope.includes(f.id)).length
  return { highAsked, traps, coreMissing, extras, ok: highAsked >= 4 && traps === 0 && coreMissing.length === 0 && extras <= 1 }
}

/** "Which piece was closest to its limit?", answered by the peak loads of the player's own run. */
export function bottleneckQuestion(graph: Graph, peaks: Record<string, number>): WrapUpQuestion {
  const kinds = [...new Set(graph.nodes.filter((n) => n.kind !== 'traffic').map((n) => n.kind))]
  let worst: ComponentKind | null = null
  let worstLoad = -1
  for (const n of graph.nodes) {
    const load = peaks[n.id] ?? 0
    if (n.kind !== 'traffic' && load > worstLoad) {
      worst = n.kind
      worstLoad = load
    }
  }
  return {
    id: 'bottleneck',
    prompt: 'In the deep dive, which piece came closest to its limit?',
    options: kinds.map((k) => ({ id: k, text: COMPONENTS[k].label, correct: k === worst })),
    explain: worst ? `Your ${COMPONENTS[worst].label} peaked at ${Math.round(worstLoad * 100)}% load.` : 'Nothing ran.',
  }
}

export interface ReportLine {
  step: string
  ok: boolean
  detail: string
}

export interface Report {
  stars: 0 | 1 | 2 | 3
  lines: ReportLine[]
}

export function interviewReport(args: {
  scope: ScopeScore
  run: StageResult
  deep: StageResult
  changes: number
  editBudget: number
  wrapUpCorrect: number
  wrapUpTotal: number
}): Report {
  const { scope, run, deep, changes, editBudget, wrapUpCorrect, wrapUpTotal } = args
  const deepOk = deep.stars > 0 && changes <= editBudget
  const wrapOk = wrapUpCorrect === wrapUpTotal
  const lines: ReportLine[] = [
    {
      step: 'Scope',
      ok: scope.ok,
      detail: [
        `${scope.highAsked} high-value questions`,
        scope.traps ? `${scope.traps} wasted on traps` : '',
        scope.coreMissing.length ? `missing core: ${scope.coreMissing.join(', ')}` : '',
        scope.extras > 1 ? `${scope.extras} extra features kept in scope` : '',
      ]
        .filter(Boolean)
        .join(' · '),
    },
    { step: 'Design run', ok: run.stars > 0, detail: run.missed[0] ?? `${'★'.repeat(run.stars)} goals met` },
    {
      step: 'Deep dive',
      ok: deepOk,
      detail: changes > editBudget ? `Changed ${changes} pieces (limit ${editBudget}): rebuilt instead of adapting` : (deep.missed[0] ?? `Adapted with ${changes} change${changes === 1 ? '' : 's'}`),
    },
    { step: 'Wrap-up', ok: wrapOk, detail: `${wrapUpCorrect} of ${wrapUpTotal} correct` },
  ]
  const base = run.stars > 0 && deepOk
  const stars = (!base ? 0 : 1 + (scope.ok ? 1 : 0) + (wrapOk ? 1 : 0)) as Report['stars']
  return { stars, lines }
}
