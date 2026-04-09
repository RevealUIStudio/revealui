/**
 * `revealui agent` — RevealUI's standalone coding agent
 *
 * Modes:
 *   revealui agent              — Interactive REPL
 *   revealui agent --prompt "…" — Headless single-shot
 *   revealui agent status       — Show model, provider, loaded skills
 *
 * Uses @revealui/ai (Pro) and @revealui/harnesses (Pro) via lazy imports.
 * Falls back gracefully if Pro packages are not installed.
 */

import { createInterface } from 'node:readline';
import { createLogger } from '@revealui/setup/utils';

const logger = createLogger({ prefix: 'agent' });

// ---------------------------------------------------------------------------
// Status command
// ---------------------------------------------------------------------------

export async function runAgentStatusCommand(): Promise<void> {
  const { available, provider, model, projectRoot } = await detectProvider();
  logger.info(`Provider:     ${provider}`);
  logger.info(`Model:        ${model}`);
  logger.info(`Project root: ${projectRoot}`);
  logger.info(`Available:    ${available ? 'yes' : 'no'}`);

  if (!available) {
    logger.warn('No LLM provider detected. Install an Ubuntu inference snap or start Ollama.');
  }
}

// ---------------------------------------------------------------------------
// Headless prompt
// ---------------------------------------------------------------------------

export async function runAgentHeadlessCommand(prompt: string): Promise<void> {
  const deps = await loadProDeps();
  if (!deps) return;

  const { StreamingAgentRuntime, createLLMClientFromEnv, createCodingTools } = deps;
  const projectRoot = process.cwd();

  const tools = createCodingTools({ projectRoot });
  const llmClient = createLLMClientFromEnv();

  const agent = {
    id: 'revealui-coding-agent',
    name: 'RevealUI Coding Agent',
    instructions: buildMinimalInstructions(),
    tools,
    config: {},
    getContext: () => ({ projectRoot, workingDirectory: projectRoot }),
  };

  const task = {
    id: `task-${Date.now()}`,
    type: 'headless-prompt',
    description: prompt,
  };

  const runtime = new StreamingAgentRuntime({
    maxIterations: 10,
    timeout: 120_000,
  });

  try {
    for await (const chunk of runtime.streamTask(agent, task, llmClient)) {
      switch (chunk.type) {
        case 'text':
          if (chunk.content) process.stdout.write(chunk.content);
          break;
        case 'tool_call_start':
          if (chunk.toolCall) {
            process.stderr.write(`\n[tool] ${chunk.toolCall.name}\n`);
          }
          break;
        case 'tool_call_result':
          if (chunk.toolResult?.content) {
            process.stderr.write(`  → ${chunk.toolResult.content}\n`);
          }
          break;
        case 'error':
          process.stderr.write(`\n[error] ${chunk.error}\n`);
          break;
        case 'done':
          process.stdout.write('\n');
          break;
      }
    }
  } finally {
    await runtime.cleanup();
  }
}

// ---------------------------------------------------------------------------
// Interactive REPL
// ---------------------------------------------------------------------------

export async function runAgentReplCommand(): Promise<void> {
  const deps = await loadProDeps();
  if (!deps) return;

  const { StreamingAgentRuntime, createLLMClientFromEnv, createCodingTools } = deps;
  const projectRoot = process.cwd();

  const tools = createCodingTools({ projectRoot });
  const llmClient = createLLMClientFromEnv();

  const agent = {
    id: 'revealui-coding-agent',
    name: 'RevealUI Coding Agent',
    instructions: buildMinimalInstructions(),
    tools,
    config: {},
    getContext: () => ({ projectRoot, workingDirectory: projectRoot }),
  };

  logger.info('RevealUI Agent (type "exit" or Ctrl+C to quit)');

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\n> ',
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }
    if (input === 'exit' || input === 'quit') {
      rl.close();
      return;
    }

    const task = {
      id: `task-${Date.now()}`,
      type: 'repl-prompt',
      description: input,
    };

    const runtime = new StreamingAgentRuntime({
      maxIterations: 10,
      timeout: 120_000,
    });

    try {
      for await (const chunk of runtime.streamTask(agent, task, llmClient)) {
        switch (chunk.type) {
          case 'text':
            if (chunk.content) process.stdout.write(chunk.content);
            break;
          case 'tool_call_start':
            if (chunk.toolCall) {
              process.stderr.write(`\n  [tool] ${chunk.toolCall.name}\n`);
            }
            break;
          case 'tool_call_result':
            if (chunk.toolResult?.content) {
              process.stderr.write(`    → ${chunk.toolResult.content}\n`);
            }
            break;
          case 'error':
            process.stderr.write(`\n  [error] ${chunk.error}\n`);
            break;
          case 'done':
            break;
        }
      }
    } catch (err) {
      logger.error(err instanceof Error ? err.message : String(err));
    } finally {
      await runtime.cleanup();
    }

    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ProDeps {
  StreamingAgentRuntime: new (config: {
    maxIterations?: number;
    timeout?: number;
  }) => {
    streamTask: (
      agent: unknown,
      task: unknown,
      llmClient: unknown,
    ) => AsyncGenerator<{
      type: string;
      content?: string;
      toolCall?: { name: string; arguments: string };
      toolResult?: { content?: string; success: boolean };
      error?: string;
    }>;
    cleanup: () => Promise<void>;
  };
  createLLMClientFromEnv: () => unknown;
  createCodingTools: (config: { projectRoot: string }) => unknown[];
}

async function loadProDeps(): Promise<ProDeps | null> {
  // Dynamic import paths stored in variables so TypeScript doesn't try to
  // resolve module types at compile time — @revealui/ai is an optional peer.
  const aiRuntimePath = '@revealui/ai/orchestration/streaming-runtime';
  const aiClientPath = '@revealui/ai/llm/client';
  const aiToolsPath = '@revealui/ai/tools/coding';

  try {
    const [runtimeMod, clientMod, toolsMod] = (await Promise.all([
      import(aiRuntimePath),
      import(aiClientPath),
      import(aiToolsPath),
    ])) as [Record<string, unknown>, Record<string, unknown>, Record<string, unknown>];

    return {
      StreamingAgentRuntime: runtimeMod.StreamingAgentRuntime as ProDeps['StreamingAgentRuntime'],
      createLLMClientFromEnv: clientMod.createLLMClientFromEnv as ProDeps['createLLMClientFromEnv'],
      createCodingTools: toolsMod.createCodingTools as ProDeps['createCodingTools'],
    };
  } catch {
    logger.error(
      'Pro packages not found. Install @revealui/ai to use the agent.\n' +
        '  npm install @revealui/ai',
    );
    return null;
  }
}

async function detectProvider(): Promise<{
  available: boolean;
  provider: string;
  model: string;
  projectRoot: string;
}> {
  const projectRoot = process.cwd();

  // Check inference snaps first (recommended)
  if (process.env.INFERENCE_SNAPS_BASE_URL) {
    try {
      const res = await fetch(`${process.env.INFERENCE_SNAPS_BASE_URL}/v1/models`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        return { available: true, provider: 'inference-snaps', model: 'gemma3', projectRoot };
      }
    } catch {
      // not running
    }
  }

  // Check Ollama (fallback)
  const ollamaUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      return { available: true, provider: 'ollama', model: 'gemma4:e2b', projectRoot };
    }
  } catch {
    // not running
  }

  return { available: false, provider: 'none', model: 'none', projectRoot };
}

function buildMinimalInstructions(): string {
  return [
    'You are the RevealUI coding agent. You help with software development tasks in this project.',
    'Use the available tools to read, write, edit, search, and execute commands.',
    'Always read files before modifying them. Prefer surgical edits over full rewrites.',
    'Follow project conventions discovered via the project_context tool.',
    'Be concise and direct. Show your work through tool usage, not verbose explanations.',
  ].join('\n');
}
