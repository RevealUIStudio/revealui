import type { Rule } from '../../schemas/rule.js';
import { adapterOnlyRule } from './adapter-only.js';
import { agentDispatchRule } from './agent-dispatch.js';
import { biomeRule } from './biome.js';
import { codeAnalysisPolicyRule } from './code-analysis-policy.js';
import { codeOverDocsRule } from './code-over-docs.js';
import { databaseRule } from './database.js';
import { dispositionActionsRule } from './disposition-actions.js';
import { durableSolutionsRule } from './durable-solutions.js';
import { monorepoRule } from './monorepo.js';
import { parameterizationRule } from './parameterization.js';
import { qualityOverSpeedRule } from './quality-over-speed.js';
import { skillsUsageRule } from './skills-usage.js';
import { tailwindRule } from './tailwind.js';
import { trackerFirstRule } from './tracker-first.js';
import { unusedDeclarationsRule } from './unused-declarations.js';

export const rules: Rule[] = [
  adapterOnlyRule,
  agentDispatchRule,
  biomeRule,
  codeAnalysisPolicyRule,
  codeOverDocsRule,
  databaseRule,
  dispositionActionsRule,
  durableSolutionsRule,
  monorepoRule,
  parameterizationRule,
  qualityOverSpeedRule,
  skillsUsageRule,
  tailwindRule,
  trackerFirstRule,
  unusedDeclarationsRule,
];
