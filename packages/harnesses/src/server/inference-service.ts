import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// ── Types ───────────────────────────────────────────────────────────

export interface OllamaStatus {
  installed: boolean;
  running: boolean;
  version: string | null;
}

export interface OllamaModel {
  name: string;
  size: string;
  modified: string;
}

export interface ModelPullResult {
  success: boolean;
  message: string;
}

export interface SnapStatus {
  installed: boolean;
  running: boolean;
  snapName: string;
  endpoint: string | null;
  version: string | null;
}

export interface SnapModel {
  name: string;
  description: string;
  installed: boolean;
}

// ── Configuration ───────────────────────────────────────────────────

const KNOWN_SNAPS: Array<[string, string]> = [
  ['nemotron-3-nano', 'General (reasoning + non-reasoning) — free tier default'],
  ['gemma3', 'General + vision — image understanding, multimodal'],
  ['deepseek-r1', 'Reasoning — complex analysis, chain-of-thought'],
  ['qwen-vl', 'Vision-language — document parsing, visual Q&A'],
];

// ── Helpers ─────────────────────────────────────────────────────────

async function commandExists(cmd: string): Promise<boolean> {
  try {
    await execFileAsync('which', [cmd]);
    return true;
  } catch {
    return false;
  }
}

async function run(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(cmd, args, { timeout: 30_000 });
}

// ── Service ─────────────────────────────────────────────────────────

/**
 * Manages local inference engines (Ollama, Snaps) on the daemon host.
 * Each method mirrors the equivalent Tauri command from `inference.rs`.
 */
export class InferenceService {
  // ── Ollama ──────────────────────────────────────────────────────

  async ollamaStatus(): Promise<OllamaStatus> {
    const installed = await commandExists('ollama');
    if (!installed) return { installed: false, running: false, version: null };

    let version: string | null = null;
    try {
      const { stdout } = await run('ollama', ['--version']);
      version = stdout.trim() || null;
    } catch {
      // version check failed — binary may exist but be broken
    }

    let running = false;
    try {
      await run('ollama', ['list']);
      running = true;
    } catch {
      // list fails when server isn't running
    }

    return { installed, running, version };
  }

  async ollamaModels(): Promise<OllamaModel[]> {
    const { stdout } = await run('ollama', ['list']);
    const models: OllamaModel[] = [];
    const lines = stdout.split('\n');

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;
      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        models.push({
          name: parts[0] ?? '',
          size: parts[2] ?? '',
          modified: parts.slice(3).join(' '),
        });
      }
    }

    return models;
  }

  async ollamaPull(modelName: string): Promise<ModelPullResult> {
    // Validate model name format (alphanumeric, colons, slashes, dots, hyphens)
    if (!/^[\w./:@-]+$/.test(modelName)) {
      return { success: false, message: `Invalid model name: ${modelName}` };
    }
    try {
      const { stdout, stderr } = await execFileAsync('ollama', ['pull', modelName], {
        timeout: 600_000, // 10 min for large models
      });
      return { success: true, message: stdout || stderr };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async ollamaDelete(modelName: string): Promise<void> {
    if (!/^[\w./:@-]+$/.test(modelName)) {
      throw new Error(`Invalid model name: ${modelName}`);
    }
    await run('ollama', ['rm', modelName]);
  }

  async ollamaStart(): Promise<void> {
    // Start in background (detached)
    const { spawn } = await import('node:child_process');
    const child = spawn('ollama', ['serve'], {
      stdio: 'ignore',
      detached: true,
    });
    child.unref();
  }

  async ollamaStop(): Promise<void> {
    try {
      await run('pkill', ['-f', 'ollama serve']);
    } catch {
      // pkill exit 1 = no processes matched — that's fine
    }
  }

  // ── Inference Snaps ─────────────────────────────────────────────

  async snapList(): Promise<SnapModel[]> {
    const results: SnapModel[] = [];
    for (const [name, description] of KNOWN_SNAPS) {
      let installed = false;
      try {
        await run('snap', ['list', name]);
        installed = true;
      } catch {
        // not installed
      }
      results.push({ name, description, installed });
    }
    return results;
  }

  async snapStatus(snapName: string): Promise<SnapStatus> {
    // Validate snap name against allowlist to prevent arbitrary command execution
    const known = KNOWN_SNAPS.some(([name]) => name === snapName);
    if (!known) throw new Error(`Unknown inference snap: ${snapName}`);

    let installed = false;
    let version: string | null = null;

    try {
      const { stdout } = await run('snap', ['list', snapName]);
      installed = true;
      // Second line, second column is the version
      const secondLine = stdout.split('\n')[1];
      if (secondLine) {
        version = secondLine.split(/\s+/)[1] ?? null;
      }
    } catch {
      return { installed: false, running: false, snapName, endpoint: null, version: null };
    }

    let running = false;
    try {
      await run(snapName, ['status']);
      running = true;
    } catch {
      // not running
    }

    const endpoint = running ? 'http://localhost:9090/v1' : null;
    return { installed, running, snapName, endpoint, version };
  }

  async snapInstall(snapName: string): Promise<ModelPullResult> {
    const known = KNOWN_SNAPS.some(([name]) => name === snapName);
    if (!known) throw new Error(`Unknown inference snap: ${snapName}`);

    try {
      const { stdout, stderr } = await execFileAsync('sudo', ['snap', 'install', snapName], {
        timeout: 300_000, // 5 min for large snaps
      });
      return { success: true, message: stdout || stderr };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async snapRemove(snapName: string): Promise<void> {
    await execFileAsync('sudo', ['snap', 'remove', snapName], { timeout: 60_000 });
  }
}
