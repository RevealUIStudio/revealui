// Placeholder — full implementation in Task 7.
// This stub exists so types.ts can resolve its circular import.

import type { Env, Schema } from 'hono';
import { Hono } from 'hono';

export class OpenAPIHono<
  E extends Env = Env,
  // biome-ignore lint/complexity/noBannedTypes: {} is Hono's internal sentinel for empty Schema — using object breaks type inference
  S extends Schema = {},
  BasePath extends string = '/',
> extends Hono<E, S, BasePath> {}
