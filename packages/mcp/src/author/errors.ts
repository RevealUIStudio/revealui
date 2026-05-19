/**
 * Shared error type for the `@revealui/mcp/author` Phase 1.6 stub surface.
 *
 * Every stub function in scaffold.ts / test.ts / publish.ts throws this
 * error with a clear pointer to the tracking issue + the specific module
 * the call landed in. Consumers who hit this error during integration
 * work know exactly which sub-API to wire up next.
 *
 * Per `feedback_no_risk_too_small_to_fix`: stubs MUST throw rather than
 * silently no-op. A silent no-op for a function the caller expected to do
 * work (scaffold files, run a test harness, publish a server) would create
 * a phantom success that surfaces as missing artifacts downstream.
 */

/** Tracking issue for the full author-SDK implementation surface. */
export const AUTHOR_SDK_TRACKING_ISSUE = 'https://github.com/RevealUIStudio/revealui-jv/issues/47';

export class AuthorSdkNotImplementedError extends Error {
  /** The exported function name that was called (e.g. "scaffold"). */
  readonly fn: string;
  /** The subpath module the function lives in (e.g. "@revealui/mcp/author/scaffold"). */
  readonly module: string;

  constructor(fn: string, module: string) {
    super(
      `${fn}() is not yet implemented in ${module}. The @revealui/mcp/author ` +
        'surface is stubbed in Phase 1.6 of the marketplace-extraction lane ' +
        'to claim the namespace per ADR 2026-05-18-marketplace-home L2 lock; ' +
        'the concrete implementation lands after the first external venue ' +
        `requirement surfaces (Risk R8 in the lane plan). Track via ${AUTHOR_SDK_TRACKING_ISSUE}.`,
    );
    this.name = 'AuthorSdkNotImplementedError';
    this.fn = fn;
    this.module = module;
  }
}
