/** Compatibility entry point: the sole verifier lives in the shared gates owner. */

export type {
  OwnerOverrideComment,
  OwnerOverrideContext,
  OwnerOverrideResult,
} from '../../../packages/harnesses/src/gates/signed-override.js';
export {
  buildOwnerOverrideComment,
  buildOwnerOverridePayload,
  OWNER_OVERRIDE_BEGIN,
  OWNER_OVERRIDE_END,
  OWNER_OVERRIDE_IDENTITY,
  OWNER_OVERRIDE_NAMESPACE,
  verifyOwnerOverrideComments,
} from '../../../packages/harnesses/src/gates/signed-override.js';
