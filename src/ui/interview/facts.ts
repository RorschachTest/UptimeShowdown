import type { FactId } from '../../engine/types'
import { useGameStore } from '../../store'

export const FACT_LABELS: Record<FactId, string> = {
  scale: 'Traffic',
  mix: 'Mix',
  geography: 'Users',
  freshness: 'Freshness',
  failures: 'Failures',
  latency: 'Speed',
  abuse: 'Abusers',
  clients: 'Real users',
  growth: 'Growth',
  data: 'Data',
  conflicts: 'Conflicts',
  ordering: 'Ordering',
}

/** The revealed short answer for a fact, or null while it's still unknown. */
export function useFact(id: FactId): string | null {
  return useGameStore((s) => {
    const iv = s.interview
    if (!iv) return ''
    const q = iv.level.questions.find((c) => c.reveals.includes(id) && iv.asked.includes(c.id))
    return q ? (q.short ?? q.answer) : null
  })
}

/** Facts are visible outside interviews, once asked, or once the run lets the player observe them. */
export function useFactVisible(id: FactId): boolean {
  const fact = useFact(id)
  const observed = useGameStore((s) => s.sim.tick > 0 || s.interview?.phase === 'done')
  return fact !== null || observed
}
