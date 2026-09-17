/**
 * Canonical `Database<T>` generic structure.
 *
 * Bridges Database types (from `@revealui/db`) with `@revealui/contracts`.
 * Used to avoid circular dependency between the two packages.
 *
 * The default `public.Tables` constraint is a leftover Supabase Database<>
 * shape. Neon is the SSOT; there is no product `public` schema namespace.
 * Prefer table-specific Row/Insert types from `@revealui/db` / generated
 * zod-schemas. Do not add new `Database['public']['Tables']` call sites.
 *
 * Re-exported from `database/bridge.ts` and `database/type-bridge.ts` for
 * backward compatibility with consumers of those subpaths. New code should
 * import from `@revealui/contracts/database` (which re-exports both modules)
 * or directly from this file.
 *
 * @template T - The database tables structure
 * @deprecated Supabase-compat index. Neon + Drizzle is the live store.
 */
export type Database<
  T extends {
    public: {
      Tables: Record<
        string,
        {
          Row: unknown;
          Insert: unknown;
          Update: unknown;
        }
      >;
    };
  } = {
    public: {
      Tables: Record<
        string,
        {
          Row: unknown;
          Insert: unknown;
          Update: unknown;
        }
      >;
    };
  },
> = T;
