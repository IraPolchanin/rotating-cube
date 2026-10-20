export interface Orientation {
  readonly rx: number
  readonly ry: number
  readonly rz: number
}

export const INITIAL_ORIENTATION: Orientation = { rx: 25, ry: -45, rz: 0 }

/** Degrees of rotation per pixel of pointer movement (spec A-6). */
export const SENSITIVITY = 0.5

const MAX_X = 90

/** Clamps X rotation to the closed range [-90, 90]. */
export function clampX(degrees: number): number {
  return Math.min(MAX_X, Math.max(-MAX_X, degrees))
}

/** Normalises Y rotation to the half-open range (-180, 180]. */
export function normaliseY(degrees: number): number {
  const wrapped = ((degrees % 360) + 360) % 360
  return wrapped > 180 ? wrapped - 360 : wrapped
}

/**
 * Horizontal movement (dx) rotates around Y, vertical movement (dy) around X.
 * Z is never affected by user interaction.
 */
export function applyDrag(orientation: Orientation, dx: number, dy: number): Orientation {
  return {
    rx: clampX(orientation.rx + dy * SENSITIVITY),
    ry: normaliseY(orientation.ry + dx * SENSITIVITY),
    rz: 0,
  }
}

export function resetOrientation(): Orientation {
  return { ...INITIAL_ORIENTATION }
}

/** Formats degrees with one decimal place, never producing "-0.0". */
export function formatDegrees(degrees: number): string {
  const rounded = Math.round(degrees * 10) / 10
  return rounded === 0 ? '0.0' : rounded.toFixed(1)
}
