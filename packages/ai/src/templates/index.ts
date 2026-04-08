/**
 * Agent, Skill, and Prompt Specification Templates
 *
 * Zod-validated schemas that enforce guardrails, security, and quality
 * at registration time. Nothing can be registered in the system without
 * passing these validations.
 *
 * ## Quick Start
 *
 * ```typescript
 * import {
 *   createAgentSpec,
 *   createSkillSpec,
 *   createPromptSpec,
 *   renderPromptTemplate,
 * } from '@revealui/ai'
 *
 * // Create an agent spec (enforces permissions, security, guardrails)
 * const agentSpec = createAgentSpec({
 *   id: 'email-agent',
 *   name: 'Email Management Agent',
 *   version: '1.0.0',
 *   description: 'Manages email triage, drafting, and scheduling',
 *   instructions: 'You are an email management assistant...',
 *   owner: 'admin',
 *   permissions: {
 *     allowedTools: ['read_email', 'draft_email', 'send_email'],
 *     deniedTools: ['delete_email'],
 *     maxToolCallsPerTask: 20,
 *   },
 *   security: {
 *     sensitiveDataHandling: 'read_only',
 *     allowNetworkAccess: true,
 *   },
 * })
 *
 * // Create a skill spec (requires test cases)
 * const skillSpec = createSkillSpec({
 *   id: 'email-summarize',
 *   name: 'Email Summarizer',
 *   version: '1.0.0',
 *   description: 'Summarizes an email thread into key points',
 *   author: 'admin',
 *   category: 'email',
 *   inputSchema: { thread: { type: 'string' } },
 *   outputSchema: { summary: { type: 'string' }, keyPoints: { type: 'array' } },
 *   testCases: [
 *     { description: 'Basic thread', input: { thread: '...' }, shouldPass: true },
 *   ],
 * })
 * ```
 */

// Agent specification
export {
  type AgentGuardrails,
  AgentGuardrailsSchema,
  type AgentPermissions,
  AgentPermissionsSchema,
  type AgentQuality,
  AgentQualitySchema,
  type AgentSecurity,
  AgentSecuritySchema,
  type AgentSpec,
  AgentSpecSchema,
  createAgentSpec,
  safeValidateAgentSpec,
  validateAgentSpec,
} from './agent-spec.js';
// Prompt specification
export {
  createPromptSpec,
  type PromptExample,
  PromptExampleSchema,
  type PromptGuardrails,
  PromptGuardrailsSchema,
  type PromptSecurity,
  PromptSecuritySchema,
  type PromptSpec,
  PromptSpecSchema,
  type PromptVariable,
  PromptVariableSchema,
  renderPromptTemplate,
  safeValidatePromptSpec,
  validatePromptSpec,
} from './prompt-spec.js';
// Skill specification
export {
  createSkillSpec,
  type SkillPermissions,
  SkillPermissionsSchema,
  type SkillSecurity,
  SkillSecuritySchema,
  type SkillSpec,
  SkillSpecSchema,
  type SkillTestCase,
  SkillTestCaseSchema,
  safeValidateSkillSpec,
  validateSkillSpec,
} from './skill-spec.js';
