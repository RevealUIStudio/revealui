import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { type OmarchyRuntime, SUPPORTED_HOSTS } from './types.js';

const InferenceEndpointSchema = z
  .object({
    env: z.string().min(1),
    exampleUrl: z.string().min(1),
    note: z.string().min(1).optional(),
  })
  .strict();

export const OmarchyRuntimeSchema = z
  .object({
    version: z.string().min(1),
    sku: z.null(),
    note: z.string().min(1),
    testedOn: z.literal('Omarchy Quattro'),
    supportedOn: z.array(z.enum(SUPPORTED_HOSTS)).min(1),
    inference: z
      .object({
        preferred: z.enum(['openai-compatible', 'ollama']),
        openaiCompatible: InferenceEndpointSchema,
        ollama: InferenceEndpointSchema,
        hostSnaps: InferenceEndpointSchema,
      })
      .strict(),
    install: z
      .object({
        createRevealui: z.string().min(1),
        docker: z.string().min(1),
        cursor: z.string().min(1),
      })
      .strict(),
    streamSafe: z
      .object({
        tip: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export function parseRuntime(input: unknown): OmarchyRuntime {
  return OmarchyRuntimeSchema.parse(input);
}

export function loadRuntime(filePath: string): OmarchyRuntime {
  const raw: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
  return parseRuntime(raw);
}

export function archSnapWarning(): string {
  return 'Do not reimplement Ubuntu inference snaps on Arch. Point at an OpenAI-compatible or Ollama URL, or at snaps already running on Ubuntu or WSL.';
}
