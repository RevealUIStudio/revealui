import { vi } from 'vitest'

interface ShapeData {
  data: unknown[]
  isLoading: boolean
  error: Error | null
}

const shapeSubscriptions = new Map<string, ShapeData>()

export function mockUseShape(options: { url: string; params: Record<string, string> }) {
  const key = `${options.url}:${JSON.stringify(options.params)}`

  if (!shapeSubscriptions.has(key)) {
    shapeSubscriptions.set(key, { data: [], isLoading: true, error: null })
  }

  return shapeSubscriptions.get(key)!
}

export function simulateShapeUpdate(
  url: string,
  params: Record<string, string>,
  data: unknown[],
): void {
  const key = `${url}:${JSON.stringify(params)}`
  shapeSubscriptions.set(key, { data, isLoading: false, error: null })
}

export function simulateShapeError(
  url: string,
  params: Record<string, string>,
  error: Error,
): void {
  const key = `${url}:${JSON.stringify(params)}`
  shapeSubscriptions.set(key, { data: [], isLoading: false, error })
}

export function clearMockShapes(): void {
  shapeSubscriptions.clear()
}
