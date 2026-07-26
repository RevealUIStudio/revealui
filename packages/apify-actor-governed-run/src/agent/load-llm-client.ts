/**
 * Lazily load `@revealui/ai`'s `LLMClient`.
 *
 * `@revealui/ai` is declared under `optionalDependencies` (package.json)
 * because `verify-receipt` mode never needs it -- only `run-task` mode does.
 * A top-level static import (the original shape, `main.ts:1`) defeated that:
 * it made the whole actor process fail to even start without `@revealui/ai`
 * present, textually satisfying the optional-dependency declaration while
 * breaking its actual contract (GAP-431 guardrail-2 hygiene finding). This
 * makes the optionality real -- `run-task` mode fails with a clear,
 * actionable error instead of a bare module-resolution crash, and
 * `verify-receipt` mode is entirely unaffected either way.
 */
export async function loadLLMClient(): Promise<typeof import('@revealui/ai').LLMClient> {
  try {
    const mod = await import('@revealui/ai');
    return mod.LLMClient;
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(
      `run-task mode requires @revealui/ai, which could not be loaded (${cause}). ` +
        '@revealui/ai is an optionalDependency of this package because verify-receipt ' +
        'mode does not need it -- install it to use run-task mode.',
    );
  }
}
