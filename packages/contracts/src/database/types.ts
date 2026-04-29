/**
 * Canonical `Database<T>` generic structure.
 *
 * Bridges Database types (from `@revealui/db`) with `@revealui/contracts`.
 * Used to avoid circular dependency between the two packages.
 *
 * Re-exported from `database/bridge.ts` and `database/type-bridge.ts` for
 * backward compatibility with consumers of those subpaths. New code should
 * import from `@revealui/contracts/database` (which re-exports both modules)
 * or directly from this file.
 *
 * @template T - The database tables structure
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
