import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { graphCostPerMin, summarize } from '../engine/scoring'
import { TICKS_PER_SEC } from '../engine/simulator'
import { useGameStore, type Speed } from '../store'
import { fmtClock, fmtInt, fmtMs, fmtPct } from './format'

const SPEEDS: Speed[] = [1, 2, 4]

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' }) {
  const color = tone === 'ok' ? 'text-ok' : tone === 'bad' ? 'text-bad' : 'text-ink'
  return (
    <div className="min-w-20">
      <div className="text-xs text-ink-soft">{label}</div>
      <div className={`text-xl leading-tight font-bold ${color}`}>{value}</div>
    </div>
  )
}

export function HUD() {
  const { sim, level, running, speed, setRunning, setSpeed, reset } = useGameStore(
    useShallow((s) => ({
      sim: s.sim,
      level: s.level,
      running: s.running,
      speed: s.speed,
      setRunning: s.setRunning,
      setSpeed: s.setSpeed,
      reset: s.reset,
    })),
  )
  const metrics = useMemo(() => summarize(sim.window), [sim.window])
  const cost = graphCostPerMin(sim.graph)
  const overBudget = cost > level.budget
  const started = sim.tick > 0
  const finished = metrics.successRps + metrics.errorRps > 0

  return (
    <header className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b-2 border-ink bg-panel px-5 py-3">
      <div className="mr-auto">
        <h1 className="text-xl leading-tight font-extrabold tracking-tight">Uptime Showdown</h1>
        <p className="text-sm text-ink-soft">
          {level.title}: keep uptime above {fmtPct(level.goals.uptime)} and p95 under {fmtMs(level.goals.p95Ms)}
        </p>
      </div>

      <div className="flex items-center gap-6" aria-live="polite">
        <Stat label="Traffic" value={`${fmtInt(metrics.rps)} rps`} />
        <Stat
          label="Uptime"
          value={started && finished ? fmtPct(metrics.uptime) : '–'}
          tone={started && finished ? (metrics.uptime >= level.goals.uptime ? 'ok' : 'bad') : undefined}
        />
        <Stat
          label="p95 latency"
          value={started && metrics.p95Ms > 0 ? fmtMs(metrics.p95Ms) : '–'}
          tone={started && metrics.p95Ms > 0 ? (metrics.p95Ms <= level.goals.p95Ms ? 'ok' : 'bad') : undefined}
        />
        <Stat label="p50 latency" value={started && metrics.p50Ms > 0 ? fmtMs(metrics.p50Ms) : '–'} />
        <Stat label="Errors" value={`${fmtInt(metrics.errorRps)}/s`} tone={metrics.errorRps >= 1 ? 'bad' : undefined} />
      </div>

      <div className="w-44">
        <div className="flex justify-between text-xs text-ink-soft">
          <span>Cost per minute</span>
          <span className={overBudget ? 'font-semibold text-bad' : ''}>
            {cost} / {level.budget}
          </span>
        </div>
        <div className="mt-1 h-2.5 overflow-hidden rounded-full border-2 border-ink bg-piece">
          <div
            className={`h-full ${overBudget ? 'bg-bad' : 'bg-ink'}`}
            style={{ width: `${Math.min(100, (cost / level.budget) * 100)}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="w-12 text-right text-lg font-semibold">{fmtClock(sim.tick / TICKS_PER_SEC)}</span>
        <button
          type="button"
          onClick={() => setRunning(!running)}
          className="piece w-24 bg-ink py-1.5 font-bold text-piece active:translate-x-px active:translate-y-px"
        >
          {running ? 'Pause' : started ? 'Resume' : 'Play'}
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
    </header>
  )
}
