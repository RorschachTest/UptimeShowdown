import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { isBlocked } from '../engine/rules'
import { diagnose, graphCostPerMin, summarize, type Bottleneck } from '../engine/scoring'
import { currentStage, TICKS_PER_SEC } from '../engine/simulator'
import { chapterById } from '../levels'
import { useGameStore, type Speed } from '../store'
import { fmtClock, fmtInt, fmtMs, fmtPct } from './format'

const SPEEDS: Speed[] = [1, 2, 4]

const BOUND_LABEL: Record<Bottleneck, string> = {
  compute: 'Compute-bound',
  storage: 'Storage-bound',
  network: 'Network-bound',
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' }) {
  const color = tone === 'ok' ? 'text-ok' : tone === 'bad' ? 'text-bad' : 'text-ink'
  return (
    <div className="min-w-18">
      <div className="text-xs text-ink-soft">{label}</div>
      <div className={`text-xl leading-tight font-bold ${color}`}>{value}</div>
    </div>
  )
}

export function HUD() {
  const { sim, running, speed, setRunning, setSpeed, reset, chapterId, view, setView, canPlay } = useGameStore(
    useShallow((s) => ({
      chapterId: s.chapterId,
      view: s.view,
      setView: s.setView,
      // Interviews only run from the review ("Run it") and during the deep dive.
      canPlay: !s.result && !isBlocked(s.issues) && (!s.interview || s.interview.phase === 'deepdive' || (s.interview.phase === 'run' && !s.interview.runResult)),
      sim: s.sim,
      running: s.running,
      speed: s.speed,
      setRunning: s.setRunning,
      setSpeed: s.setSpeed,
      reset: s.reset,
    })),
  )
  const stage = currentStage(sim)
  const metrics = useMemo(() => summarize(sim.window), [sim.window])
  const diagnosis = diagnose(sim)
  const cost = graphCostPerMin(sim.graph)
  const overBudget = cost > stage.budget
  const started = sim.tick > 0
  const finished = metrics.successRps + metrics.errorRps > 0
  const showStale = (stage.mix.ryw ?? 0) > 0
  const showBots = sim.chapter.requestTypes.some((rt) => rt.abusive && (stage.mix[rt.id] ?? 0) > 0)
  // Only a board being played shows the simulation readouts and controls.
  const estimating = useGameStore((s) => s.estimate !== null)
  const boardless = view !== 'play' || estimating
  const entry = chapterById(chapterId)

  return (
    <header className="flex flex-wrap items-center gap-x-7 gap-y-3 border-b-2 border-ink bg-panel px-5 py-3">
      <div className="mr-auto flex items-center gap-3">
        <h1 className="text-xl leading-tight font-extrabold tracking-tight">Uptime Showdown</h1>
        <button type="button" onClick={() => setView('campaign')} className="rounded-lg border-2 border-ink px-2.5 py-1 text-sm font-semibold hover:bg-board">
          ← Chapters
        </button>
        <span className="text-sm font-semibold">
          {entry.volume === 1 ? 'Vol 1' : 'Vol 2'} · {entry.number}. {entry.title}
        </span>
        <div className="flex overflow-hidden rounded-lg border-2 border-ink" role="group" aria-label="Step">
          {(['lesson', 'play'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => view !== v && setView(v)}
              className={`px-2.5 py-1 text-sm font-semibold ${view === v ? 'bg-ink text-piece' : 'bg-piece hover:bg-board'}`}
            >
              {v === 'lesson' ? 'Learn' : 'Play'}
            </button>
          ))}
        </div>
      </div>

      {!boardless && (
        <>
      <div className="flex items-center gap-5" aria-live="polite">
        <Stat label="Traffic" value={`${fmtInt(metrics.rps)} rps`} />
        <Stat
          label="Uptime"
          value={started && finished ? fmtPct(metrics.uptime) : '–'}
          tone={started && finished ? (metrics.uptime >= stage.goals.uptime ? 'ok' : 'bad') : undefined}
        />
        <Stat
          label="p95 latency"
          value={started && metrics.p95Ms > 0 ? fmtMs(metrics.p95Ms) : '–'}
          tone={started && metrics.p95Ms > 0 ? (metrics.p95Ms <= stage.goals.p95Ms ? 'ok' : 'bad') : undefined}
        />
        <Stat label="Errors" value={`${fmtInt(metrics.errorRps)}/s`} tone={metrics.errorRps >= 1 ? 'bad' : undefined} />
        {showBots && (
          <Stat
            label="Scrapers through"
            value={fmtPct(metrics.botServedRate)}
            tone={started && stage.goals.maxBotServedRate !== undefined ? (metrics.botServedRate <= stage.goals.maxBotServedRate ? 'ok' : 'bad') : undefined}
          />
        )}
        {showStale && (
          <Stat
            label="Stale reads"
            value={fmtPct(metrics.staleRate)}
            tone={started ? (metrics.staleRate <= stage.goals.maxStaleRate ? 'ok' : 'bad') : undefined}
          />
        )}
      </div>

      <div
        className={`min-w-52 rounded-lg border-2 px-2.5 py-1 text-sm ${diagnosis ? 'border-bad text-bad' : 'border-ink/15 text-ink-soft'}`}
        role="status"
        aria-label="Bottleneck"
      >
        {diagnosis ? (
          <>
            <span className="font-bold">{diagnosis.down ? 'Down' : BOUND_LABEL[diagnosis.bound]}</span>
            {': '}
            {diagnosis.label}
            {diagnosis.down ? '' : ` at ${Math.round(diagnosis.load * 100)}%`}
          </>
        ) : started ? (
          'No bottleneck'
        ) : (
          'Bottlenecks show here'
        )}
      </div>

      <div className="w-40">
        <div className="flex justify-between text-xs text-ink-soft">
          <span>Cost per minute</span>
          <span className={overBudget ? 'font-semibold text-bad' : ''}>
            {cost} / {stage.budget}
          </span>
        </div>
        <div className="mt-1 h-2.5 overflow-hidden rounded-full border-2 border-ink bg-piece">
          <div className={`h-full ${overBudget ? 'bg-bad' : 'bg-ink'}`} style={{ width: `${Math.min(100, (cost / stage.budget) * 100)}%` }} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-right text-sm font-semibold whitespace-nowrap">
          {fmtClock(sim.tick / TICKS_PER_SEC)} <span className="text-ink-faint">/ {fmtClock(stage.durationS)}</span>
        </span>
        <button
          type="button"
          onClick={() => setRunning(!running)}
          disabled={!canPlay && !running}
          className="piece w-24 bg-ink py-1.5 font-bold text-piece active:translate-x-px active:translate-y-px disabled:opacity-40"
        >
          {running ? 'Pause' : !canPlay && started ? 'Finished' : started ? 'Resume' : 'Run'}
        </button>
        <div className="flex overflow-hidden rounded-lg border-2 border-ink" role="group" aria-label="Speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={speed === s}
              onClick={() => setSpeed(s)}
              className={`px-2.5 py-1 text-sm font-semibold ${speed === s ? 'bg-ink text-piece' : 'bg-piece hover:bg-board'}`}
            >
              {s}×
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={reset}
          disabled={!started}
          className="rounded-lg border-2 border-ink bg-piece px-3 py-1 text-sm font-semibold hover:bg-board disabled:opacity-40"
        >
          Reset
        </button>
      </div>
        </>
      )}
    </header>
  )
}
