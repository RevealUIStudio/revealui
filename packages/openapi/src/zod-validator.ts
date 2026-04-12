import type { Context, Env, MiddlewareHandler, ValidationTargets } from 'hono';
import { validator } from 'hono/validator';
import type { ZodType, z } from 'zod';

type HookReturn = Response | undefined;
type Hook<T, E extends Env, P extends string> = (
  result: ({ success: true; data: T } | { success: false; error: unknown; data: T }) & {
    target: keyof ValidationTargets;
  },
  c: Context<E, P>,
) => HookReturn | Promise<HookReturn>;

/**
 * Zod validation middleware for Hono.
 * Validates request data against a Zod schema and makes validated data
 * available via `c.req.valid(target)`.
 *
 * Ported from @hono/zod-validator@0.7.6
 */
interface ZodValidatorOptions<T extends ZodType> {
  validationFunction?: (
    schema: T,
    value: unknown,
  ) =>
    | Promise<{ success: boolean; data?: unknown; error?: unknown }>
    | { success: boolean; data?: unknown; error?: unknown };
}

export function zValidator<
  T extends ZodType,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
>(
  target: Target,
  schema: T,
  hook?: Hook<unknown, E, P>,
  options?: ZodValidatorOptions<T>,
): MiddlewareHandler<
  E,
  P,
  { in: { [K in Target]: z.input<T> }; out: { [K in Target]: z.output<T> } }
> {
  return validator(target, async (value: unknown, c: Context) => {
    let validatorValue = value;

    // Header keys are case-insensitive  -  map them to schema's expected casing
    if (target === 'header' && isZodObject(schema)) {
      const schemaKeys = getSchemaKeys(schema);
      const caseInsensitiveKeymap = Object.fromEntries(
        schemaKeys.map((key) => [key.toLowerCase(), key]),
      );
      validatorValue = Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, val]) => [
          caseInsensitiveKeymap[key] ?? key,
          val,
        ]),
      );
    }

    const result = options?.validationFunction
      ? await options.validationFunction(schema, validatorValue)
      : await schema.safeParseAsync(validatorValue);

    if (hook) {
      const hookResult = await hook(
        { data: validatorValue, ...result, target } as Parameters<typeof hook>[0],
        c as Parameters<typeof hook>[1],
      );
      if (hookResult) {
        if (hookResult instanceof Response) return hookResult;
        if ('response' in hookResult) return (hookResult as { response: Response }).response;
      }
    }

    if (!result.success) {
      return c.json(result, 400);
    }

    return result.data;
  }) as unknown as MiddlewareHandler<
    E,
    P,
    { in: { [K in Target]: z.input<T> }; out: { [K in Target]: z.output<T> } }
  >;
}

/** Duck-type check for Zod object schema (has _def or _zod internal property) */
function isZodObject(schema: ZodType): boolean {
  const s = schema as unknown as Record<string, unknown>;
  return '_def' in s || '_zod' in s;
}

/** Extract keys from a Zod object schema */
function getSchemaKeys(schema: ZodType): string[] {
  const s = schema as unknown as Record<string, unknown>;
  if ('in' in s && s.in && typeof s.in === 'object' && 'shape' in (s.in as object)) {
    return Object.keys((s.in as { shape: Record<string, unknown> }).shape);
  }
  if ('shape' in s && s.shape && typeof s.shape === 'object') {
    return Object.keys(s.shape as Record<string, unknown>);
  }
  return [];
}
