/**
 * Skill Activator
 *
 * Determines which skills to activate based on context.
 */

import { generateEmbedding } from '../../embeddings/index.js';
import type { SkillRegistry } from '../registry/index.js';
import type { Skill, SkillActivationContext, SkillActivationResult } from '../types.js';

/**
 * Configuration for skill activation.
 */
export interface SkillActivatorConfig {
  /** Registry to get skills from */
  registry: SkillRegistry;

  /** Minimum similarity score for semantic activation (0-1) */
  semanticThreshold?: number;

  /** Maximum number of skills to activate automatically */
  maxAutoActivate?: number;

  /** Enable semantic (embedding-based) activation */
  enableSemantic?: boolean;
}

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    dotProduct += aVal * bVal;
    normA += aVal * aVal;
    normB += bVal * bVal;
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Skill activator for context-based skill activation.
 */
export class SkillActivator {
  private registry: SkillRegistry;
  private semanticThreshold: number;
  private maxAutoActivate: number;
  private enableSemantic: boolean;

  constructor(config: SkillActivatorConfig) {
    this.registry = config.registry;
    this.semanticThreshold = config.semanticThreshold ?? 0.7;
    this.maxAutoActivate = config.maxAutoActivate ?? 3;
    this.enableSemantic = config.enableSemantic ?? true;
  }

  /**
   * Activate skills based on context.
   *
   * Activation methods (in priority order):
   * 1. Explicit: /skill-name syntax
   * 2. Semantic: Embedding similarity match
   * 3. File-match: Based on current file types
   * 4. Project-type: Based on project configuration
   */
  async activate(context: SkillActivationContext): Promise<SkillActivationResult> {
    const activatedSkills: Skill[] = [];
    const activationReasons: SkillActivationResult['activationReasons'] = {};

    // 1. Handle explicit skill requests (/skill-name)
    if (context.explicitSkills?.length) {
      for (const name of context.explicitSkills) {
        const skill = await this.registry.loadSkill(name);
        if (skill) {
          activatedSkills.push(skill);
          activationReasons[name] = {
            type: 'explicit',
            reason: `Explicitly requested via /${name}`,
          };
        }
      }
    }

    // 2. Semantic activation based on task description
    if (this.enableSemantic && context.taskDescription) {
      const semanticMatches = await this.findSemanticMatches(
        context.taskDescription,
        activatedSkills.map((s) => s.metadata.name), // Exclude already activated
      );

      for (const match of semanticMatches.slice(0, this.maxAutoActivate)) {
        if (!activationReasons[match.skill.metadata.name]) {
          activatedSkills.push(match.skill);
          activationReasons[match.skill.metadata.name] = {
            type: 'semantic',
            score: match.score,
            reason: `Matched task description with ${(match.score * 100).toFixed(1)}% similarity`,
          };
        }
      }
    }

    // 3. File-type based activation
    if (context.currentFiles?.length) {
      const fileMatches = this.findFileTypeMatches(
        context.currentFiles,
        activatedSkills.map((s) => s.metadata.name),
      );

      for (const match of fileMatches) {
        if (!activationReasons[match.skill.metadata.name]) {
          activatedSkills.push(match.skill);
          activationReasons[match.skill.metadata.name] = {
            type: 'file-match',
            reason: `Matched file pattern: ${match.pattern}`,
          };
        }
      }
    }

    // 4. Project-type based activation
    if (context.projectType) {
      const projectMatches = this.findProjectTypeMatches(
        context.projectType,
        activatedSkills.map((s) => s.metadata.name),
      );

      for (const match of projectMatches) {
        if (!activationReasons[match.skill.metadata.name]) {
          activatedSkills.push(match.skill);
          activationReasons[match.skill.metadata.name] = {
            type: 'project-type',
            reason: `Matched project type: ${context.projectType}`,
          };
        }
      }
    }

    return { activatedSkills, activationReasons };
  }

  /**
   * Find skills by semantic similarity to a query.
   */
  private async findSemanticMatches(
    query: string,
    excludeNames: string[],
  ): Promise<Array<{ skill: Skill; score: number }>> {
    const queryEmbedding = await generateEmbedding(query);
    const skills = this.registry.getAll();
    const matches: Array<{ skill: Skill; score: number }> = [];

    for (const skill of skills) {
      if (excludeNames.includes(skill.metadata.name)) continue;

      // Generate embedding if not present
      if (!skill.embedding) {
        const textForEmbedding = `${skill.metadata.name}: ${skill.metadata.description}\n${skill.instructions.slice(0, 500)}`;
        const result = await generateEmbedding(textForEmbedding);
        skill.embedding = result.vector;
      }

      const score = cosineSimilarity(queryEmbedding.vector, skill.embedding);

      if (score >= this.semanticThreshold) {
        matches.push({ skill, score });
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }

  /**
   * Find skills that match file types.
   */
  private findFileTypeMatches(
    files: string[],
    excludeNames: string[],
  ): Array<{ skill: Skill; pattern: string }> {
    const skills = this.registry.getAll();
    const matches: Array<{ skill: Skill; pattern: string }> = [];

    // Extract file extensions
    const extensions = new Set(
      files
        .map((f) => {
          const ext = f.split('.').pop()?.toLowerCase();
          return ext ? `.${ext}` : '';
        })
        .filter(Boolean),
    );

    // Map extensions to skill tags
    const extensionToTags: Record<string, string[]> = {
      '.ts': ['typescript', 'node', 'frontend', 'backend'],
      '.tsx': ['typescript', 'react', 'frontend'],
      '.js': ['javascript', 'node', 'frontend', 'backend'],
      '.jsx': ['javascript', 'react', 'frontend'],
      '.py': ['python', 'backend', 'ml', 'data'],
      '.rs': ['rust', 'backend', 'systems'],
      '.go': ['golang', 'backend'],
      '.sql': ['database', 'sql'],
      '.css': ['css', 'frontend', 'styling'],
      '.scss': ['sass', 'css', 'frontend', 'styling'],
      '.md': ['documentation', 'markdown'],
    };

    const relevantTags = new Set<string>();
    for (const ext of extensions) {
      const tags = extensionToTags[ext];
      if (tags) {
        for (const t of tags) {
          relevantTags.add(t);
        }
      }
    }

    for (const skill of skills) {
      if (excludeNames.includes(skill.metadata.name)) continue;

      const skillTags = skill.metadata.tags ?? [];
      const matchingTags = skillTags.filter((t) => relevantTags.has(t.toLowerCase()));

      if (matchingTags.length > 0) {
        matches.push({
          skill,
          pattern: matchingTags.join(', '),
        });
      }
    }

    return matches;
  }

  /**
   * Find skills that match project type.
   */
  private findProjectTypeMatches(
    projectType: string,
    excludeNames: string[],
  ): Array<{ skill: Skill }> {
    const skills = this.registry.getAll();
    const matches: Array<{ skill: Skill }> = [];
    const projectTypeLower = projectType.toLowerCase();

    for (const skill of skills) {
      if (excludeNames.includes(skill.metadata.name)) continue;

      const tags = skill.metadata.tags ?? [];
      const description = skill.metadata.description.toLowerCase();
      const name = skill.metadata.name.toLowerCase();

      if (
        tags.some((t) => t.toLowerCase().includes(projectTypeLower)) ||
        description.includes(projectTypeLower) ||
        name.includes(projectTypeLower)
      ) {
        matches.push({ skill });
      }
    }

    return matches;
  }

  /**
   * Parse explicit skill references from user input.
   *
   * @example
   * parseExplicitSkills("Please /react-best-practices fix this component")
   * // ["react-best-practices"]
   */
  static parseExplicitSkills(input: string): string[] {
    const matches = input.match(/\/([a-z0-9-]+)/g);
    if (!matches) return [];

    return matches.map((m) => m.slice(1)); // Remove leading slash
  }

  /**
   * Get all available skills for auto-completion.
   */
  getAvailableSkills(): Array<{ name: string; description: string }> {
    return this.registry.getAllMetadata().map((m) => ({
      name: m.name,
      description: m.description,
    }));
  }
}
