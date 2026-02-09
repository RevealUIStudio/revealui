import { describe, expectTypeOf, it } from 'vitest'
import type {
  EditorAdapter,
  EditorCapabilities,
  EditorCommand,
  EditorCommandResult,
  EditorEvent,
  EditorInfo,
} from '../index.js'

describe('editor-sdk types', () => {
  it('EditorCommand is a discriminated union on type', () => {
    expectTypeOf<EditorCommand>().toMatchTypeOf<{ type: string }>()
  })

  it('EditorCommandResult has required fields', () => {
    expectTypeOf<EditorCommandResult>().toHaveProperty('success')
    expectTypeOf<EditorCommandResult>().toHaveProperty('command')
  })

  it('EditorEvent is a discriminated union on type', () => {
    expectTypeOf<EditorEvent>().toMatchTypeOf<{ type: string }>()
  })

  it('EditorInfo has id, name, and capabilities', () => {
    expectTypeOf<EditorInfo>().toHaveProperty('id')
    expectTypeOf<EditorInfo>().toHaveProperty('name')
    expectTypeOf<EditorInfo>().toHaveProperty('capabilities')
  })

  it('EditorCapabilities has all boolean fields', () => {
    expectTypeOf<EditorCapabilities>().toMatchTypeOf<{
      openProject: boolean
      openFile: boolean
      jumpToLine: boolean
      applyConfig: boolean
      installExtension: boolean
      getRunningInstances: boolean
    }>()
  })

  it('EditorAdapter has required methods', () => {
    expectTypeOf<EditorAdapter>().toHaveProperty('id')
    expectTypeOf<EditorAdapter>().toHaveProperty('name')
    expectTypeOf<EditorAdapter>().toHaveProperty('getCapabilities')
    expectTypeOf<EditorAdapter>().toHaveProperty('execute')
    expectTypeOf<EditorAdapter>().toHaveProperty('isAvailable')
    expectTypeOf<EditorAdapter>().toHaveProperty('onEvent')
    expectTypeOf<EditorAdapter>().toHaveProperty('dispose')
  })
})
