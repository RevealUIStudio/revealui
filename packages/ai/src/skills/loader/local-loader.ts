/**
 * Local Skill Loader
 *
 * Load skills from local directories.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseSkillMd } from '../parser/index.js';
import type { SkillRegistry } from '../registry/index.js';
import type { Skill } from '../types.js';

/**
 * Options for loading from local directory.
 */
export interface LocalLoadOptions {
  /** Target directory for installation (if copying) */
  targetDir?: string;

  /** Scope: local (project) or global */
  scope: 'local' | 'global';

  /** Registry to register skill with */
  registry: SkillRegistry;

  /** Generate embedding for semantic search */
  generateEmbedding?: boolean;

  /** Copy files instead of referencing in place */
  copy?: boolean;

  /** Force reinstall if already exists */
  force?: boolean;
}

/**
 * Load a skill from a local directory.
 *
 * @param sourcePath - Path to skill directory containing SKILL.md
 * @param options - Load options
 */
export async function loadFromLocal(sourcePath: string, options: LocalLoadOptions): Promise<Skill> {
  const resolvedSource = path.resolve(sourcePath);

  // Validate source exists
  if (!fs.existsSync(resolvedSource)) {
    throw new Error(`Source directory does not exist: ${resolvedSource}`);
  }

  // Check for SKILL.md
  const skillMdPath = path.join(resolvedSource, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    throw new Error(`No SKILL.md found in ${resolvedSource}`);
  }

  // Parse skill
  const content = fs.readFileSync(skillMdPath, 'utf-8');
  const parsed = parseSkillMd(content);
  const skillName = parsed.metadata.name;

  let finalPath = resolvedSource;

  // Copy files if requested
  if (options.copy && options.targetDir) {
    const targetPath = path.join(options.targetDir, skillName);

    // Check if already exists
    if (fs.existsSync(targetPath)) {
      if (options.force) {
        fs.rmSync(targetPath, { recursive: true });
      } else {
        throw new Error(`Skill "${skillName}" already exists. Use --force to overwrite.`);
      }
    }

    // Ensure target directory exists
    if (!fs.existsSync(options.targetDir)) {
      fs.mkdirSync(options.targetDir, { recursive: true });
    }

    // Copy directory
    copyDirectory(resolvedSource, targetPath);
    finalPath = targetPath;
  }

  // Create skill object
  const skill: Skill = {
    metadata: parsed.metadata,
    instructions: parsed.instructions,
    sourcePath: finalPath,
    scope: options.scope,
    source: 'local',
    sourceIdentifier: sourcePath,
    installedAt: new Date().toISOString(),
  };

  // Register with registry
  if (options.registry.has(skillName)) {
    options.registry.unregister(skillName);
  }
  options.registry.register(skill);

  // Load fully (with resources and optionally embedding)
  return (await options.registry.loadSkill(skillName, options.generateEmbedding)) ?? skill;
}

/**
 * Load all skills from a directory.
 *
 * @param dir - Directory containing skill subdirectories
 * @param options - Load options
 */
export async function loadAllFromDirectory(
  dir: string,
  options: Omit<LocalLoadOptions, 'copy'>,
): Promise<Skill[]> {
  const resolvedDir = path.resolve(dir);

  if (!fs.existsSync(resolvedDir)) {
    return [];
  }

  const entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
  const skills: Skill[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillPath = path.join(resolvedDir, entry.name);
    const skillMdPath = path.join(skillPath, 'SKILL.md');

    if (!fs.existsSync(skillMdPath)) continue;

    try {
      const skill = await loadFromLocal(skillPath, {
        ...options,
        copy: false, // Don't copy when loading from installed directory
      });
      skills.push(skill);
    } catch {
      // Skip malformed or unreadable skill files — partial load is better than a hard crash
    }
  }

  return skills;
}

/**
 * Create a new skill from a template.
 */
export async function createSkill(
  name: string,
  targetDir: string,
  template?: SkillTemplate,
): Promise<string> {
  const skillDir = path.join(targetDir, name);

  if (fs.existsSync(skillDir)) {
    throw new Error(`Directory already exists: ${skillDir}`);
  }

  fs.mkdirSync(skillDir, { recursive: true });

  // Create SKILL.md
  const skillMd = template?.skillMd ?? generateDefaultSkillMd(name);
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillMd);

  // Create optional directories
  if (template?.createScripts) {
    fs.mkdirSync(path.join(skillDir, 'scripts'));
  }

  if (template?.createReferences) {
    fs.mkdirSync(path.join(skillDir, 'references'));
  }

  if (template?.createAssets) {
    fs.mkdirSync(path.join(skillDir, 'assets'));
  }

  return skillDir;
}

/**
 * Template for creating new skills.
 */
export interface SkillTemplate {
  skillMd?: string;
  createScripts?: boolean;
  createReferences?: boolean;
  createAssets?: boolean;
}

/**
 * Generate a default SKILL.md file.
 */
function generateDefaultSkillMd(name: string): string {
  return `---
name: ${name}
description: A new skill for agents
version: "0.1.0"
compatibility:
  - universal
---

# ${name}

Instructions for the agent go here.

## Overview

Describe what this skill does.

## Usage

Explain how to use this skill.
`;
}

/**
 * Copy a directory recursively.
 */
function copyDirectory(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // Skip .git directory
      if (entry.name === '.git') continue;
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Remove an installed skill.
 */
export function removeSkill(name: string, registry: SkillRegistry): boolean {
  const skill = registry.get(name);
  if (!skill) {
    return false;
  }

  // Remove from filesystem
  if (fs.existsSync(skill.sourcePath)) {
    fs.rmSync(skill.sourcePath, { recursive: true });
  }

  // Unregister
  registry.unregister(name);

  return true;
}
