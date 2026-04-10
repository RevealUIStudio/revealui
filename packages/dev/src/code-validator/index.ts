/**
 * Code Validator
 *
 * AI Code Standards Enforcer - Prevents technical debt in AI-generated code
 *
 * @example
 * ```typescript
 * import { createValidator } from '@revealui/dev/code-validator'
 *
 * const validator = await createValidator('.revealui/code-standards.json')
 * const result = validator.validate(code, { filePath: 'src/foo.ts' })
 *
 * if (!result.valid) {
 *   process.stdout.write(validator.formatResult(result))
 * }
 * ```
 */

export * from './types';
export * from './validator';
