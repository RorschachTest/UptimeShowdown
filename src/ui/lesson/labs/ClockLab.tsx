import { useState } from 'react'
import { Figure } from '../Visual'

/** What the server's wall clock reads at each moment we ask it for an ID. NTP steps it back by 2 ms after 103. */
const WALL = [100, 101, 102, 103, 101, 102, 103, 104, 105]

type Cell = {
  wall: number
  issued: number | null
  dup: boolean
  waiting: boolean
}

function run(wait: boolean): Cell[] {
  let last = -1
  const used = new Set<number>()
  return WALL.map((wall) => {
    if (wait && wall <= last) return { wall, issued: null, dup: false, waiting: true }
    const dup = used.has(wall)
    used.add(wall)
    last = Math.max(last, wall)
    return { wall, issued: wall, dup, waiting: false }
  })
}

/** Clock lab: a clock steps backwards mid-stream; compare trusting it with waiting it out. */
export function ClockLab() {
  const [wait, setWait] = useState(false)
  const cells = run(wait)
  const dups = cells.filter((c) => c.dup).length

  return (
    <Figure
      lab
      caption="Each box is one moment the server issues an ID, using the millisecond on its wall clock (sequence starts at 0 each new millisecond). After 103 ms, time sync pulls the clock back to 101."
    >
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="When the clock goes back">
        {(
          [
            [false, 'Keep going'],
            [true, 'Wait it out'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={wait === v}
            onClick={() => setWait(v)}
            className={`rounded-lg border-2 px-2.5 py-1 text-sm font-semibold ${wait === v ? 'border-ink bg-ink text-piece' : 'border-ink/25 bg-piece hover:border-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="border-separate border-spacing-1 text-center text-xs">
          <tbody>
            <tr>
              <th className="pr-2 text-left font-semibold text-ink-soft">Wall clock</th>
              {cells.map((c, i) => (
                <td key={i} className={`h-9 w-12 rounded-md font-bold ${i === 4 ? 'bg-warn/30' : 'bg-board'}`}>
                  {c.wall}
                  {i === 4 && <span className="block text-[10px] font-semibold text-ink-soft">↶ jumped</span>}
                </td>
              ))}
            </tr>
            <tr>
              <th className="pr-2 text-left font-semibold text-ink-soft">ID timestamp</th>
              {cells.map((c, i) => (
                <td
                  key={i}
                  className={`h-9 w-12 rounded-md font-bold ${c.waiting ? 'bg-warn/25 text-ink-soft' : c.dup ? 'bg-bad text-white' : 'bg-ok/20 text-ok'}`}
                >
                  {c.waiting ? 'wait' : c.issued}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${dups > 0 ? 'bg-bad/15 text-bad' : 'bg-ok/15 text-ok'}`}>
        {dups > 0
          ? `${dups} IDs reuse a millisecond already used (red): with the same machine ID and the sequence back at 0, they are exact duplicates of IDs already handed out.`
          : 'The server remembers the last millisecond it used and refuses to issue until the clock passes it: a 3 ms pause, and no duplicates.'}
      </p>
    </Figure>
  )
}
