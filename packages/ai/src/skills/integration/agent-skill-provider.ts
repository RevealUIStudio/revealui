/**
 * Agent Skill Provider
 *
 * Integrates skills into agent system prompts.
 */

import type { SkillActivator } from '../activation/index.js';
import type { Skill, SkillActivationContext, SkillActivationResult } from '../types.js';

/**
 * Configuration for the agent skill provider.
 */
export interface AgentSkillProviderConfig {
  /** Skill activator instance */
  activator: SkillActivator;

  /** Maximum tokens to use for skill instructions */
  maxTokenBudget?: number;

  /** Template for wrapping skill instructions */
  instructionTemplate?: (skill: Skill) => string;
}

/**
 * Message structure for agent communication.
 */
export interface AgentMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Result of skill injection.
 */
export interface SkillInjectionResult {
  /** Updated messages with skill instructions */
  messages: AgentMessage[];

  /** Skills that were activated */
  activatedSkills: Skill[];

  /** Activation reasons */
  activationReasons: SkillActivationResult['activationReasons'];

  /** Total tokens used for skills (approximate) */
  estimatedTokens: number;
}

/**
 * Provider for injecting skill instructions into agent prompts.
 */
export class AgentSkillProvider {
  private activator: SkillActivator;
  private maxTokenBudget: number;
  private instructionTemplate: (skill: Skill) => string;

  constructor(config: AgentSkillProviderConfig) {
    this.activator = config.activator;
    this.maxTokenBudget = config.maxTokenBudget ?? 4000;
    this.instructionTemplate = config.instructionTemplate ?? defaultInstructionTemplate;
  }

  /**
   * Inject activated skill instructions into agent messages.
   *
   * @param messages - Current agent messages
   * @param context - Activation context
   * @returns Updated messages with skill instructions
   */
  async injectSkillInstructions(
    messages: AgentMessage[],
    context: SkillActivationContext,
  ): Promise<SkillInjectionResult> {
    // Activate skills based on context
    const { activatedSkills, activationReasons } = await this.activator.activate(context);

    if (activatedSkills.length === 0) {
      return {
        messages,
        activatedSkills: [],
        activationReasons: {},
        estimatedTokens: 0,
      };
    }

    // Format skill instructions
    const skillInstructions = this.formatSkillInstructions(activatedSkills);
    const estimatedTokens = this.estimateTokens(skillInstructions);

    // Find system message or create one
    const updatedMessages = [...messages];
    const systemIndex = updatedMessages.findIndex((m) => m.role === 'system');

    if (systemIndex >= 0) {
      // Append to existing system message
      const existingMessage = updatedMessages[systemIndex];
      if (existingMessage) {
        updatedMessages[systemIndex] = {
          role: existingMessage.role,
          content: `${existingMessage.content}\n\n${skillInstructions}`,
        };
      }
    } else {
      // Prepend new system message
      updatedMessages.unshift({
        role: 'system',
        content: skillInstructions,
      });
    }

    return {
      messages: updatedMessages,
      activatedSkills,
      activationReasons,
      estimatedTokens,
    };
  }

  /**
   * Format multiple skill instructions into a single block.
   */
  private formatSkillInstructions(skills: Skill[]): string {
    const skillBlocks = skills.map((skill) => this.instructionTemplate(skill));

    return `<activated-skills>
${skillBlocks.join('\n\n')}
</activated-skills>`;
  }

  /**
   * Estimate token count for text (rough approximation).
   * Uses ~4 characters per token as a rough estimate.
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Build a system prompt augmentation from activated skills.
   *
   * @param skills - Skills to include
   * @returns Formatted skill instructions string
   */
  buildSkillPromptAugmentation(skills: Skill[]): string {
    if (skills.length === 0) return '';

    let totalTokens = 0;
    const includedSkills: Skill[] = [];

    // Add skills until we hit token budget
    for (const skill of skills) {
      const formatted = this.instructionTemplate(skill);
      const tokens = this.estimateTokens(formatted);

      if (totalTokens + tokens <= this.maxTokenBudget) {
        includedSkills.push(skill);
        totalTokens += tokens;
      } else {
        break;
      }
    }

    return this.formatSkillInstructions(includedSkills);
  }

  /**
   * Get skill-specific tool restrictions.
   *
   * @param skills - Activated skills
   * @returns Combined allowed tools from all skills
   */
  getToolRestrictions(skills: Skill[]): string[] {
    const allTools = new Set<string>();

    for (const skill of skills) {
      if (skill.metadata.allowedTools) {
        for (const tool of skill.metadata.allowedTools) {
          allTools.add(tool);
        }
      }
    }

    return Array.from(allTools);
  }

  /**
   * Check if a skill requires approval before execution.
   */
  requiresApproval(skills: Skill[]): boolean {
    return skills.some((s) => s.metadata.requiresApproval);
  }

  /**
   * Get available skills for the agent to reference.
   */
  getAvailableSkills(): Array<{ name: string; description: string }> {
    return this.activator.getAvailableSkills();
  }
}

/**
 * Default template for formatting skill instructions.
 */
function defaultInstructionTemplate(skill: Skill): string {
  const parts: string[] = [];

  parts.push(`<skill name="${skill.metadata.name}">`);
  parts.push(`<description>${skill.metadata.description}</description>`);

  if (skill.metadata.allowedTools?.length) {
    parts.push(`<allowed-tools>${skill.metadata.allowedTools.join(', ')}</allowed-tools>`);
  }

  parts.push(`<instructions>`);
  parts.push(skill.instructions);
  parts.push(`</instructions>`);
  parts.push(`</skill>`);

  return parts.join('\n');
}

/**
 * Create a skill provider with common defaults.
 */
export function createAgentSkillProvider(
  activator: SkillActivator,
  options?: Partial<AgentSkillProviderConfig>,
): AgentSkillProvider {
  return new AgentSkillProvider({
    activator,
    ...options,
  });
}
