import type { Rule } from '../../schemas/rule.js';
import { adapterOnlyRule } from './adapter-only.js';
import { agentDispatchRule } from './agent-dispatch.js';
import { aiMechanicsRule } from './ai-mechanics.js';
import { biomeRule } from './biome.js';
import { codeAnalysisPolicyRule } from './code-analysis-policy.js';
import { codeOverDocsRule } from './code-over-docs.js';
import { databaseRule } from './database.js';
import { dispositionActionsRule } from './disposition-actions.js';
import { durableSolutionsRule } from './durable-solutions.js';
import { monorepoRule } from './monorepo.js';
import { parameterizationRule } from './parameterization.js';
import { publicIssueRedactionRule } from './public-issue-redaction.js';
import { qualityOverSpeedRule } from './quality-over-speed.js';
import { skillsUsageRule } from './skills-usage.js';
import { streamSafeSecretsRule } from './stream-safe-secrets.js';
import { tailwindRule } from './tailwind.js';
import { tokenEconomyRule } from './token-economy.js';
import { trackerFirstRule } from './tracker-first.js';
import { unusedDeclarationsRule } from './unused-declarations.js';

export const rules: Rule[] = [
  adapterOnlyRule,
  agentDispatchRule,
  aiMechanicsRule,
  biomeRule,
  codeAnalysisPolicyRule,
  codeOverDocsRule,
  databaseRule,
  dispositionActionsRule,
  durableSolutionsRule,
  monorepoRule,
  parameterizationRule,
  publicIssueRedactionRule,
  qualityOverSpeedRule,
  skillsUsageRule,
  streamSafeSecretsRule,
  tailwindRule,
  tokenEconomyRule,
  trackerFirstRule,
  unusedDeclarationsRule,
];
