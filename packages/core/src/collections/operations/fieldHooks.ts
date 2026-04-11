/**
 * Field Hook Execution
 *
 * Runs field-level beforeValidate and beforeChange hooks during create/update operations.
 * Mutates the data object in-place, mirroring the password-hashing pattern already used
 * by create.ts and update.ts.
 */

import type { RevealCollectionConfig, RevealDocument, RevealRequest } from '../../types/index.js';
import { flattenFields } from '../../utils/type-guards.js';

/**
 * Executes all hooks of `hookType` for every field in the collection that has them.
 *
 * Runs sequentially: each hook in a field's array receives the value returned by the
 * previous hook, so hooks compose (later hooks see the output of earlier ones).
 *
 * Called twice per write operation:
 *   1. `beforeValidate`  -  before required-field checks, so hooks can generate values
 *      (e.g. slug auto-generation from title) that satisfy required constraints.
 *   2. `beforeChange`    -  after validation, before the DB write.
 */
export async function runBeforeFieldHooks(
  config: RevealCollectionConfig,
  data: Record<string, unknown>,
  operation: 'create' | 'update',
  hookType: 'beforeValidate' | 'beforeChange',
  originalDoc?: RevealDocument,
  req?: RevealRequest,
): Promise<void> {
  const fields = flattenFields(config.fields || []);

  for (const field of fields) {
    if (!field.name) continue;

    const hooks = field.hooks?.[hookType];
    if (!hooks?.length) continue;

    let value = data[field.name];

    for (const hook of hooks) {
      // Hooks in this codebase receive the contract-defined FieldBeforeChangeHookArgs.
      // Thread req from the caller when available; fall back to an empty object
      // for backward compatibility with call sites that don't provide it yet.
      value = await (
        hook as (args: {
          value: unknown;
          data: Record<string, unknown>;
          siblingData: Record<string, unknown>;
          req: RevealRequest;
          operation: 'create' | 'update';
          originalDoc?: RevealDocument;
          context: Record<string, unknown>;
          field: unknown;
        }) => unknown | Promise<unknown>
      )({
        value,
        data,
        siblingData: data,
        req: req ?? ({} as RevealRequest),
        operation,
        originalDoc,
        context: {},
        field,
      });
    }

    // Only write back if the hook produced a defined value. If the hook returns
    // undefined for a field that was not in the original data, skip the assignment
    // so we don't inject undefined-valued column references into the INSERT.
    if (value !== undefined) {
      data[field.name] = value;
    }
  }
}
