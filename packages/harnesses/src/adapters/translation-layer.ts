/**
 * TranslationLayer — Layer 5 of the Autonomous Agent Architecture.
 *
 * Normalizes operations into a common interface so that RevealUI's native
 * agents can perform file, git, test, and inference operations through a
 * unified API.
 */

import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Result of any translation layer operation. */
export interface OperationResult {
  success: boolean;
  data?: string;
  error?: string;
}

/** Unified interface for agent operations. */
export interface AgentOperations {
  /** Read a file's contents. */
  readFile(filePath: string): Promise<OperationResult>;
  /** Write content to a file (creates or overwrites). */
  writeFile(filePath: string, content: string): Promise<OperationResult>;
  /** Edit a file by replacing old text with new text. */
  editFile(filePath: string, oldText: string, newText: string): Promise<OperationResult>;
  /** Run a shell command and return stdout. */
  runCommand(command: string, args: string[], cwd?: string): Promise<OperationResult>;
  /** Create a new git branch from the current HEAD. */
  createBranch(branchName: string, baseBranch?: string): Promise<OperationResult>;
  /** Stage and commit changes. */
  commitChanges(message: string, files?: string[]): Promise<OperationResult>;
  /** Run the test suite (or a subset). */
  runTests(filter?: string): Promise<OperationResult>;
  /** Check CI status for a branch or PR. */
  getCIStatus(branch: string): Promise<OperationResult>;
  /** Generate code using an LLM (headless). */
  generateCode(prompt: string, context?: string): Promise<OperationResult>;
  /** Analyze code using an LLM (headless). */
  analyzeCode(code: string, question: string): Promise<OperationResult>;
}

/** Default timeout for shell commands (30s). */
const CMD_TIMEOUT = 30_000;

/** Default timeout for LLM operations (120s). */
const LLM_TIMEOUT = 120_000;

/** Default inference endpoint (OpenAI-compatible). */
const DEFAULT_INFERENCE_ENDPOINT = 'http://localhost:9090';

/**
 * Native agent implementation — uses Node.js APIs and local inference.
 *
 * Code generation uses an OpenAI-compatible endpoint (Snap, Ollama, or
 * any compatible server) rather than vendor-specific CLI tools.
 */
export class NativeAgentOperations implements AgentOperations {
  private readonly inferenceEndpoint: string;

  constructor(
    private readonly repoRoot: string,
    inferenceEndpoint?: string,
  ) {
    this.inferenceEndpoint = inferenceEndpoint ?? DEFAULT_INFERENCE_ENDPOINT;
  }

  async readFile(filePath: string): Promise<OperationResult> {
    try {
      const content = await readFile(filePath, 'utf8');
      return { success: true, data: content };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async writeFile(filePath: string, content: string): Promise<OperationResult> {
    try {
      await writeFile(filePath, content, 'utf8');
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async editFile(filePath: string, oldText: string, newText: string): Promise<OperationResult> {
    try {
      const content = await readFile(filePath, 'utf8');
      if (!content.includes(oldText)) {
        return { success: false, error: 'Old text not found in file' };
      }
      const updated = content.replace(oldText, newText);
      await writeFile(filePath, updated, 'utf8');
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async runCommand(command: string, args: string[], cwd?: string): Promise<OperationResult> {
    try {
      const { stdout, stderr } = await execFileAsync(command, args, {
        cwd: cwd ?? this.repoRoot,
        timeout: CMD_TIMEOUT,
      });
      return { success: true, data: stdout + (stderr ? `\n${stderr}` : '') };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stderr =
        err instanceof Error && 'stderr' in err ? String((err as { stderr: unknown }).stderr) : '';
      return { success: false, error: `${message}\n${stderr}`.trim() };
    }
  }

  async createBranch(branchName: string, baseBranch?: string): Promise<OperationResult> {
    try {
      if (baseBranch) {
        await execFileAsync('git', ['checkout', baseBranch], {
          cwd: this.repoRoot,
          timeout: CMD_TIMEOUT,
        });
      }
      await execFileAsync('git', ['checkout', '-b', branchName], {
        cwd: this.repoRoot,
        timeout: CMD_TIMEOUT,
      });
      return { success: true, data: branchName };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async commitChanges(message: string, files?: string[]): Promise<OperationResult> {
    try {
      if (files && files.length > 0) {
        await execFileAsync('git', ['add', ...files], {
          cwd: this.repoRoot,
          timeout: CMD_TIMEOUT,
        });
      } else {
        await execFileAsync('git', ['add', '-A'], {
          cwd: this.repoRoot,
          timeout: CMD_TIMEOUT,
        });
      }
      const { stdout } = await execFileAsync('git', ['commit', '-m', message], {
        cwd: this.repoRoot,
        timeout: CMD_TIMEOUT,
      });
      return { success: true, data: stdout.trim() };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async runTests(filter?: string): Promise<OperationResult> {
    const args = ['test'];
    if (filter) {
      args.push('--filter', filter);
    }
    return this.runCommand('pnpm', args);
  }

  async getCIStatus(branch: string): Promise<OperationResult> {
    try {
      const { stdout } = await execFileAsync(
        'gh',
        ['pr', 'checks', '--head', branch, '--json', 'name,state,conclusion'],
        { cwd: this.repoRoot, timeout: CMD_TIMEOUT },
      );
      return { success: true, data: stdout.trim() };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async generateCode(prompt: string, context?: string): Promise<OperationResult> {
    const fullPrompt = context ? `${context}\n\n${prompt}` : prompt;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT);
      const res = await fetch(`${this.inferenceEndpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'default',
          messages: [{ role: 'user', content: fullPrompt }],
          stream: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        return { success: false, error: `Inference failed: ${res.status}` };
      }
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content ?? '';
      return { success: true, data: content };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async analyzeCode(code: string, question: string): Promise<OperationResult> {
    const prompt = `Analyze this code:\n\n\`\`\`\n${code}\n\`\`\`\n\n${question}`;
    return this.generateCode(prompt);
  }
}

/**
 * Factory: create the operations implementation for native agents.
 */
export function createOperations(repoRoot: string, inferenceEndpoint?: string): AgentOperations {
  return new NativeAgentOperations(repoRoot, inferenceEndpoint);
}
