/**
 * Extract plain text from ACP ContentBlock arrays (session/prompt).
 * No-regex: structural checks only.
 */

export interface TextContentBlock {
  type: 'text';
  text: string;
}

export function isTextContentBlock(value: unknown): value is TextContentBlock {
  if (value === null || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.type === 'text' && typeof record.text === 'string';
}

/**
 * Join all text content blocks. Non-text blocks are ignored (media deferred).
 */
export function extractPromptText(prompt: unknown): string {
  if (typeof prompt === 'string') return prompt;
  if (!Array.isArray(prompt)) return '';
  const parts: string[] = [];
  for (const block of prompt) {
    if (isTextContentBlock(block)) {
      parts.push(block.text);
    }
  }
  return parts.join('\n');
}
