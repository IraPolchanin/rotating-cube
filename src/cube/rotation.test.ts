import { describe, it, expect } from 'vitest'
import {
  INITIAL_ORIENTATION,
  SENSITIVITY,
  applyDrag,
  clampX,
  formatDegrees,
  normaliseY,
  resetOrientation,
} from './rotation'

const ORIGIN = { rx: 0, ry: 0, rz: 0 }

describe('constants', () => {
  it('AC-3: INITIAL_ORIENTATION is 25 / -45 / 0', () => {
    expect(INITIAL_ORIENTATION).toEqual({ rx: 25, ry: -45, rz: 0 })
  })

  it('A-6: SENSITIVITY is 0.5 deg/px', () => {
    expect(SENSITIVITY).toBe(0.5)
  })
})

describe('formatDegrees', () => {
  it('AC-3: renders exactly one decimal place', () => {
    expect(formatDegrees(25)).toBe('25.0')
    expect(formatDegrees(-45)).toBe('-45.0')
    expect(formatDegrees(12.34)).toBe('12.3')
    expect(formatDegrees(12.36)).toBe('12.4')
  })

  it('AC-3: never renders "-0.0"', () => {
    expect(formatDegrees(0)).toBe('0.0')
    expect(formatDegrees(-0)).toBe('0.0')
    expect(formatDegrees(-0.04)).toBe('0.0')
  })
})

describe('applyDrag', () => {
  it('AC-4: horizontal delta changes ry by dx * SENSITIVITY', () => {
    const result = applyDrag(ORIGIN, 50, 0)
    expect(result.ry).toBeCloseTo(50 * SENSITIVITY, 10)
    expect(result.rx).toBe(0)
  })

  it('AC-5: vertical delta changes rx by dy * SENSITIVITY', () => {
    const result = applyDrag(ORIGIN, 0, 50)
    expect(result.rx).toBeCloseTo(50 * SENSITIVITY, 10)
    expect(result.ry).toBe(0)
  })

  it('AC-4: 100 px rotates 2x of 50 px within 5%', () => {
    const half = applyDrag(ORIGIN, 50, 0).ry
    const full = applyDrag(ORIGIN, 100, 0).ry
    expect(Math.abs(full / half - 2)).toBeLessThanOrEqual(0.05)
  })

  it('AC-5: 100 px rotates 2x of 50 px within 5%', () => {
    const half = applyDrag(ORIGIN, 0, 50).rx
    const full = applyDrag(ORIGIN, 0, 100).rx
    expect(Math.abs(full / half - 2)).toBeLessThanOrEqual(0.05)
  })

  it('AC-6: positive dx increases ry and zero delta changes nothing', () => {
    expect(applyDrag(ORIGIN, 10, 0).ry).toBeGreaterThan(0)
    expect(applyDrag(INITIAL_ORIENTATION, 0, 0)).toEqual(INITIAL_ORIENTATION)
  })

  it('AC-7: positive dy increases rx and rz stays 0', () => {
    expect(applyDrag(ORIGIN, 0, 10).rx).toBeGreaterThan(0)
    expect(applyDrag(INITIAL_ORIENTATION, 123, -456).rz).toBe(0)
  })

  it('AC-12: a very large vertical delta ends clamped to the range', () => {
    expect(applyDrag(ORIGIN, 0, 2000).rx).toBe(90)
    expect(applyDrag(ORIGIN, 0, -2000).rx).toBe(-90)
  })

  it('AC-4: a drag past 180 degrees wraps ry through normaliseY', () => {
    expect(applyDrag({ rx: 0, ry: 170, rz: 0 }, 40, 0).ry).toBe(-170)
    expect(applyDrag({ rx: 0, ry: -170, rz: 0 }, -40, 0).ry).toBe(170)
  })

  it('AC-12: reversing the drag leaves the clamp immediately', () => {
    const atLimit = applyDrag(ORIGIN, 0, 2000)
    expect(atLimit.rx).toBe(90)
    expect(applyDrag(atLimit, 0, -20).rx).toBe(80)
  })

  it('AC-4: does not mutate the input orientation', () => {
    const input = { rx: 1, ry: 2, rz: 0 }
    applyDrag(input, 40, 40)
    expect(input).toEqual({ rx: 1, ry: 2, rz: 0 })
  })
})

describe('clampX', () => {
  it('AC-12: keeps values inside [-90, 90] unchanged, boundaries included', () => {
    expect(clampX(0)).toBe(0)
    expect(clampX(90)).toBe(90)
    expect(clampX(-90)).toBe(-90)
    expect(clampX(33.3)).toBe(33.3)
  })

  it('AC-12: clamps values outside the range to the boundary', () => {
    expect(clampX(90.1)).toBe(90)
    expect(clampX(500)).toBe(90)
    expect(clampX(-90.1)).toBe(-90)
    expect(clampX(-500)).toBe(-90)
  })
})

describe('normaliseY', () => {
  it('AC-4: normalises to the half-open range (-180, 180]', () => {
    expect(normaliseY(180)).toBe(180)
    expect(normaliseY(-180)).toBe(180)
    expect(normaliseY(190)).toBe(-170)
    expect(normaliseY(-190)).toBe(170)
    expect(normaliseY(540)).toBe(180)
    expect(normaliseY(-540)).toBe(180)
    expect(normaliseY(0)).toBe(0)
    expect(normaliseY(-45)).toBe(-45)
  })
})

describe('resetOrientation', () => {
  it('AC-9: returns the exact initial values', () => {
    expect(resetOrientation()).toEqual({ rx: 25, ry: -45, rz: 0 })
  })

  it('AC-9: returns a fresh object so callers cannot corrupt the initial state', () => {
    const first = resetOrientation()
    expect(first).not.toBe(INITIAL_ORIENTATION)
    expect(resetOrientation()).toEqual(INITIAL_ORIENTATION)
  })
})
