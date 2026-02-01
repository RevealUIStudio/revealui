/**
 * Field Conversion Utilities
 *
 * Converts between standard Field types and RevealUIField types.
 *
 * NOTE ON TYPE ASSERTIONS:
 * The type assertions in this file are necessary due to TypeScript's limitation
 * with narrowing separate variables. Here's why:
 *
 * 1. `baseField` is initialized as `RevealUIField` (a union type) or `Field` (a union type)
 * 2. TypeScript can narrow `field` or `revealUIField` in conditionals/switches
 * 3. However, TypeScript CANNOT narrow `baseField` because it's a separate variable
 *    that was explicitly typed, not derived from the narrowed value
 *
 * The assertions (`as RevealUITextField`, etc.) are used to tell TypeScript that
 * after type narrowing checks, we're assigning type-specific properties that exist
 * on the narrowed type but not on the base union type.
 *
 * Alternative approaches considered:
 * - Returning different object literals per type: Would work but duplicates code
 * - Using type predicates on baseField: Not possible without runtime checks
 * - Restructuring to avoid mutations: Would require significant refactoring
 *
 * These assertions are safe because they're guarded by runtime type checks
 * (isTextField, isArrayField, switch on field.type).
 */
import type { Field, RevealUIField } from '../types/index.js';
export declare function convertToRevealUIField(field: Field): RevealUIField;
export declare function convertFromRevealUIField(revealUIField: RevealUIField): Field;
export declare function enhanceFieldWithRevealUI(field: Field, revealUIOptions?: RevealUIField['revealUI']): RevealUIField;
interface RevealUIValidationContext {
    data: Record<string, unknown>;
    siblingData: Record<string, unknown>;
    user?: unknown;
    operation: 'create' | 'update';
    tenant?: string;
}
export declare function validateRevealUIField(field: RevealUIField, value: unknown, context: RevealUIValidationContext): string | true;
export {};
//# sourceMappingURL=field-conversion.d.ts.map