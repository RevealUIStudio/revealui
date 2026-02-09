import { execFile } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { promisify } from 'node:util'
import type { EditorProcessInfo } from '@revealui/editor-sdk'

const execFileAsync = promisify(execFile)

/** Map of editor id → process name patterns to search for */
const EDITOR_PROCESS_PATTERNS: Record<string, string[]> = {
  zed: ['zed'],
  vscode: ['code'],
  neovim: ['nvim'],
}

/** Find running processes matching a name pattern using pgrep */
export async function findProcesses(pattern: string): Promise<{ pid: number; command: string }[]> {
  try {
    const { stdout } = await execFileAsync('pgrep', ['-a', pattern])
    return stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const spaceIdx = line.indexOf(' ')
        return {
          pid: Number.parseInt(line.substring(0, spaceIdx), 10),
          command: line.substring(spaceIdx + 1),
        }
      })
  } catch {
    // pgrep returns exit code 1 when no matches found
    return []
  }
}

/** Find running Neovim server sockets in common locations */
export async function findNeovimSockets(): Promise<string[]> {
  const dirs = ['/tmp', process.env.XDG_RUNTIME_DIR].filter(Boolean) as string[]

  const sockets: string[] = []
  for (const dir of dirs) {
    try {
      const entries = await readdir(dir)
      for (const entry of entries) {
        if (entry.startsWith('nvim') && entry.endsWith('.sock')) {
          sockets.push(`${dir}/${entry}`)
        }
      }
    } catch {
      // Directory may not exist or be unreadable
    }
  }
  return sockets
}

/** Find all running editor processes for a given editor id */
export async function findEditorProcesses(editorId: string): Promise<EditorProcessInfo[]> {
  const patterns = EDITOR_PROCESS_PATTERNS[editorId]
  if (!patterns) return []

  const results: EditorProcessInfo[] = []
  for (const pattern of patterns) {
    const processes = await findProcesses(pattern)
    for (const proc of processes) {
      results.push({ pid: proc.pid, command: proc.command, editorId })
    }
  }
  return results
}

/** Find all running editor processes across all known editors */
export async function findAllEditorProcesses(): Promise<EditorProcessInfo[]> {
  const allResults = await Promise.all(
    Object.keys(EDITOR_PROCESS_PATTERNS).map((id) => findEditorProcesses(id)),
  )
  return allResults.flat()
}
