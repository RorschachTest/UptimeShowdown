import { useEffect } from 'react'
import { TICK_MS } from '../engine/simulator'
import { useGameStore } from '../store'

/** Most steps run in one frame. Anything beyond (e.g. after a background tab) is skipped, not replayed. */
const MAX_STEPS_PER_FRAME = 8

/** Fixed-timestep loop: one engine step per 100 ms of game time, at the chosen speed. */
export function useGameLoop() {
  const running = useGameStore((s) => s.running)
  const speed = useGameStore((s) => s.speed)
  const advance = useGameStore((s) => s.advance)

  useEffect(() => {
    if (!running) return
    let frame = 0
    let last = performance.now()
    let carry = 0

    const loop = (now: number) => {
      carry += (now - last) * speed
      last = now
      const steps = Math.min(Math.floor(carry / TICK_MS), MAX_STEPS_PER_FRAME)
      carry = steps === MAX_STEPS_PER_FRAME ? 0 : carry - steps * TICK_MS
      if (steps > 0) advance(steps)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [running, speed, advance])
}
