/**
 * RevealUI Agent Adapter
 *
 * Unlike Claude Code and Cursor adapters which wrap external CLIs,
 * this adapter IS the runtime  -  it creates an Agent with coding tools,
 * wires the content layer as instructions, and runs StreamingAgentRuntime
 * directly. This is RevealUI's own coding agent.
 */

import type { HarnessAdapter } from '../types/adapter.js';
import type {
  HarnessCapabilities,
  HarnessCommand,
  HarnessCommandResult,
  HarnessEvent,
  HarnessInfo,
} from '../types/core.js';
import type { GeneratedFiles, VaughnConfig } from '../vaughn/adapter.js';
import type { VaughnCapabilities } from '../vaughn/capabilities.js';
import { TOOL_PROFILES } from '../vaughn/capabilities.js';
import type { VaughnEventEnvelope } from '../vaughn/event-envelope.js';
import { VaughnEventNormalizer } from '../vaughn/event-normalizer.js';

/**
 * Configuration for the RevealUI Agent Adapter.
 * All fields are optional  -  sensible defaults are applied.
 */
export interface RevealUIAgentConfig {
  /** Project root for coding tools sandbox (default: cwd) */
  projectRoot?: string;
  /** LLM provider override (default: auto-detect from env) */
  provider?: string;
  /** Model name override (default: provider default) */
  model?: string;
  /** Max agentic loop iterations (default: 10) */
  maxIterations?: number;
  /** Task timeout in ms (default: 120000) */
  timeoutMs?: number;
  /** Workboard path for coordination (default: REVEALUI_WORKBOARD_PATH env) */
  workboardPath?: string;
}

const DEFAULT_CONFIG: Required<Omit<RevealUIAgentConfig, 'provider' | 'model' | 'workboardPath'>> =
  {
    projectRoot: process.cwd(),
    maxIterations: 10,
    timeoutMs: 120_000,
  };

/**
 * RevealUI's standalone coding agent adapter.
 *
 * This adapter enables ALL capabilities: it can generate code, analyze code,
 * apply edits, and run headless prompts  -  because it IS the agent runtime,
 * not a wrapper around an external tool.
 */
export class RevealUIAgentAdapter implements HarnessAdapter {
  readonly id = 'revealui-agent';
  readonly name = 'RevealUI Agent';

  private readonly config: RevealUIAgentConfig;
  private readonly eventHandlers = new Set<(event: HarnessEvent) => void>();
  private readonly vaughnEventHandlers = new Set<(event: VaughnEventEnvelope) => void>();
  private vaughnNormalizer: VaughnEventNormalizer | null = null;

  constructor(config?: RevealUIAgentConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  getCapabilities(): HarnessCapabilities {
    return {
      generateCode: true,
      analyzeCode: true,
      applyEdit: true,
      applyConfig: false,
      readWorkboard:
        (this.config.workboardPath ?? process.env.REVEALUI_WORKBOARD_PATH) !== undefined,
      writeWorkboard:
        (this.config.workboardPath ?? process.env.REVEALUI_WORKBOARD_PATH) !== undefined,
    };
  }

  async getInfo(): Promise<HarnessInfo> {
    return {
      id: this.id,
      name: this.name,
      version: '0.1.0',
      capabilities: this.getCapabilities(),
    };
  }

  /** Get the VAUGHN capability profile for this adapter. */
  getVaughnCapabilities(): VaughnCapabilities {
    // revealui-agent is always defined in TOOL_PROFILES
    return TOOL_PROFILES['revealui-agent'] as VaughnCapabilities;
  }

  /** Subscribe to VAUGHN-normalized events. */
  onVaughnEvent(handler: (event: VaughnEventEnvelope) => void): () => void {
    this.vaughnEventHandlers.add(handler);
    if (!this.vaughnNormalizer) {
      this.vaughnNormalizer = new VaughnEventNormalizer(
        'revealui-agent',
        this.id,
        `session-${Date.now()}`,
      );
    }
    return () => this.vaughnEventHandlers.delete(handler);
  }

  /** Generate tool-native config files from canonical VAUGHN config (stub). */
  async generateConfig(_config: VaughnConfig): Promise<GeneratedFiles> {
    // RevealUI agent uses the content layer directly, not settings files.
    return { files: new Map() };
  }

  /** Read tool-native config into canonical form (stub). */
  async readConfig(): Promise<Partial<VaughnConfig>> {
    // RevealUI agent gets config from content layer, not a settings file.
    return {};
  }

  /**
   * The RevealUI agent is available if at least one LLM provider is reachable.
   * Checks in order: Ollama (localhost), Groq (API key).
   */
  async isAvailable(): Promise<boolean> {
    // Check Ollama
    const ollamaUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    try {
      const res = await fetch(`${ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) return true;
    } catch {
      // Ollama not running
    }

    // Check Groq (cloud, just needs API key)
    if (process.env.GROQ_API_KEY) return true;

    return false;
  }

  notifyRegistered(): void {
    this.emit({ type: 'harness-connected', harnessId: this.id });
  }

  notifyUnregistering(): void {
    this.emit({ type: 'harness-disconnected', harnessId: this.id });
  }

  async execute(command: HarnessCommand): Promise<HarnessCommandResult> {
    try {
      return await this.executeInner(command);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.emit({ type: 'error', harnessId: this.id, message });
      return { success: false, command: command.type, message };
    }
  }

  private async executeInner(command: HarnessCommand): Promise<HarnessCommandResult> {
    switch (command.type) {
      case 'get-status': {
        const available = await this.isAvailable();
        return {
          success: true,
          command: command.type,
          data: {
            available,
            provider: this.config.provider ?? 'auto',
            model: this.config.model ?? 'auto',
            projectRoot: this.config.projectRoot,
          },
        };
      }

      case 'headless-prompt': {
        return this.runHeadlessPrompt(command.prompt, command.maxTurns, command.timeoutMs);
      }

      case 'generate-code': {
        return this.runHeadlessPrompt(
          `Generate code: ${command.prompt}${command.language ? ` (language: ${command.language})` : ''}${command.context ? `\n\nContext:\n${command.context}` : ''}`,
        );
      }

      case 'analyze-code': {
        const question = command.question ?? 'Analyze this file and explain what it does.';
        return this.runHeadlessPrompt(
          `Read the file at ${command.filePath} and answer: ${question}`,
        );
      }

      case 'apply-edit': {
        return this.runHeadlessPrompt(
          `Apply the following diff to ${command.filePath}:\n\n${command.diff}`,
        );
      }

      case 'apply-config':
      case 'sync-config':
      case 'diff-config': {
        return {
          success: false,
          command: command.type,
          message:
            'Config sync is not applicable  -  RevealUI agent uses the content layer directly',
        };
      }

      case 'read-workboard':
      case 'update-workboard': {
        // Workboard support delegated to WorkboardManager (same as Claude adapter)
        return {
          success: false,
          command: command.type,
          message: 'Workboard support not yet wired  -  use WorkboardManager directly',
        };
      }

      default: {
        return {
          success: false,
          command: (command as HarnessCommand).type,
          message: `Command not supported by ${this.name}`,
        };
      }
    }
  }

  /**
   * Run a headless prompt through the coding agent.
   * Lazy-imports @revealui/ai to avoid hard dependency at module load time.
   * Types are inferred from the dynamic imports  -  no compile-time @revealui/ai dependency.
   */
  private async runHeadlessPrompt(
    prompt: string,
    maxTurns?: number,
    timeoutMs?: number,
  ): Promise<HarnessCommandResult> {
    // Lazy import  -  @revealui/ai is an optional peer. Dynamic import()
    // deliberately uses string literals so TS doesn't resolve the types
    // at build time (the harnesses package has no dependency on @revealui/ai).
    const aiRuntimePath = '@revealui/ai/orchestration/streaming-runtime';
    const aiClientPath = '@revealui/ai/llm/client';
    const aiToolsPath = '@revealui/ai/tools/coding';

    let runtimeMod: Record<string, unknown>;
    let clientMod: Record<string, unknown>;
    let toolsMod: Record<string, unknown>;

    try {
      [runtimeMod, clientMod, toolsMod] = (await Promise.all([
        import(aiRuntimePath),
        import(aiClientPath),
        import(aiToolsPath),
      ])) as [Record<string, unknown>, Record<string, unknown>, Record<string, unknown>];
    } catch {
      return {
        success: false,
        command: 'headless-prompt',
        message:
          '@revealui/ai is not installed. Install it to use the RevealUI agent: npm install @revealui/ai',
      };
    }

    const StreamingAgentRuntime = runtimeMod.StreamingAgentRuntime as new (config: {
      maxIterations?: number;
      timeout?: number;
    }) => {
      streamTask(
        agent: unknown,
        task: unknown,
        llmClient: unknown,
      ): AsyncGenerator<{
        type: string;
        content?: string;
        toolCall?: { name: string };
        toolResult?: { content?: string };
        error?: string;
      }>;
      cleanup(): Promise<void>;
    };

    const createCodingTools = toolsMod.createCodingTools as (config: {
      projectRoot: string;
    }) => unknown[];

    const projectRoot = this.config.projectRoot ?? process.cwd();
    const tools = createCodingTools({ projectRoot });

    // Build LLM client via factory
    let llmClient: unknown;
    if (this.config.provider) {
      const LLMClient = clientMod.LLMClient as new (config: Record<string, unknown>) => unknown;
      llmClient = new LLMClient({
        provider: this.config.provider,
        model: this.config.model,
        baseURL: process.env.INFERENCE_SNAPS_BASE_URL ?? process.env.OLLAMA_BASE_URL,
        apiKey: process.env.GROQ_API_KEY ?? 'not-needed',
      });
    } else {
      const createLLMClientFromEnv = clientMod.createLLMClientFromEnv as () => unknown;
      llmClient = createLLMClientFromEnv();
    }

    const agent = {
      id: 'revealui-coding-agent',
      name: 'RevealUI Coding Agent',
      instructions: this.buildInstructions(),
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
      maxIterations: maxTurns ?? this.config.maxIterations ?? DEFAULT_CONFIG.maxIterations,
      timeout: timeoutMs ?? this.config.timeoutMs ?? DEFAULT_CONFIG.timeoutMs,
    });

    const taskId = task.id;
    this.emit({ type: 'generation-started', taskId });

    const outputParts: string[] = [];

    try {
      for await (const chunk of runtime.streamTask(agent, task, llmClient)) {
        switch (chunk.type) {
          case 'text':
            if (chunk.content) outputParts.push(chunk.content);
            break;
          case 'tool_call_result':
            if (chunk.toolResult?.content) {
              outputParts.push(`[tool: ${chunk.toolCall?.name}] ${chunk.toolResult.content}`);
            }
            break;
          case 'error':
            if (chunk.error) outputParts.push(`[error] ${chunk.error}`);
            break;
          case 'done':
            break;
        }
      }
    } finally {
      await runtime.cleanup();
    }

    const output = outputParts.join('\n');
    this.emit({ type: 'generation-completed', taskId, output });

    return {
      success: true,
      command: 'headless-prompt',
      message: output,
      data: { taskId, output },
    };
  }

  /**
   * Build system instructions from the content layer.
   * Loads rules from .claude/rules/ as a baseline (they are the canonical content).
   */
  private buildInstructions(): string {
    const lines: string[] = [
      'You are the RevealUI coding agent. You help with software development tasks in this project.',
      'Use the available tools to read, write, edit, search, and execute commands.',
      'Always read files before modifying them. Prefer surgical edits over full rewrites.',
      'Follow project conventions discovered via the project_context tool.',
      '',
    ];

    // Load project rules if available
    try {
      const { readdirSync, readFileSync } = require('node:fs');
      const { join } = require('node:path');
      const projectRoot = this.config.projectRoot ?? process.cwd();
      const rulesDir = join(projectRoot, '.claude', 'rules');

      const ruleFiles: string[] = readdirSync(rulesDir);
      for (const file of ruleFiles) {
        if (file.endsWith('.md')) {
          const content = readFileSync(join(rulesDir, file), 'utf8');
          lines.push(`## ${file.replace('.md', '')}`, content, '');
        }
      }
    } catch {
      // No rules directory  -  proceed with base instructions
    }

    return lines.join('\n');
  }

  onEvent(handler: (event: HarnessEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  async dispose(): Promise<void> {
    this.eventHandlers.clear();
    this.vaughnEventHandlers.clear();
    this.vaughnNormalizer = null;
  }

  private emit(event: HarnessEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Swallow subscriber errors
      }
    }

    // Emit VAUGHN-normalized event if subscribers exist
    if (this.vaughnNormalizer && this.vaughnEventHandlers.size > 0) {
      const envelope = this.vaughnNormalizer.normalizeToEnvelope(event);
      if (envelope) {
        for (const handler of this.vaughnEventHandlers) {
          try {
            handler(envelope);
          } catch {
            // Swallow subscriber errors
          }
        }
      }
    }
  }
}
