/**
 * User Schema
 *
 * Users can be humans or agents. Both are first-class citizens in RevealUI.
 * Humans interact through visual interfaces; agents through structured APIs.
 * Both operate on the same underlying data with full audit trails.
 *
 * This schema extends the auto-generated UsersSelectSchema from the database
 * and adds dual representation (human + agent views) and computed fields.
 */

import { z } from 'zod/v4';
import {
  createTimestamps,
  DualEntitySchema,
  REPRESENTATION_SCHEMA_VERSION,
  toAgentRepresentation,
  toHumanRepresentation,
} from '../representation/index.js';
// NOTE: Auto-generated schemas available for future use:
// import { UsersSelectSchema, UsersInsertSchema } from '../generated/zod-schemas.js'
// These can be used to extend/compose with business logic in the future

// =============================================================================
// Schema Version
// =============================================================================

export const USER_SCHEMA_VERSION = 1;

// =============================================================================
// User Types
// =============================================================================

export const UserTypeSchema = z.enum([
  'human', // A human user
  'agent', // An AI agent
  'system', // System user (for automated tasks)
]);
export type UserType = z.infer<typeof UserTypeSchema>;

export const UserRoleSchema = z.enum([
  'owner', // Full control
  'admin', // Administrative access
  'editor', // Can edit content
  'viewer', // Read-only access
  'agent', // AI agent role
  'contributor', // Can suggest changes
]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserStatusSchema = z.enum([
  'active', // Normal operation
  'suspended', // Temporarily disabled
  'deleted', // Soft deleted
  'pending', // Awaiting verification
]);
export type UserStatus = z.infer<typeof UserStatusSchema>;

// =============================================================================
// User Preferences
// =============================================================================

export const UserPreferencesSchema = z.object({
  /** UI theme */
  theme: z.enum(['light', 'dark', 'system']).default('system'),

  /** Preferred language */
  language: z.string().default('en'),

  /** Timezone */
  timezone: z.string().default('UTC'),

  /** Enable notifications */
  notifications: z
    .object({
      email: z.boolean().default(true),
      push: z.boolean().default(false),
      inApp: z.boolean().default(true),
    })
    .optional(),

  /** Editor preferences */
  editor: z
    .object({
      fontSize: z.number().int().min(10).max(24).default(14),
      tabSize: z.number().int().min(1).max(8).default(2),
      wordWrap: z.boolean().default(true),
      autoSave: z.boolean().default(true),
      autoSaveIntervalMs: z.number().int().min(1000).default(5000),
    })
    .optional(),

  /** AI assistance preferences */
  ai: z
    .object({
      enabled: z.boolean().default(true),
      autoSuggest: z.boolean().default(true),
      voiceEnabled: z.boolean().default(false),
    })
    .optional(),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

// =============================================================================
// User Schema (extends auto-generated base)
// =============================================================================

/**
 * User schema with dual representation and computed fields.
 *
 * NOTE: The auto-generated UsersSelectSchema from packages/db is available
 * and can be used to extend this schema in the future for tighter integration.
 * For now, we maintain the existing schema structure for backward compatibility.
 *
 * Future refactoring: Extend UsersSelectSchema.merge(DualEntitySchema)
 */
export const UserSchema = DualEntitySchema.extend({
  /** Schema version for migrations */
  schemaVersion: z.number().int().default(USER_SCHEMA_VERSION),

  /** User type: human, agent, or system */
  type: UserTypeSchema,

  /** User status */
  status: UserStatusSchema.default('active'),

  /** Email (for humans) or identifier (for agents) */
  email: z.string().email().optional(),

  /** Display name */
  name: z.string().min(1).max(100),

  /** Avatar URL */
  avatarUrl: z.url().optional(),

  /** User's role */
  role: UserRoleSchema,

  /** For agents: the model/version identifier */
  agentModel: z.string().optional(),

  /** For agents: capabilities this agent has */
  agentCapabilities: z.array(z.string()).optional(),

  /** For agents: configuration */
  agentConfig: z
    .object({
      systemPrompt: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().positive().optional(),
    })
    .optional(),

  /** User preferences (human-native settings) */
  preferences: UserPreferencesSchema.optional(),

  /** Last active timestamp */
  lastActiveAt: z.string().datetime().optional(),

  /** Email verified */
  emailVerified: z.boolean().default(false),
});

export type User = z.infer<typeof UserSchema>;

// =============================================================================
// User Creation
// =============================================================================

/**
 * User creation input - defines required fields for creating a new user
 * Based on the auto-generated UsersInsertSchema structure
 */
export const CreateUserInputSchema = z.object({
  type: UserTypeSchema,
  email: z.string().email().optional(),
  name: z.string().min(1).max(100),
  role: UserRoleSchema,
  avatarUrl: z.url().optional(),
  agentModel: z.string().optional(),
  agentCapabilities: z.array(z.string()).optional(),
  agentConfig: z
    .object({
      systemPrompt: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().positive().optional(),
    })
    .optional(),
  preferences: UserPreferencesSchema.optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;

/**
 * Creates a new user with dual representation
 */
export function createUser(id: string, input: CreateUserInput): User {
  const timestamps = createTimestamps();

  return {
    id,
    version: REPRESENTATION_SCHEMA_VERSION,
    schemaVersion: USER_SCHEMA_VERSION,
    type: input.type,
    status: 'active',
    email: input.email,
    name: input.name,
    role: input.role,
    avatarUrl: input.avatarUrl,
    agentModel: input.agentModel,
    agentCapabilities: input.agentCapabilities,
    agentConfig: input.agentConfig,
    preferences: input.preferences,
    emailVerified: false,
    human: toHumanRepresentation({
      name: input.name,
      description:
        input.type === 'agent'
          ? `AI Agent: ${input.agentModel || 'Unknown model'}`
          : `User: ${input.email || input.name}`,
      icon: input.type === 'agent' ? 'robot' : 'user',
    }),
    agent: toAgentRepresentation('user', {
      constraints:
        input.type === 'agent'
          ? [
              {
                type: 'capability',
                params: { allowed: input.agentCapabilities || [] },
                message: 'Agent can only perform actions within its capabilities',
              },
            ]
          : undefined,
      metadata: {
        userType: input.type,
        role: input.role,
      },
      keywords: [input.type, input.role, input.name.toLowerCase()],
    }),
    ...timestamps,
  };
}

// =============================================================================
// User Update
// =============================================================================

export const UpdateUserInputSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.url().optional(),
  role: UserRoleSchema.optional(),
  status: UserStatusSchema.optional(),
  preferences: UserPreferencesSchema.partial().optional(),
  agentConfig: z
    .object({
      systemPrompt: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().positive().optional(),
    })
    .optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserInputSchema>;
