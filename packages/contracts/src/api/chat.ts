/**
 * Chat API Contracts
 *
 * Validation contracts for chat/AI endpoints
 */

import { z } from 'zod/v4';
import { createContract } from '../foundation/contract.js';

/** Plain text content part */
const TextPartSchema = z.object({
  type: z.literal('text'),
  text: z.string().min(1),
});

/** Image content part  -  base64 data URL or HTTPS URL.
 *  Used with vision-capable models (inference-snaps gemma3/qwen-vl, GPT-4o, etc.) */
const ImagePartSchema = z.object({
  type: z.literal('image_url'),
  image_url: z.object({
    url: z.string().min(1),
    detail: z.enum(['low', 'high', 'auto']).optional(),
  }),
});

const ContentPartSchema = z.discriminatedUnion('type', [TextPartSchema, ImagePartSchema]);

export type ContentPart = z.infer<typeof ContentPartSchema>;

/**
 * Chat message schema
 *
 * Content may be a plain string or a multipart array (text + images).
 * Multipart content is passed through to OpenAI-compatible providers,
 * enabling vision models such as gemma3, qwen-vl, and GPT-4o.
 */
export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.union([
    z.string().min(1, 'Message content cannot be empty'),
    z.array(ContentPartSchema).min(1, 'Content parts cannot be empty'),
  ]),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/** Returns true if the content is non-empty (handles both string and part array). */
function hasContent(content: string | ContentPart[]): boolean {
  if (typeof content === 'string') return content.trim().length > 0;
  // Array is valid when it has at least one text or image part
  return content.some((p) => (p.type === 'text' ? p.text.trim().length > 0 : true));
}

/** Returns the total text character count (for length validation). */
function textLength(content: string | ContentPart[]): number {
  if (typeof content === 'string') return content.length;
  return content
    .filter((p): p is z.infer<typeof TextPartSchema> => p.type === 'text')
    .reduce((sum, p) => sum + p.text.length, 0);
}

/**
 * Chat request validation
 *
 * Validates chat request with:
 * - Non-empty array of messages
 * - Each message has role and content
 * - Last message must be from user
 * - Last message text content max 4000 characters
 */
export const ChatRequestSchema = z
  .object({
    messages: z.array(ChatMessageSchema).min(1, 'Messages must be a non-empty array'),
  })
  .refine(
    (data) => {
      const lastMessage = data.messages[data.messages.length - 1];
      return lastMessage?.role === 'user';
    },
    {
      message: 'Last message must be from user',
      path: ['messages'],
    },
  )
  .refine(
    (data) => {
      const lastMessage = data.messages[data.messages.length - 1];
      return lastMessage != null && hasContent(lastMessage.content);
    },
    {
      message: 'Message content must be non-empty',
      path: ['messages'],
    },
  )
  .refine(
    (data) => {
      const lastMessage = data.messages[data.messages.length - 1];
      return lastMessage != null && textLength(lastMessage.content) <= 4000;
    },
    {
      message: 'Message too long (max 4000 characters)',
      path: ['messages'],
    },
  );

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatRequestContract = createContract({
  name: 'ChatRequest',
  version: '1',
  description: 'Validates chat request with messages',
  schema: ChatRequestSchema,
});
