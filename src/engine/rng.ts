// Seeded RNG (mulberry32). The state is a plain number stored in SimState so the sim stays
// deterministic and serialisable. M1 needs no randomness; attacks and jitter will use this.

export function nextRandom(state: number): [value: number, nextState: number] {
  const next = (state + 0x6d2b79f5) | 0
  let t = next
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next]
}
