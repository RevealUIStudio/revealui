/**
 * Code Validator
 *
 * AI Code Standards Enforcer - Prevents technical debt in AI-generated code
 *
 * @example
 * ```typescript
 * import { createValidator } from 'dev/code-validator'
 *
 * const validator = await createValidator('.revealui/code-standards.json')
 * const result = validator.validate(code, { filePath: 'src/foo.ts' })
 *
 * if (!result.valid) {
 *   console.log(validator.formatResult(result))
 * }
 * ```
 */

export * from './types.js'
export * from './validator.js'
