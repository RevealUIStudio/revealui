/**
 * Security Schemas
 *
 * Schemas for code-pattern security analysis rules and regex AST types.
 * Used by @revealui/scripts analyzers for typed detection of dangerous patterns.
 *
 * IMPORTANT: These schemas define DATA SHAPES only.
 * The actual analysis runtime is in @revealui/scripts/analyzers.
 * The `ret` regex parser is NOT imported here.
 */

export {
  type RetChar,
  RetCharSchema,
  type RetGroup,
  RetGroupSchema,
  type RetNode,
  RetNodeType,
  type RetNodeTypeValue,
  type RetPosition,
  RetPositionSchema,
  type RetRange,
  RetRangeSchema,
  type RetReference,
  RetReferenceSchema,
  type RetRepetition,
  RetRepetitionSchema,
  type RetRoot,
  RetRootSchema,
  type RetSet,
  type RetSetMember,
  RetSetSchema,
  type RetToken,
  RetTokenSchema,
} from './ret-ast.js';
export {
  EXEC_SYNC_STRING_RULE,
  REDOS_REGEX_RULE,
  SECURITY_RULES,
  type SecurityRuleId,
  TOCTOU_STAT_READ_RULE,
} from './rule-registry.js';
export {
  type IssueLocation,
  IssueLocationSchema,
  type SecurityCategory,
  SecurityCategorySchema,
  type SecurityFinding,
  SecurityFindingContract,
  SecurityFindingSchema,
  type SecurityRule,
  SecurityRuleContract,
  SecurityRuleSchema,
  type SecuritySeverity,
  SecuritySeveritySchema,
} from './rules.js';
