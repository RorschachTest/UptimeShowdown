import { COMPONENTS } from '../engine/components'
import { useGameStore } from '../store'
import { ComponentIcon } from './icons'
import { COMPONENT_INFO, TYPE_COLORS, unlockedKinds } from './settings'

export const DRAG_MIME = 'application/x-uptime-component'

export function Palette() {
  const chapter = useGameStore((s) => s.chapter)
  const stageIndex = useGameStore((s) => s.stageIndex)
  const kinds = unlockedKinds(chapter, stageIndex)
  const fresh = new Set(chapter.stages[stageIndex]!.unlocks.kinds)

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r-2 border-ink bg-panel p-4">
      <section>
        <h2 className="text-lg font-bold">Components</h2>
        <p className="mt-0.5 text-sm text-ink-soft">Drag one onto the board.</p>
        <ul className="mt-3 flex flex-col gap-3">
          {kinds.map((kind) => (
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
                <span className="font-semibold whitespace-nowrap">{COMPONENTS[kind].label}</span>
                {fresh.has(kind) && stageIndex > 0 && (
                  <span className="ml-auto rounded-md bg-read px-1.5 text-xs font-semibold text-piece">New</span>
                )}
              </div>
              <p className="mt-1 text-xs text-ink-soft">{COMPONENT_INFO[kind].blurb}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="text-sm leading-snug text-ink-soft">
        <h2 className="text-base font-bold text-ink">Controls</h2>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4">
          <li>Click a piece to open its settings.</li>
          <li>Pull a wire from the dot on the right of a piece to the dot on the left of another.</li>
          <li>Scroll over a web server or database to scale it out.</li>
          <li>Right-click a wire to remove it.</li>
          <li>Drag a piece onto the bin to remove it.</li>
        </ul>
      </section>

      <section className="mt-auto text-xs leading-snug text-ink-soft">
        <p>
          Dots on wires: <span className="font-semibold" style={{ color: TYPE_COLORS.page }}>page views</span>,{' '}
          <span className="font-semibold" style={{ color: TYPE_COLORS.write }}>new posts</span>,{' '}
          <span className="font-semibold" style={{ color: TYPE_COLORS.ryw }}>own posts</span>,{' '}
          <span className="font-semibold" style={{ color: TYPE_COLORS.static }}>images &amp; JS</span>. Pieces turn amber at 70% load and red when
          overloaded.
        </p>
      </section>
    </aside>
  )
}
