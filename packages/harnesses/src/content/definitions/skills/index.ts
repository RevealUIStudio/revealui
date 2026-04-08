import type { Skill } from '../../schemas/skill.js';
import { dbMigrateSkill } from './db-migrate.js';
import { preflightSkill } from './preflight.js';
import { revealuiConventionsSkill } from './revealui-conventions.js';
import { revealuiDbSkill } from './revealui-db.js';
import { revealuiDebuggingSkill } from './revealui-debugging.js';
import { revealuiReviewSkill } from './revealui-review.js';
import { revealuiSafetySkill } from './revealui-safety.js';
import { revealuiTddSkill } from './revealui-tdd.js';
import { revealuiTestingSkill } from './revealui-testing.js';
import { tailwind4DocsSkill } from './tailwind-4-docs.js';

export const skills: Skill[] = [
  dbMigrateSkill,
  preflightSkill,
  revealuiConventionsSkill,
  revealuiDbSkill,
  revealuiDebuggingSkill,
  revealuiReviewSkill,
  revealuiSafetySkill,
  revealuiTddSkill,
  revealuiTestingSkill,
  tailwind4DocsSkill,
];
