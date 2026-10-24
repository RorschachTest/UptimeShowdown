import { useState } from 'react'
import { Figure } from '../Visual'

const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000
const GOALS = { years: 50, machines: 1000, perMs: 4000 }

/** Bit packer: share 63 bits between timestamp, machine ID and sequence, and check the result against real needs. */
export function BitPacker() {
  const [ts, setTs] = useState(36)
  const [machine, setMachine] = useState(14)
  const seq = 63 - ts - machine
  const years = 2 ** ts / MS_PER_YEAR
  const machines = 2 ** machine
  const perMs = seq >= 0 ? 2 ** seq : 0
  const checks = [
    {
      ok: years >= GOALS.years,
      text: `Lasts ${years >= 1000 ? 'thousands of' : years.toFixed(years < 10 ? 1 : 0)} years (need ${GOALS.years})`,
    },
    {
      ok: machines >= GOALS.machines,
      text: `${machines.toLocaleString('en-US')} machines (need ${GOALS.machines.toLocaleString('en-US')})`,
    },
    {
      ok: perMs >= GOALS.perMs,
      text: `${perMs.toLocaleString('en-US')} IDs per ms per machine (need ${GOALS.perMs.toLocaleString('en-US')})`,
    },
  ]
  const fields = [
    { label: 'sign', bits: 1, color: 'var(--color-ink-soft)' },
    { label: 'timestamp', bits: ts, color: 'var(--color-read)' },
    { label: 'machine', bits: machine, color: 'var(--color-ryw)' },
    { label: 'sequence', bits: Math.max(seq, 0), color: 'var(--color-write)' },
  ]
  const slider = (label: string, value: number, min: number, max: number, set: (v: number) => void, color: string) => (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-24 font-semibold" style={{ color }}>
        {label}
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => set(Number(e.target.value))} className="flex-1" style={{ accentColor: color }} />
      <span className="w-14 text-right font-bold tabular-nums">{value} bits</span>
    </label>
  )

  return (
    <Figure
      lab
      caption="One 64-bit number, three jobs. More timestamp bits last longer, more machine bits allow more servers, more sequence bits allow more IDs per millisecond. Find a split that meets all three needs (Snowflake uses 41 / 10 / 12)."
    >
      <div
        className="flex h-10 overflow-hidden rounded-lg border-2 border-ink"
        role="img"
        aria-label={fields.map((f) => `${f.label} ${f.bits} bits`).join(', ')}
      >
        {fields.map((f) =>
          f.bits > 0 ? (
            <div
              key={f.label}
              className="grid place-items-center border-r-2 border-ink text-xs font-bold text-white last:border-r-0"
              style={{ width: `${(f.bits / 64) * 100}%`, background: f.color }}
            >
              {f.bits >= 4 ? `${f.label} ${f.bits}` : f.bits}
            </div>
          ) : null,
        )}
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {slider('Timestamp', ts, 30, 50, (v) => setTs(Math.min(v, 63 - machine)), 'var(--color-read)')}
        {slider('Machine ID', machine, 2, 20, (v) => setMachine(Math.min(v, 63 - ts)), 'var(--color-ryw)')}
        <p className="text-sm">
          <span className="font-semibold text-write">Sequence</span> gets what’s left: <b>{Math.max(seq, 0)} bits</b>
        </p>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {checks.map((c) => (
          <li key={c.text} className={`rounded-lg px-3 py-2 text-sm font-semibold ${c.ok ? 'bg-ok/15 text-ok' : 'bg-bad/15 text-bad'}`}>
            {c.ok ? '✓' : '✗'} {c.text}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          setTs(41)
          setMachine(10)
        }}
        className="mt-3 rounded-lg border-2 border-ink bg-piece px-3 py-1 text-sm font-semibold hover:bg-board"
      >
        Show Snowflake’s split
      </button>
    </Figure>
  )
}
