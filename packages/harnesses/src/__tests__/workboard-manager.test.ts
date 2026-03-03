import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WorkboardManager } from '../workboard/workboard-manager.js'

const FIXTURE = `# Workboard

## Sessions

| id  | env | started | task | files | updated |
| --- | --- | ------- | ---- | ----- | ------- |
| terminal-1 | WSL/bash | 2026-03-03T14:00Z | Phase 2.7 | apps/api/** | 2026-03-03T14:00Z |
| zed-1 | Zed/ACP | 2026-03-03T15:00Z | Phase 2.6 | packages/harnesses/** | 2026-03-03T15:00Z |

## Plans

### terminal-1: some plan

## Recent

- [2026-03-03 14:00] terminal-1: did something useful
- [2026-03-03 13:00] zed-1: earlier work

## Context

some context here

## Plan Reference

- MASTER_PLAN.md last updated: 2026-03-03
`

describe('WorkboardManager', () => {
  let workboardPath: string
  let manager: WorkboardManager

  beforeEach(() => {
    workboardPath = join(tmpdir(), `workboard-test-${Date.now()}.md`)
    writeFileSync(workboardPath, FIXTURE, 'utf8')
    manager = new WorkboardManager(workboardPath)
  })

  afterEach(() => {
    try {
      require('node:fs').unlinkSync(workboardPath)
    } catch {}
  })

  it('parses sessions from the table', () => {
    const state = manager.read()
    expect(state.sessions).toHaveLength(2)
    expect(state.sessions[0].id).toBe('terminal-1')
    expect(state.sessions[1].id).toBe('zed-1')
  })

  it('parses recent entries', () => {
    const state = manager.read()
    expect(state.recent).toHaveLength(2)
    expect(state.recent[0].sessionId).toBe('terminal-1')
    expect(state.recent[0].description).toBe('did something useful')
  })

  it('registerSession adds a new row', () => {
    manager.registerSession({
      id: 'cursor-1',
      env: 'Cursor',
      started: '2026-03-03T16:00Z',
      task: 'Phase 2.3',
      files: '',
      updated: '2026-03-03T16:00Z',
    })
    const state = manager.read()
    expect(state.sessions.find((s) => s.id === 'cursor-1')).toBeDefined()
  })

  it('registerSession replaces an existing row', () => {
    manager.registerSession({
      id: 'terminal-1',
      env: 'WSL/bash',
      started: '2026-03-03T14:00Z',
      task: 'updated task',
      files: 'apps/cms/**',
      updated: '2026-03-03T17:00Z',
    })
    const state = manager.read()
    const row = state.sessions.find((s) => s.id === 'terminal-1')
    expect(row?.task).toBe('updated task')
    expect(state.sessions).toHaveLength(2) // no duplicates
  })

  it('unregisterSession removes the row', () => {
    manager.unregisterSession('zed-1')
    const state = manager.read()
    expect(state.sessions.find((s) => s.id === 'zed-1')).toBeUndefined()
    expect(state.sessions).toHaveLength(1)
  })

  it('updateSession updates specific fields', () => {
    manager.updateSession('terminal-1', { task: 'new task', files: 'apps/api/src/**' })
    const state = manager.read()
    const row = state.sessions.find((s) => s.id === 'terminal-1')
    expect(row?.task).toBe('new task')
    expect(row?.files).toBe('apps/api/src/**')
  })

  it('addRecentEntry prepends to Recent list', () => {
    manager.addRecentEntry({
      timestamp: '2026-03-03 18:00',
      sessionId: 'zed-1',
      description: 'new entry',
    })
    const state = manager.read()
    expect(state.recent[0].description).toBe('new entry')
    expect(state.recent[0].sessionId).toBe('zed-1')
  })

  it('detectStale returns sessions older than 4h', () => {
    // Force a very old timestamp
    manager.updateSession('terminal-1', { updated: '2020-01-01T00:00Z' })
    const stale = manager.detectStale()
    expect(stale.find((s) => s.id === 'terminal-1')).toBeDefined()
    expect(stale.find((s) => s.id === 'zed-1')).toBeUndefined()
  })

  it('checkConflicts detects file overlap', () => {
    const result = manager.checkConflicts('zed-1', ['apps/api/src/routes/billing.ts'])
    // terminal-1 owns apps/api/**  — this should overlap
    expect(result.clean).toBe(false)
    expect(result.conflicts[0].otherSession).toBe('terminal-1')
  })

  it('checkConflicts returns clean when no overlap', () => {
    const result = manager.checkConflicts('zed-1', ['packages/harnesses/src/new-file.ts'])
    expect(result.clean).toBe(true)
  })
})
