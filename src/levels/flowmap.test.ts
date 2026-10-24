import { describe, expect, it } from 'vitest'
import { chapter8 } from './chapter8'
import { flowMap, pieceName, wireLabels } from '../engine/flowmap'
import { initSim } from '../engine/simulator'
import { graph } from '../engine/test-helpers'

const ch = chapter8.chapter
const sf = { idScheme: 'snowflake', idClock: 'wait' } as const

describe('flow map', () => {
  it('splits a design into a read path and a write path, with names, steps and endpoints', () => {
    const g = graph(
      [
        ['u', 'traffic'],
        ['lb', 'lb'],
        ['r', 'app', 3],
        ['w', 'app', 2],
        ['c', 'cache'],
        ['db', 'sqldb'],
        ['g', 'idgen', 2, sf],
      ],
      ['u>lb', 'lb>r', 'lb>w', 'r>c', 'c>db', 'w>g', 'g>db'],
    )
    const s = initSim(g, ch, 0)
    const map = flowMap(s)
    const node = (id: string) => g.nodes.find((n) => n.id === id)!
    expect(pieceName(node('r'), map.pieces.r, ch)).toBe('Read service')
    expect(pieceName(node('w'), map.pieces.w, ch)).toBe('Write service')
    expect(wireLabels(map.wires['lb>r'], ch)).toEqual(['GET /{code}'])
    expect(wireLabels(map.wires['lb>w'], ch)).toEqual(['POST /urls'])
    expect(map.pieces.lb!.does).toEqual(['spreads requests across servers'])
    expect(map.pieces.c!.does.length).toBeGreaterThan(0)
    expect(map.pieces.g!.does).toEqual([ch.requestTypes[1]!.does!.id])
  })

  it('one server doing both jobs gets the general name', () => {
    const g = graph(
      [
        ['u', 'traffic'],
        ['lb', 'lb'],
        ['web', 'app', 9],
        ['c', 'cache'],
        ['db', 'sqldb'],
        ['g', 'idgen', 2, sf],
      ],
      ['u>lb', 'lb>web', 'web>c', 'c>db', 'web>g', 'g>db'],
    )
    const map = flowMap(initSim(g, ch, 0))
    expect(pieceName(g.nodes[2]!, map.pieces.web, ch)).toBe('API service')
    expect(wireLabels(map.wires['u>lb'], ch)).toEqual(['GET /{code}', 'POST /urls'])
  })
})
