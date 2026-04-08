import type { Agent } from '../../schemas/agent.js';
import { builderAgent } from './builder.js';
import { docsSyncAgent } from './docs-sync.js';
import { gateRunnerAgent } from './gate-runner.js';
import { linterAgent } from './linter.js';
import { securityReviewerAgent } from './security-reviewer.js';
import { testerAgent } from './tester.js';

export const agents: Agent[] = [
  builderAgent,
  docsSyncAgent,
  gateRunnerAgent,
  linterAgent,
  securityReviewerAgent,
  testerAgent,
];
