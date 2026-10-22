import { COMPONENTS } from '../engine/components'
import type { ComponentKind } from '../engine/types'
import { fmtInt } from './format'
import { ComponentIcon } from './icons'

export const DRAG_MIME = 'application/x-uptime-component'

const AVAILABLE: ComponentKind[] = ['app', 'sqldb']

function capacityText(kind: ComponentKind): string {
  const { capacityRps, maxInstances } = COMPONENTS[kind]
  const per = maxInstances > 1 ? ' per instance' : ''
  if (capacityRps.read === capacityRps.write) return `${fmtInt(capacityRps.read)} rps${per}`
  return `${fmtInt(capacityRps.read)} reads/s, ${fmtInt(capacityRps.write)} writes/s`
}

export function Palette() {
  return (
    <aside className="flex w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r-2 border-ink bg-panel p-4">
      <section>
        <h2 className="text-lg font-bold">Components</h2>
        <p className="mt-0.5 text-sm text-ink-soft">Drag one onto the board.</p>
        <ul className="mt-3 flex flex-col gap-3">
          {AVAILABLE.map((kind) => {
            const spec = COMPONENTS[kind]
            return (
              <li
                key={kind}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_MIME, kind)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                className="piece cursor-grab px-3 py-2.5 transition-transform select-none hover:-translate-y-0.5 active:cursor-grabbing"
              >
                <div className="flex items-center gap-2">
                  <ComponentIcon kind={kind} />
                  <span className="font-semibold">{spec.label}</span>
                </div>
                <p className="mt-1 text-xs text-ink-soft">{capacityText(kind)}</p>
                <p className="text-xs text-ink-soft">
                  {spec.costPerMin}/min{spec.maxInstances > 1 ? ' each' : ''}
                </p>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="text-sm leading-snug text-ink-soft">
        <h2 className="text-base font-bold text-ink">Controls</h2>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4">
          <li>Pull a wire from the dot on the right of a piece to the dot on the left of another.</li>
          <li>Scroll over an App Server to add or remove instances.</li>
          <li>Right-click a wire to remove it.</li>
          <li>Drag a piece onto the bin to remove it.</li>
        </ul>
      </section>

      <section className="mt-auto text-xs leading-snug text-ink-soft">
        <p>
          Wire colours: <span className="font-semibold text-read">reads</span> and{' '}
          <span className="font-semibold text-write">writes</span>. Pieces turn amber at 70% load and red when
          overloaded.
        </p>
      </section>
    </aside>
  )
}
