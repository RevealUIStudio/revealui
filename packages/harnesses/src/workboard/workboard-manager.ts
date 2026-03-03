import { readFileSync, writeFileSync } from 'node:fs'
import type {
  ConflictResult,
  WorkboardEntry,
  WorkboardSession,
  WorkboardState,
} from './workboard-protocol.js'

const STALE_THRESHOLD_MS = 4 * 60 * 60 * 1000 // 4 hours

/**
 * WorkboardManager — reads, parses, and writes .claude/workboard.md.
 *
 * The workboard is a markdown file with a specific structure:
 *   ## Sessions  — markdown table
 *   ## Plans     — freeform markdown
 *   ## Recent    — bullet list
 *   ## Context   — freeform markdown
 *   ## Plan Reference — freeform markdown
 *
 * This class provides programmatic access to the Sessions table and Recent list.
 * Plans, Context, and Plan Reference are treated as opaque strings.
 */
export class WorkboardManager {
  constructor(private readonly workboardPath: string) {}

  /** Read and parse the workboard. */
  read(): WorkboardState {
    let content: string
    try {
      content = readFileSync(this.workboardPath, 'utf8')
    } catch {
      return { sessions: [], recent: [], plans: '', context: '', planReference: '' }
    }
    return parseWorkboard(content)
  }

  /** Write a workboard state back to disk. */
  write(state: WorkboardState): void {
    writeFileSync(this.workboardPath, serializeWorkboard(state), 'utf8')
  }

  /** Register a new session, replacing any existing row with the same id. */
  registerSession(session: WorkboardSession): void {
    const state = this.read()
    const existing = state.sessions.findIndex((s) => s.id === session.id)
    if (existing >= 0) {
      state.sessions[existing] = session
    } else {
      state.sessions.push(session)
    }
    this.write(state)
  }

  /** Remove a session row by id. */
  unregisterSession(id: string): void {
    const state = this.read()
    state.sessions = state.sessions.filter((s) => s.id !== id)
    this.write(state)
  }

  /** Update specific fields of an existing session row. */
  updateSession(id: string, updates: Partial<WorkboardSession>): void {
    const state = this.read()
    const idx = state.sessions.findIndex((s) => s.id === id)
    if (idx < 0) return
    const current = state.sessions[idx]
    if (!current) return
    state.sessions[idx] = { ...current, ...updates }
    this.write(state)
  }

  /** Update a session's files list and timestamp. */
  claimFiles(id: string, files: string[]): void {
    this.updateSession(id, {
      files: files.join(', '),
      updated: `${new Date().toISOString().slice(0, 16)}Z`,
    })
  }

  /** Clear a session's file reservations. */
  releaseFiles(id: string): void {
    this.updateSession(id, {
      files: '',
      updated: `${new Date().toISOString().slice(0, 16)}Z`,
    })
  }

  /** Prepend a timestamped entry to the ## Recent section (keeps last 20). */
  addRecentEntry(entry: WorkboardEntry): void {
    const state = this.read()
    const formatted = `[${entry.timestamp}] ${entry.sessionId}: ${entry.description}`
    state.recent.unshift({ ...entry })
    if (state.recent.length > 20) state.recent.splice(20)
    // Also reformat for serialization
    void formatted
    this.write(state)
  }

  /** Returns sessions whose `updated` timestamp is older than 4 hours. */
  detectStale(): WorkboardSession[] {
    const state = this.read()
    const now = Date.now()
    return state.sessions.filter((s) => {
      try {
        return now - new Date(s.updated).getTime() > STALE_THRESHOLD_MS
      } catch {
        return false
      }
    })
  }

  /**
   * Check whether the given files conflict with any other active session's reservations.
   * Returns a ConflictResult describing any overlaps found.
   */
  checkConflicts(mySessionId: string, files: string[]): ConflictResult {
    const state = this.read()
    const conflicts: ConflictResult['conflicts'] = []

    for (const session of state.sessions) {
      if (session.id === mySessionId) continue
      const theirFiles = session.files
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean)

      const overlapping = files.filter((myFile) =>
        theirFiles.some(
          (theirFile) =>
            myFile === theirFile ||
            myFile.startsWith(theirFile.replace('**', '')) ||
            theirFile.startsWith(myFile.replace('**', '')),
        ),
      )

      if (overlapping.length > 0) {
        conflicts.push({
          thisSession: mySessionId,
          otherSession: session.id,
          overlappingFiles: overlapping,
        })
      }
    }

    return { clean: conflicts.length === 0, conflicts }
  }
}

// ---------------------------------------------------------------------------
// Internal parser / serializer
// ---------------------------------------------------------------------------

function parseWorkboard(content: string): WorkboardState {
  const state: WorkboardState = {
    sessions: [],
    recent: [],
    plans: '',
    context: '',
    planReference: '',
  }

  // Split into top-level sections at ## headings.
  const sectionRe = /^## (.+)$/gm
  const sections: Array<{ title: string; start: number }> = []
  for (const m of content.matchAll(sectionRe)) {
    sections.push({ title: (m[1] ?? '').trim(), start: m.index })
  }

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    if (!section) continue
    const { title, start } = section
    const nextSection = sections[i + 1]
    const end = nextSection !== undefined ? nextSection.start : content.length
    const body = content.slice(start, end)

    if (title === 'Sessions') {
      state.sessions = parseSessionsTable(body)
    } else if (title === 'Recent') {
      state.recent = parseRecentList(body)
    } else if (title === 'Plans') {
      state.plans = body.replace(/^## Plans\n/, '')
    } else if (title === 'Context') {
      state.context = body.replace(/^## Context\n/, '')
    } else if (title === 'Plan Reference') {
      state.planReference = body.replace(/^## Plan Reference\n/, '')
    }
  }

  return state
}

function parseSessionsTable(section: string): WorkboardSession[] {
  const sessions: WorkboardSession[] = []
  const lines = section.split('\n')
  for (const line of lines) {
    if (!line.startsWith('|')) continue
    const parts = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim())
    if (parts.length < 6) continue
    // Skip header and separator rows
    if (parts[0] === 'id' || /^-+$/.test(parts[0] ?? '')) continue
    sessions.push({
      id: parts[0] ?? '',
      env: parts[1] ?? '',
      started: parts[2] ?? '',
      task: parts[3] ?? '',
      files: parts[4] ?? '',
      updated: parts[5] ?? '',
    })
  }
  return sessions
}

function parseRecentList(section: string): WorkboardEntry[] {
  const entries: WorkboardEntry[] = []
  const lineRe = /^- \[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\] ([\w-]+): (.+)$/
  for (const line of section.split('\n')) {
    const m = lineRe.exec(line)
    if (!m) continue
    entries.push({ timestamp: m[1] ?? '', sessionId: m[2] ?? '', description: m[3] ?? '' })
  }
  return entries
}

function serializeWorkboard(state: WorkboardState): string {
  const lines: string[] = ['# Workboard', '']

  // Sessions table
  lines.push('## Sessions', '')
  lines.push('| id  | env | started | task | files | updated |')
  lines.push('| --- | --- | ------- | ---- | ----- | ------- |')
  for (const s of state.sessions) {
    lines.push(`| ${s.id} | ${s.env} | ${s.started} | ${s.task} | ${s.files} | ${s.updated} |`)
  }
  lines.push('')

  // Plans
  lines.push('## Plans')
  lines.push(state.plans.trimEnd())
  lines.push('')

  // Recent
  lines.push('## Recent', '')
  for (const e of state.recent) {
    lines.push(`- [${e.timestamp}] ${e.sessionId}: ${e.description}`)
  }
  lines.push('')

  // Context
  lines.push('## Context')
  lines.push(state.context.trimEnd())
  lines.push('')

  // Plan Reference
  lines.push('## Plan Reference')
  lines.push(state.planReference.trimEnd())
  lines.push('')

  return lines.join('\n')
}
