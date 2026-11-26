import { z } from 'zod/v4';

export interface ContractJsonSchemaOptions {
  io?: 'input' | 'output';
  /** Explicit JSON serialization projection; never changes the runtime parser. */
  dateProjection?: 'date-to-json';
}

// Date#toJSON produces UTC milliseconds, including signed six-digit years.
// Those extended years are outside RFC3339, so format: date-time is unsound.
const DATE_JSON_PATTERN =
  '^(?:[0-9]{4}|[+-][0-9]{6})-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\\.[0-9]{3}Z$';

/**
 * Describe request input or entity output. Opted-in Dates describe the JSON
 * wire shape only: callers still need Date instances for runtime validation.
 * Unsupported types and Date bounds must be reviewed instead of erased.
 */
export function toContractJsonSchema(
  schema: z.ZodType,
  options: ContractJsonSchemaOptions = {},
): Record<string, unknown> {
  return z.toJSONSchema(schema, {
    io: options.io ?? 'output',
    unrepresentable: ({ zodSchema }) => {
      if (options.dateProjection !== 'date-to-json' || zodSchema._zod.def.type !== 'date') {
        return 'throw';
      }
      if (zodSchema._zod.def.checks?.length) {
        throw new Error('Date checks require an explicit JSON projection');
      }
      return {
        type: 'string',
        pattern: DATE_JSON_PATTERN,
        'x-revealui-runtime-type': 'Date',
        $comment:
          'Date.toJSON() serialization shape; runtime validation requires a Date instance. ' +
          'Calendar validity and business refinements remain runtime checks.',
      };
    },
  });
}
