/**
 * Field Validation Execution
 *
 * Runs field-level `validate` predicates during create/update operations.
 * Mirrors the fieldHooks.ts execution pattern: a single flattenFields traversal
 * over the collection's fields.
 *
 * A field's `validate(value, { value, data, siblingData, operation, req })`
 * returns `true` when the value is valid, or a non-empty string error message
 * when it is not. On the first failure the engine throws the canonical ValidationError
 * (HTTP 400, `instanceof`) carrying that message, so the write is rejected at ingress.
 *
 * Enforcement note: this is one of the engine's ingress checks and runs for
 * EVERY collection written through create()/update(). For public page/post
 * rich-text content it COMPLEMENTS — does not replace — the contracts walker
 * (validateContent/validateBlocks, wired into the pages/posts write routes) and
 * render-side sanitizeUrl. See docs/specs/2026-07-02-cms-render-path-hardening.md.
 */

import type { Field } from '@revealui/contracts/admin';
import type { RevealCollectionConfig, RevealRequest } from '../../types/index.js';
import { ValidationError } from '../../utils/errors.js';
import { flattenFields } from '../../utils/type-guards.js';

/** Re-export canonical domain ValidationError for collection call sites/tests. */
export { ValidationError };

/**
 * Executes every field's `validate` predicate for the fields present in `data`.
 *
 * Called once per write, after the required-field / email-format checks and
 * before the beforeChange field hooks — the same ordering Payload uses
 * (beforeValidate hooks → validate → beforeChange hooks).
 *
 * A field is validated only when its name is present in `data`. This matches the
 * engine's existing email check (which gates on `field.name in data`) and is
 * correct for partial updates, where absent keys are untouched. Required-but-
 * absent fields are still caught by the separate required-field check in the
 * create operation.
 *
 * `flattenFields` recurses through `tabs`/`row` containers, whose child fields
 * remain top-level keys in `data`, so `data[field.name]` and `siblingData: data`
 * resolve correctly. `group`/`array`/`blocks` are validated as a single value
 * (the whole sub-object), matching how the engine treats those JSON fields.
 */
export async function runFieldValidators(
  config: RevealCollectionConfig,
  data: Record<string, unknown>,
  operation: 'create' | 'update',
  req?: RevealRequest,
): Promise<void> {
  const fields = flattenFields(config.fields || []);

  for (const field of fields as Field[]) {
    if (!field.name) continue;

    const validate = field.validate;
    if (typeof validate !== 'function') continue;

    // Only validate fields carried by this write payload.
    if (!(field.name in data)) continue;

    const value = data[field.name];
    // `req` is required by FieldValidateArgs; ingress writes always carry one.
    // Bootstrap/test paths may not — pass it through and let validators that
    // depend on `req` fail loudly rather than silently skipping validation.
    // Cast the args object to the predicate's own parameter type: core's
    // RevealRequest and the contracts FieldValidateArgs.req generic differ only
    // in their default user parameter, so the shape is identical.
    const args = {
      value,
      data,
      siblingData: data,
      operation,
      req,
    } as Parameters<NonNullable<Field['validate']>>[1];
    const result = await validate(value, args);

    if (result !== true) {
      const message =
        typeof result === 'string' && result.length > 0
          ? result
          : `Field '${field.name}' failed validation`;
      throw new ValidationError(message, field.name);
    }
  }
}
