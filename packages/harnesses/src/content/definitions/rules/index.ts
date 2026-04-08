import type { Rule } from '../../schemas/rule.js';
import { agentDispatchRule } from './agent-dispatch.js';
import { biomeRule } from './biome.js';
import { codeAnalysisPolicyRule } from './code-analysis-policy.js';
import { databaseRule } from './database.js';
import { monorepoRule } from './monorepo.js';
import { parameterizationRule } from './parameterization.js';
import { skillsUsageRule } from './skills-usage.js';
import { tailwindRule } from './tailwind.js';
import { unusedDeclarationsRule } from './unused-declarations.js';

export const rules: Rule[] = [
  agentDispatchRule,
  biomeRule,
  codeAnalysisPolicyRule,
  databaseRule,
  monorepoRule,
  parameterizationRule,
  skillsUsageRule,
  tailwindRule,
  unusedDeclarationsRule,
];
