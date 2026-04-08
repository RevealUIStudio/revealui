/**
 * Skill Registry
 *
 * Central registry for managing installed skills.
 * Follows the pattern from tools/registry.ts.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { generateEmbedding } from '../../embeddings/index.js';
import { parseSkillMd, parseSkillMetadataOnly } from '../parser/index.js';
import type { Skill, SkillMetadata, SkillResource } from '../types.js';

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
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
 * Storage location configuration.
 */
export interface SkillStorageConfig {
  /** Global skill directory (default: ~/.revealui/skills/) */
  globalDir?: string;

  /** Project-local skill directory (default: .revealui/skills/) */
  localDir?: string;

  /** Project root for resolving local paths */
  projectRoot?: string;
}

/**
 * Skill registry for managing installed skills.
 */
export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();
  private metadataCache: Map<string, SkillMetadata> = new Map();
  /** Maps skill name (metadata or directory) to directory path */
  private nameToPath: Map<string, string> = new Map();
  private globalDir: string;
  private localDir: string;
  private projectRoot: string;

  constructor(config: SkillStorageConfig = {}) {
    this.globalDir = config.globalDir ?? path.join(os.homedir(), '.revealui', 'skills');
    this.localDir = config.localDir ?? '.revealui/skills';
    this.projectRoot = config.projectRoot ?? process.cwd();
  }

  /**
   * Get the resolved local directory path.
   */
  private getLocalDirPath(): string {
    return path.resolve(this.projectRoot, this.localDir);
  }

  /**
   * Register a skill.
   *
   * @throws Error if skill name already registered
   */
  register(skill: Skill): void {
    if (this.skills.has(skill.metadata.name)) {
      throw new Error(`Skill with name "${skill.metadata.name}" is already registered`);
    }
    this.skills.set(skill.metadata.name, skill);
    this.metadataCache.set(skill.metadata.name, skill.metadata);
  }

  /**
   * Unregister a skill by name.
   */
  unregister(name: string): void {
    this.skills.delete(name);
    this.metadataCache.delete(name);
  }

  /**
   * Get a skill by name.
   */
  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  /**
   * Check if a skill exists.
   */
  has(name: string): boolean {
    return this.skills.has(name);
  }

  /**
   * Get all registered skills.
   */
  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get all skill names.
   */
  getNames(): string[] {
    return Array.from(this.skills.keys());
  }

  /**
   * Load all skill metadata from disk (lightweight).
   * Only loads frontmatter, not full instructions.
   */
  async loadAllMetadata(): Promise<void> {
    this.metadataCache.clear();
    this.nameToPath.clear();

    // Load from both global and local directories
    await this.loadMetadataFromDirectory(this.globalDir, 'global');
    await this.loadMetadataFromDirectory(this.getLocalDirPath(), 'local');
  }

  /**
   * Load metadata from a specific directory.
   */
  private async loadMetadataFromDirectory(dir: string, scope: 'local' | 'global'): Promise<void> {
    if (!fs.existsSync(dir)) {
      return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillDirPath = path.join(dir, entry.name);
      const skillMdPath = path.join(skillDirPath, 'SKILL.md');
      if (!fs.existsSync(skillMdPath)) continue;

      try {
        const content = fs.readFileSync(skillMdPath, 'utf-8');
        const metadata = parseSkillMetadataOnly(content);

        // Local skills override global ones
        if (scope === 'local' || !this.metadataCache.has(metadata.name)) {
          this.metadataCache.set(metadata.name, metadata);
          // Map both directory name and metadata name to the path
          this.nameToPath.set(entry.name, skillDirPath);
          this.nameToPath.set(metadata.name, skillDirPath);
        }
      } catch {
        // Skip directories with missing or invalid skill.json — registry remains partial
      }
    }
  }

  /**
   * Get all loaded metadata (lightweight listing).
   */
  getAllMetadata(): SkillMetadata[] {
    return Array.from(this.metadataCache.values());
  }

  /**
   * Get metadata for a specific skill.
   */
  getMetadata(name: string): SkillMetadata | undefined {
    return this.metadataCache.get(name);
  }

  /**
   * Load a full skill from disk (including instructions and resources).
   *
   * @param name - Skill name (metadata name or directory name)
   * @param generateEmbed - Whether to generate embedding for the skill
   */
  async loadSkill(name: string, generateEmbed = false): Promise<Skill | undefined> {
    // Check if already loaded by metadata name
    if (this.skills.has(name)) {
      return this.skills.get(name);
    }

    // Try to find the skill path using the name mapping
    let skillPath = this.nameToPath.get(name);
    let scope: 'local' | 'global' = 'local';

    if (skillPath) {
      // Determine scope from path
      scope = skillPath.startsWith(this.globalDir) ? 'global' : 'local';
    } else {
      // Fallback: try directory name directly (for skills not yet in cache)
      skillPath = path.join(this.getLocalDirPath(), name);

      if (!fs.existsSync(path.join(skillPath, 'SKILL.md'))) {
        skillPath = path.join(this.globalDir, name);
        scope = 'global';

        if (!fs.existsSync(path.join(skillPath, 'SKILL.md'))) {
          return undefined;
        }
      }
    }

    const skillMdPath = path.join(skillPath, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) {
      return undefined;
    }

    const content = fs.readFileSync(skillMdPath, 'utf-8');
    const parsed = parseSkillMd(content);

    // Check if already loaded by the actual metadata name
    if (this.skills.has(parsed.metadata.name)) {
      return this.skills.get(parsed.metadata.name);
    }

    // Load resources
    const resources = await this.loadResources(skillPath);

    // Generate embedding if requested
    let embedding: number[] | undefined;
    if (generateEmbed) {
      const textForEmbedding = `${parsed.metadata.name}: ${parsed.metadata.description}\n${parsed.instructions.slice(0, 500)}`;
      const result = await generateEmbedding(textForEmbedding);
      embedding = result.vector;
    }

    const skill: Skill = {
      metadata: parsed.metadata,
      instructions: parsed.instructions,
      sourcePath: skillPath,
      scope,
      resources,
      embedding,
      installedAt: this.getInstallDate(skillPath),
    };

    this.register(skill);

    // Update name mapping with both names
    this.nameToPath.set(parsed.metadata.name, skillPath);
    this.nameToPath.set(path.basename(skillPath), skillPath);

    return skill;
  }

  /**
   * Load all skills from disk (full loading).
   */
  async loadAllSkills(generateEmbeddings = false): Promise<void> {
    // First ensure metadata is loaded
    if (this.metadataCache.size === 0) {
      await this.loadAllMetadata();
    }

    // Load each skill fully using metadata names
    for (const name of this.metadataCache.keys()) {
      // Skip if already loaded
      if (!this.skills.has(name)) {
        await this.loadSkill(name, generateEmbeddings);
      }
    }
  }

  /**
   * Load resources from a skill directory.
   */
  private async loadResources(skillPath: string): Promise<SkillResource[]> {
    const resources: SkillResource[] = [];

    const resourceDirs: Array<{ dir: string; type: SkillResource['type'] }> = [
      { dir: 'scripts', type: 'script' },
      { dir: 'references', type: 'reference' },
      { dir: 'assets', type: 'asset' },
      { dir: 'templates', type: 'template' },
      { dir: 'schemas', type: 'schema' },
    ];

    for (const { dir, type } of resourceDirs) {
      const dirPath = path.join(skillPath, dir);
      if (!fs.existsSync(dirPath)) continue;

      const files = this.walkDirectory(dirPath);
      for (const file of files) {
        resources.push({
          path: path.relative(skillPath, file),
          type,
          // Content loaded on demand
        });
      }
    }

    return resources;
  }

  /**
   * Recursively walk a directory.
   */
  private walkDirectory(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...this.walkDirectory(fullPath));
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Get install date from directory stats.
   */
  private getInstallDate(skillPath: string): string | undefined {
    try {
      const stats = fs.statSync(skillPath);
      return stats.birthtime.toISOString();
    } catch {
      return undefined;
    }
  }

  /**
   * Search skills by embedding similarity.
   *
   * @param query - Search query text
   * @param threshold - Minimum similarity score (default 0.7)
   * @param limit - Maximum results to return
   */
  async searchByEmbedding(
    query: string,
    threshold = 0.7,
    limit = 10,
  ): Promise<Array<{ skill: Skill; score: number }>> {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);

    // Load all skills with embeddings if not already loaded
    const skills = this.getAll();
    const results: Array<{ skill: Skill; score: number }> = [];

    for (const skill of skills) {
      // Generate embedding if missing
      if (!skill.embedding) {
        const textForEmbedding = `${skill.metadata.name}: ${skill.metadata.description}\n${skill.instructions.slice(0, 500)}`;
        const result = await generateEmbedding(textForEmbedding);
        skill.embedding = result.vector;
      }

      const score = cosineSimilarity(queryEmbedding.vector, skill.embedding);

      if (score >= threshold) {
        results.push({ skill, score });
      }
    }

    // Sort by score descending and limit
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Search skills by keyword matching.
   */
  searchByKeyword(query: string): Skill[] {
    const queryLower = query.toLowerCase();
    const results: Array<{ skill: Skill; relevance: number }> = [];

    for (const skill of this.skills.values()) {
      let relevance = 0;

      // Check name
      if (skill.metadata.name.toLowerCase().includes(queryLower)) {
        relevance += 10;
      }

      // Check description
      if (skill.metadata.description.toLowerCase().includes(queryLower)) {
        relevance += 5;
      }

      // Check tags
      if (skill.metadata.tags?.some((tag) => tag.toLowerCase().includes(queryLower))) {
        relevance += 3;
      }

      // Check instructions
      if (skill.instructions.toLowerCase().includes(queryLower)) {
        relevance += 1;
      }

      if (relevance > 0) {
        results.push({ skill, relevance });
      }
    }

    return results.sort((a, b) => b.relevance - a.relevance).map((r) => r.skill);
  }

  /**
   * Get the installation directory for a skill.
   */
  getSkillDirectory(name: string, scope: 'local' | 'global' = 'local'): string {
    if (scope === 'local') {
      return path.join(this.getLocalDirPath(), name);
    }
    return path.join(this.globalDir, name);
  }

  /**
   * Ensure a directory exists.
   */
  ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Clear the registry (for testing).
   */
  clear(): void {
    this.skills.clear();
    this.metadataCache.clear();
    this.nameToPath.clear();
  }
}

/**
 * Global skill registry instance.
 */
export const globalSkillRegistry = new SkillRegistry();
