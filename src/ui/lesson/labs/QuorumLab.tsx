import { useState } from 'react'
import { Figure } from '../Visual'

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-28 font-semibold">{label}</span>
      <button
        type="button"
        aria-label={`Less ${label}`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="size-7 rounded-md border-2 border-ink bg-piece font-bold disabled:opacity-30"
      >
        −
      </button>
      <span className="w-6 text-center text-base font-extrabold tabular-nums">{value}</span>
      <button
        type="button"
        aria-label={`More ${label}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="size-7 rounded-md border-2 border-ink bg-piece font-bold disabled:opacity-30"
      >
        +
      </button>
    </div>
  )
}

/** Quorum lab: pick N, W, R and how many copies are cut off; see whether reads meet writes and what still works. */
export function QuorumLab() {
  const [n, setN] = useState(3)
  const [w, setW] = useState(1)
  const [r, setR] = useState(1)
  const [cut, setCut] = useState(0)
  const clamp = (v: number, hi: number) => Math.min(v, hi)
  const setCopies = (v: number) => {
    setN(v)
    setW((x) => clamp(x, v))
    setR((x) => clamp(x, v))
    setCut((x) => clamp(x, v - 1))
  }
  // Worst case: the write lands on the first W copies, the read asks the last R.
  const writes = new Set(Array.from({ length: w }, (_, i) => i))
  const reads = new Set(Array.from({ length: r }, (_, i) => n - 1 - i))
  const overlap = r + w > n
  const writeOk = n - cut >= w
  const readOk = n - cut >= r

  return (
    <Figure
      lab
      caption="Orange copies took the latest write; blue copies answer a read. In the worst case they are as far apart as possible: only R + W > N forces them to share a copy (purple)."
    >
      <div className="flex flex-wrap gap-6">
        <div className="flex flex-col gap-2">
          <Stepper label="Copies (N)" value={n} min={1} max={5} onChange={setCopies} />
          <Stepper label="Write waits (W)" value={w} min={1} max={n} onChange={setW} />
          <Stepper label="Read waits (R)" value={r} min={1} max={n} onChange={setR} />
          <Stepper label="Cut off" value={cut} min={0} max={n - 1} onChange={setCut} />
        </div>
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex gap-2" role="img" aria-label={`${n} copies`}>
            {Array.from({ length: n }, (_, i) => {
              const down = i >= n - cut
              const both = writes.has(i) && reads.has(i)
              const bg = down
                ? 'var(--color-ink-faint)'
                : both
                  ? 'var(--color-ryw)'
                  : writes.has(i)
                    ? 'var(--color-write)'
                    : reads.has(i)
                      ? 'var(--color-read)'
                      : 'var(--color-piece)'
              return (
                <div
                  key={i}
                  className="grid h-16 w-14 place-items-center rounded-lg border-2 border-ink text-center text-xs font-bold"
                  style={{
                    background: bg,
                    color: down || both || writes.has(i) || reads.has(i) ? 'white' : undefined,
                  }}
                >
                  {down ? '✂ cut' : `copy ${i + 1}`}
                </div>
              )
            })}
          </div>
          <p className={`rounded-lg px-3 py-2 text-sm font-semibold ${overlap ? 'bg-ok/15 text-ok' : 'bg-bad/15 text-bad'}`}>
            R + W = {r + w} {overlap ? '>' : '≤'} N = {n}: {overlap ? 'every read meets the latest write.' : 'a read can miss the latest write (stale).'}
          </p>
          <p className="grid grid-cols-2 gap-2 text-sm font-semibold">
            <span className={`rounded-lg px-3 py-2 ${writeOk ? 'bg-ok/15 text-ok' : 'bg-bad/15 text-bad'}`}>Writes {writeOk ? 'still work' : 'fail'}</span>
            <span className={`rounded-lg px-3 py-2 ${readOk ? 'bg-ok/15 text-ok' : 'bg-bad/15 text-bad'}`}>Reads {readOk ? 'still work' : 'fail'}</span>
          </p>
        </div>
      </div>
    </Figure>
  )
}
