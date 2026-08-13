/**
 * GAP-293 Phase C — run a native workflow skill through AgentRuntime.
 *
 * Extends RevealUIAgentAdapter's lazy @revealui/ai import. Tools are the
 * existing coding suite filtered to SKILL.md allowed-tools (no write/git).
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import type { SkillCatalogEntry } from './skill-catalog.js';
import {
  buildSkillInvokeRequest,
  mapNativeToolsToCodingInclude,
  SKILL_INVOKE_MAX_TOOL_ROUNDS,
  type SkillInvokeRequest,
  skillInvokeTimeoutMs,
} from './skill-invoke.js';

export interface RunNativeSkillInvokeOptions {
  skillId: string;
  catalog: SkillCatalogEntry[];
  projectRoot: string;
  revskillsRoot?: string;
}

export interface RunNativeSkillInvokeResult {
  skillId: string;
  model: string;
  text: string;
  ran: boolean;
  toolsExecuted: boolean;
  toolTrace: Array<{ name: string }>;
  error?: string;
}

function adapterHomePaths(revskillsRoot?: string): string[] {
  const home = homedir();
  const paths = [
    join(home, '.claude'),
    join(home, '.grok'),
    join(home, '.cursor'),
    join(home, 'revfleet'),
  ];
  if (revskillsRoot && revskillsRoot.length > 0) paths.push(revskillsRoot);
  return paths;
}

export async function runNativeSkillInvoke(
  options: RunNativeSkillInvokeOptions,
): Promise<RunNativeSkillInvokeResult> {
  const prepared = buildSkillInvokeRequest(options.skillId, options.catalog);
  if ('error' in prepared) {
    return {
      skillId: options.skillId,
      model: '',
      text: '',
      ran: false,
      toolsExecuted: false,
      toolTrace: [],
      error: prepared.error,
    };
  }
  return runPreparedSkillInvoke(prepared, options);
}

async function runPreparedSkillInvoke(
  prepared: SkillInvokeRequest,
  options: RunNativeSkillInvokeOptions,
): Promise<RunNativeSkillInvokeResult> {
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
      skillId: prepared.skillId,
      model: prepared.model,
      text: '',
      ran: false,
      toolsExecuted: false,
      toolTrace: [],
      error:
        '@revealui/ai is not installed. Install it next to @revealui/harnesses (optionalDependency).',
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
    allowedPaths?: string[];
    include?: string[];
  }) => Array<{ name: string; execute: (params: unknown) => Promise<unknown> }>;

  const include = mapNativeToolsToCodingInclude(prepared.allowedTools);
  const rawTools =
    include.length > 0
      ? createCodingTools({
          projectRoot: options.projectRoot,
          allowedPaths: adapterHomePaths(options.revskillsRoot),
          include,
        })
      : [];

  const nameByCoding: Record<string, string> = {
    file_read: 'Read',
    file_grep: 'Grep',
    file_glob: 'Glob',
    shell_exec: 'Bash',
  };
  const tools = rawTools.map((tool) => ({
    ...tool,
    name: nameByCoding[tool.name] ?? tool.name,
  }));

  const createLLMClientFromEnv = clientMod.createLLMClientFromEnv as () => unknown;
  const llmClient = createLLMClientFromEnv();

  const agent = {
    id: 'revealui-native-skill',
    name: prepared.skillId,
    instructions: prepared.system,
    tools,
    config: {},
    getContext: () => ({
      projectRoot: options.projectRoot,
      workingDirectory: options.projectRoot,
    }),
  };
  const task = {
    id: `skill-${prepared.skillId}-${String(Date.now())}`,
    type: 'native-skill',
    description: prepared.user,
  };

  const timeout = skillInvokeTimeoutMs(prepared.system, prepared.user);
  const runtime = new StreamingAgentRuntime({
    maxIterations: SKILL_INVOKE_MAX_TOOL_ROUNDS,
    timeout,
  });

  const outputParts: string[] = [];
  const toolTrace: Array<{ name: string }> = [];
  try {
    for await (const chunk of runtime.streamTask(agent, task, llmClient)) {
      if (chunk.type === 'text' && chunk.content) outputParts.push(chunk.content);
      if (chunk.type === 'tool_call_start' && chunk.toolCall?.name) {
        toolTrace.push({ name: chunk.toolCall.name });
      }
      if (chunk.type === 'error' && chunk.error) outputParts.push(`[error] ${chunk.error}`);
    }
  } finally {
    await runtime.cleanup();
  }

  return {
    skillId: prepared.skillId,
    model: prepared.model,
    text: outputParts.join('\n'),
    ran: true,
    toolsExecuted: toolTrace.length > 0,
    toolTrace,
  };
}
