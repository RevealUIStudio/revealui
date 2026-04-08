/**
 * Agent Skill Integration
 *
 * Inject skill instructions into agent prompts.
 */

export {
  type AgentMessage,
  AgentSkillProvider,
  type AgentSkillProviderConfig,
  createAgentSkillProvider,
  type SkillInjectionResult,
} from './agent-skill-provider.js';
