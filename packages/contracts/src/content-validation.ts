/**
 * Lexical Content Validation
 *
 * Validates Lexical editor JSON content structure.
 * Rejects payloads with:
 * - javascript: URLs (XSS via link nodes)
 * - data: URLs (XSS via image/link nodes)
 * - vbscript: URLs
 * - Excessively deep nesting (>20 levels)
 * - Excessively large payloads (>5MB)
 *
 * This is a validation-only utility -- it returns the input unchanged if valid.
 * It does NOT transform or sanitize content.
 *
 * @packageDocumentation
 */

// =============================================================================
// Configuration
// =============================================================================

export interface ContentValidationConfig {
  /** Maximum nesting depth (default: 20) */
  maxDepth: number;
  /** Maximum payload size in bytes (default: 5MB) */
  maxSizeBytes: number;
}

const DEFAULT_CONFIG: ContentValidationConfig = {
  maxDepth: 20,
  maxSizeBytes: 5 * 1024 * 1024,
};

let config: ContentValidationConfig = { ...DEFAULT_CONFIG };

/** Override content validation configuration (useful for testing). */
export function configureContentValidation(overrides: Partial<ContentValidationConfig>): void {
  config = { ...DEFAULT_CONFIG, ...overrides };
}

/** Reset content validation configuration to defaults. */
export function resetContentValidationConfig(): void {
  config = { ...DEFAULT_CONFIG };
}

// =============================================================================
// Result Type
// =============================================================================

export interface ContentValidationResult {
  /** Whether the content passed validation */
  valid: boolean;
  /** The original input, returned unchanged when valid */
  sanitized?: unknown;
  /** Validation error messages (present when invalid) */
  errors?: string[];
}

// =============================================================================
// Dangerous URL Protocol Detection
// =============================================================================

/**
 * URL fields that may contain dangerous protocols in Lexical JSON nodes.
 * Lexical link nodes use `url`, image nodes use `src`, and some nodes use `href`.
 */
const URL_FIELD_NAMES = new Set(['url', 'src', 'href']);

/**
 * Protocols that can execute arbitrary code when rendered in a browser.
 * Checked case-insensitively with whitespace stripped (attackers use
 * `java\tscript:` and similar tricks to bypass naive checks).
 */
const DANGEROUS_PROTOCOLS = ['javascript:', 'vbscript:', 'data:'];

/**
 * Tests whether a string value contains a dangerous URL protocol.
 * Strips whitespace and control characters before comparing, since browsers
 * normalize these away (e.g., `java\x00script:alert(1)` executes).
 */
function isDangerousUrl(value: string): boolean {
  // Strip all whitespace and ASCII control characters (0x00-0x1F, 0x7F)
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional -- strip control chars that browsers silently normalize
  const normalized = value.replace(/[\s\x00-\x1f\x7f]/g, '').toLowerCase();
  return DANGEROUS_PROTOCOLS.some((protocol) => normalized.startsWith(protocol));
}

// =============================================================================
// Recursive Tree Walker
// =============================================================================

/**
 * Recursively walks a JSON tree, checking URL fields and tracking depth.
 * Collects all errors rather than failing on the first one.
 */
function walkNode(node: unknown, depth: number, path: string, errors: string[]): void {
  if (depth > config.maxDepth) {
    errors.push(`Content nesting exceeds maximum depth of ${config.maxDepth} at ${path}`);
    return;
  }

  if (node === null || node === undefined) {
    return;
  }

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      walkNode(node[i], depth + 1, `${path}[${i}]`, errors);
    }
    return;
  }

  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      const value = obj[key];

      // Check URL fields for dangerous protocols
      if (URL_FIELD_NAMES.has(key) && typeof value === 'string') {
        if (isDangerousUrl(value)) {
          errors.push(`Dangerous URL protocol detected in field "${key}" at ${path}.${key}`);
        }
      }

      // Recurse into nested objects and arrays
      if (typeof value === 'object' && value !== null) {
        walkNode(value, depth + 1, `${path}.${key}`, errors);
      }
    }
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Validates Lexical editor JSON content structure.
 *
 * Returns the input unchanged if valid (validation-only, no transformation).
 * Checks for dangerous URL protocols, excessive nesting, and payload size.
 *
 * @param content - The content to validate (typically from a POST/PATCH body)
 * @returns Validation result with errors if invalid
 */
export function validateContent(content: unknown): ContentValidationResult {
  const errors: string[] = [];

  // Null/undefined content is valid (empty content field)
  if (content === null || content === undefined) {
    return { valid: true, sanitized: content };
  }

  // Size check: serialize to JSON and measure byte length
  let serialized: string;
  try {
    serialized = JSON.stringify(content);
  } catch {
    return { valid: false, errors: ['Content is not serializable to JSON'] };
  }

  const byteLength = new TextEncoder().encode(serialized).byteLength;
  if (byteLength > config.maxSizeBytes) {
    errors.push(
      `Content size (${byteLength} bytes) exceeds maximum of ${config.maxSizeBytes} bytes`,
    );
    // Still check for other issues even if too large
  }

  // Walk the tree
  walkNode(content, 0, 'root', errors);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, sanitized: content };
}

/**
 * Validates an array of content blocks (used by pages).
 * Each block in the array is validated individually.
 *
 * @param blocks - Array of content blocks to validate
 * @returns Validation result with errors if any block is invalid
 */
export function validateBlocks(blocks: unknown): ContentValidationResult {
  // Null/undefined blocks are valid (empty blocks field)
  if (blocks === null || blocks === undefined) {
    return { valid: true, sanitized: blocks };
  }

  if (!Array.isArray(blocks)) {
    return { valid: false, errors: ['Blocks must be an array'] };
  }

  // Validate the entire blocks array as a single content tree
  return validateContent(blocks);
}
