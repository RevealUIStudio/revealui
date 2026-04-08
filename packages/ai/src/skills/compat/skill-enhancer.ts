/**
 * Skill Enhancer
 *
 * Add RevealUI-specific enhancements to Vercel skills.
 */

import { generateEmbedding } from '../../embeddings/index.js';
import type { Skill } from '../types.js';

/**
 * Generate embeddings for a Vercel skill.
 *
 * Vercel skills don't have embeddings by default, but RevealUI uses them
 * for semantic search. This function adds that capability.
 *
 * @param skill - Skill to enhance
 * @returns Skill with embedding
 */
export async function generateEmbeddingsForVercelSkill(skill: Skill): Promise<Skill> {
  // Skip if already has embedding
  if (skill.embedding) {
    return skill;
  }

  // Create text representation for embedding
  const textForEmbedding = [
    skill.metadata.name,
    skill.metadata.description,
    skill.metadata.tags?.join(' ') ?? '',
    skill.instructions.slice(0, 1000), // First 1000 chars of instructions
  ]
    .filter(Boolean)
    .join('\n');

  // Generate embedding
  const result = await generateEmbedding(textForEmbedding);

  return {
    ...skill,
    embedding: result.vector,
  };
}

/**
 * Enhance multiple skills with embeddings.
 *
 * @param skills - Skills to enhance
 * @param concurrency - Number of concurrent embedding generations
 * @returns Enhanced skills
 */
export async function batchGenerateEmbeddings(skills: Skill[], concurrency = 5): Promise<Skill[]> {
  const enhanced: Skill[] = [];

  // Process in batches
  for (let i = 0; i < skills.length; i += concurrency) {
    const batch = skills.slice(i, i + concurrency);
    const enhancedBatch = await Promise.all(
      batch.map((skill) => generateEmbeddingsForVercelSkill(skill)),
    );
    enhanced.push(...enhancedBatch);
  }

  return enhanced;
}

/**
 * Enhance a skill with additional metadata.
 *
 * @param skill - Skill to enhance
 * @param enhancements - Additional metadata to add
 * @returns Enhanced skill
 */
export function enhanceSkillMetadata(
  skill: Skill,
  enhancements: {
    tags?: string[];
    compatibility?: Array<
      | 'claude-code'
      | 'cursor'
      | 'windsurf'
      | 'cline'
      | 'copilot'
      | 'openai'
      | 'anthropic'
      | 'universal'
    >;
    minContextWindow?: number;
  },
): Skill {
  const enhanced = { ...skill };

  if (enhancements.tags) {
    enhanced.metadata.tags = [...(enhanced.metadata.tags ?? []), ...enhancements.tags];
  }

  if (enhancements.compatibility) {
    enhanced.metadata.compatibility = [
      ...(enhanced.metadata.compatibility ?? []),
      ...enhancements.compatibility,
    ];
  }

  if (enhancements.minContextWindow !== undefined) {
    enhanced.metadata.minContextWindow = enhancements.minContextWindow;
  }

  return enhanced;
}
