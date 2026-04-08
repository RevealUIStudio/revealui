import type { Manifest } from '../schemas/manifest.js';
import { agents } from './agents/index.js';
import { commands } from './commands/index.js';
import { preambles } from './preambles/index.js';
import { rules } from './rules/index.js';
import { skills } from './skills/index.js';

/** Build a complete manifest from all canonical definitions. */
export function buildManifest(): Manifest {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    rules,
    commands,
    agents,
    skills,
    preambles,
  };
}

export { agents, commands, preambles, rules, skills };
