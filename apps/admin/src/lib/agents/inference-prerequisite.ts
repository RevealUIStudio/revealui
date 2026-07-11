/**
 * Create-agent prerequisite logic.
 *
 * A new agent can only run once the account has an inference provider key on
 * record (see the API Keys page). This resolves the account's key metadata into
 * the state the create flow surfaces, so the operator learns the requirement up
 * front instead of hitting a runtime failure on the first dispatch.
 */

/** Shape returned by `GET /api/user/api-keys` (no plaintext key). */
export interface InferenceKeyMetadata {
  provider: string;
  keyHint: string | null;
}

export interface InferencePrerequisite {
  /** True when the account has an inference provider key configured. */
  configured: boolean;
  /** The configured provider id, when one is present. */
  provider: string | null;
}

/**
 * Resolve the create-agent prerequisite from the account's key metadata.
 * `null` metadata (no key on record) means the prerequisite is not met.
 */
export function resolveInferencePrerequisite(
  metadata: InferenceKeyMetadata | null,
): InferencePrerequisite {
  if (!metadata) {
    return { configured: false, provider: null };
  }
  return { configured: true, provider: metadata.provider };
}

/** User-facing copy for the unmet-prerequisite warning. */
export const INFERENCE_PREREQUISITE_COPY = {
  title: 'Connect an inference provider first',
  body: 'Your agents run on the inference provider you configure. Add a provider key on the API Keys page and every agent you create will use it automatically.',
  linkLabel: 'Open API Keys',
} as const;
