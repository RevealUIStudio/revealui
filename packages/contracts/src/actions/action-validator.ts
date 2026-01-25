/**
 * Action Validation Layer
 *
 * Validates actions against entity constraints, agent capabilities, and permissions.
 * This provides runtime enforcement of the constraints defined in entity schemas.
 *
 * @module @revealui/contracts/actions
 */

import type { AgentDefinition } from '@revealui/contracts/agents'
import type { AgentActionDefinition, AgentConstraint, DualEntity } from '../representation/index.js'

// =============================================================================
// Types
// =============================================================================

export interface ActionValidationContext {
  /** The entity being acted upon */
  entity: DualEntity

  /** The action name (e.g., 'update', 'delete', 'addBlock') */
  action: string

  /** The agent attempting the action */
  agent: AgentDefinition

  /** Proposed changes (for update/create actions) */
  changes?: Record<string, unknown>

  /** User permissions (for permission-based constraints) */
  permissions?: string[]

  /** Additional context */
  context?: Record<string, unknown>
}

export interface ActionValidationSuccess {
  success: true
  allowed: true
  warnings?: string[]
}

export interface ActionValidationFailure {
  success: false
  allowed: false
  errors: ActionValidationError[]
}

export interface ActionValidationError {
  code: string
  message: string
  field?: string
  constraint?: AgentConstraint
}

export type ActionValidationResult = ActionValidationSuccess | ActionValidationFailure

// =============================================================================
// Constraint Checking
// =============================================================================

/**
 * Check if changes violate entity constraints
 */
function checkConstraints(
  entity: DualEntity,
  changes: Record<string, unknown> | undefined,
): ActionValidationResult {
  if (!changes) return { success: true, allowed: true }

  const constraints = entity.agent.constraints || []
  const errors: ActionValidationError[] = []

  for (const constraint of constraints) {
    const result = checkSingleConstraint(constraint, entity, changes)
    if (!result.allowed) {
      errors.push(...result.errors)
    }
  }

  if (errors.length > 0) {
    return { success: false, allowed: false, errors }
  }

  return { success: true, allowed: true }
}

/**
 * Check a single constraint
 */
function checkSingleConstraint(
  constraint: AgentConstraint,
  entity: DualEntity,
  changes: Record<string, unknown>,
): ActionValidationResult {
  const { type, field, params, message } = constraint

  // If constraint applies to a specific field, only check if that field is changing
  if (field && !(field in changes)) {
    return { success: true, allowed: true }
  }

  const value = field ? changes[field] : changes

  switch (type) {
    case 'readonly':
      if (field && field in changes) {
        return {
          success: false,
          allowed: false,
          errors: [
            {
              code: 'READONLY_FIELD',
              message: message || `Field '${field}' is readonly`,
              field,
              constraint,
            },
          ],
        }
      }
      break

    case 'required':
      if (field && (!value || value === '')) {
        return {
          success: false,
          allowed: false,
          errors: [
            {
              code: 'REQUIRED_FIELD',
              message: message || `Field '${field}' is required`,
              field,
              constraint,
            },
          ],
        }
      }
      break

    case 'immutable': {
      // Check if field already has a value (immutable after creation)
      const currentValue = field ? (entity as Record<string, unknown>)[field] : entity
      if (currentValue !== undefined && value !== currentValue) {
        return {
          success: false,
          allowed: false,
          errors: [
            {
              code: 'IMMUTABLE_FIELD',
              message: message || `Field '${field}' cannot be changed after creation`,
              ...(field && { field }),
              constraint,
            },
          ],
        }
      }
      break
    }

    case 'range':
      if (typeof value === 'number' && params) {
        const min = params.min as number | undefined
        const max = params.max as number | undefined
        if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
          return {
            success: false,
            allowed: false,
            errors: [
              {
                code: 'RANGE_VIOLATION',
                message: message || `Value must be between ${min} and ${max}`,
                ...(field && { field }),
                constraint,
              },
            ],
          }
        }
      }
      break

    case 'pattern': {
      if (typeof value === 'string') {
        const pattern = typeof params?.pattern === 'string' ? params.pattern : null
        if (pattern) {
          const regex = new RegExp(pattern)
          if (!regex.test(value)) {
            return {
              success: false,
              allowed: false,
              errors: [
                {
                  code: 'PATTERN_VIOLATION',
                  message: message || `Value must match pattern ${pattern}`,
                  ...(field && { field }),
                  constraint,
                },
              ],
            }
          }
        }
      }
      break
    }

    case 'capability':
      // Handled separately in checkCapabilities
      break

    case 'permission':
      // Handled separately in checkPermissions
      break

    case 'custom': {
      // Custom constraint logic would be evaluated here
      const validator = params?.validator
      if (typeof validator === 'function') {
        const customResult = (
          validator as (
            value: unknown,
            entity: DualEntity,
            changes: Record<string, unknown>,
          ) => boolean
        )(value, entity, changes)
        if (!customResult) {
          return {
            success: false,
            allowed: false,
            errors: [
              {
                code: 'CUSTOM_CONSTRAINT_FAILED',
                message: message || 'Custom constraint validation failed',
                ...(field && { field }),
                constraint,
              },
            ],
          }
        }
      }
      break
    }
  }

  return { success: true, allowed: true }
}

// =============================================================================
// Capability Checking
// =============================================================================

/**
 * Check if agent has required capabilities for action
 */
function checkCapabilities(
  agent: AgentDefinition,
  requiredCapabilities: string[],
): ActionValidationResult {
  const agentCapabilities = agent.capabilities || []
  const missing = requiredCapabilities.filter((cap: string) => !agentCapabilities.includes(cap))

  if (missing.length > 0) {
    return {
      success: false,
      allowed: false,
      errors: [
        {
          code: 'MISSING_CAPABILITY',
          message: `Agent missing required capabilities: ${missing.join(', ')}`,
        },
      ],
    }
  }

  return { success: true, allowed: true }
}

// =============================================================================
// Permission Checking
// =============================================================================

/**
 * Check if user has required permissions for action
 */
function checkPermissions(
  permissions: string[] | undefined,
  actionDef: AgentActionDefinition,
): ActionValidationResult {
  // If action doesn't require permissions, allow it
  const requiredPermissions = actionDef.requiredCapabilities
    ?.filter((cap: string) => cap.startsWith('permission:'))
    .map((cap: string) => cap.replace('permission:', ''))

  if (!requiredPermissions || requiredPermissions.length === 0) {
    return { success: true, allowed: true }
  }

  if (!permissions || permissions.length === 0) {
    return {
      success: false,
      allowed: false,
      errors: [
        {
          code: 'MISSING_PERMISSION',
          message: `Action requires permissions: ${requiredPermissions.join(', ')}`,
        },
      ],
    }
  }

  const missing = requiredPermissions.filter((perm: string) => !permissions.includes(perm))

  if (missing.length > 0) {
    return {
      success: false,
      allowed: false,
      errors: [
        {
          code: 'MISSING_PERMISSION',
          message: `Missing permissions: ${missing.join(', ')}`,
        },
      ],
    }
  }

  return { success: true, allowed: true }
}

// =============================================================================
// Action Validation (Main Entry Point)
// =============================================================================

/**
 * Validate an action against entity constraints, agent capabilities, and permissions
 *
 * This is the main entry point for action validation in @revealui/contracts/actions
 */
export function validateAction(context: ActionValidationContext): ActionValidationResult {
  const { entity, action, agent, changes, permissions } = context

  // 1. Check if action is defined on entity
  const actionDef = entity.agent.actions?.find((a: AgentActionDefinition) => a.name === action)
  if (!actionDef) {
    return {
      success: false,
      allowed: false,
      errors: [
        {
          code: 'ACTION_NOT_FOUND',
          message: `Action '${action}' is not available on this entity`,
        },
      ],
    }
  }

  // 2. Check if action is destructive and requires confirmation
  if (actionDef.destructive && !context.context?.confirmed) {
    return {
      success: false,
      allowed: false,
      errors: [
        {
          code: 'DESTRUCTIVE_ACTION_REQUIRES_CONFIRMATION',
          message: `Action '${action}' is destructive and requires confirmation`,
        },
      ],
    }
  }

  // 3. Check constraints
  const constraintResult = checkConstraints(entity, changes)
  if (!constraintResult.success) {
    return constraintResult
  }

  // 4. Check capabilities
  if (actionDef.requiredCapabilities) {
    const capabilityResult = checkCapabilities(agent, actionDef.requiredCapabilities)
    if (!capabilityResult.success) {
      return capabilityResult
    }
  }

  // 5. Check permissions
  const permissionResult = checkPermissions(permissions, actionDef)
  if (!permissionResult.success) {
    return permissionResult
  }

  // All checks passed
  return { success: true, allowed: true }
}
