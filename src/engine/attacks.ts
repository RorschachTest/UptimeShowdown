import type { SimState } from './types'

// Phase 2 (M4): attack cards. Stub so the engine API shape is fixed early.

export type AttackCardId =
  | 'traffic-spike'
  | 'server-crash'
  | 'az-outage'
  | 'ddos'
  | 'slow-db'
  | 'network-partition'
  | 'cache-stampede'
  | 'poison-message'

export interface AttackCard {
  id: AttackCardId
  cost: number
  targetNodeId?: string
}

export function applyAttack(state: SimState, _card: AttackCard): SimState {
  return state
}
