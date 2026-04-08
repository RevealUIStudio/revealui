import type { Command } from '../../schemas/command.js';
import { auditCommand } from './audit.js';
import { gateCommand } from './gate.js';
import { newPackageCommand } from './new-package.js';
import { stripeBestPracticesCommand } from './stripe-best-practices.js';

export const commands: Command[] = [
  auditCommand,
  gateCommand,
  newPackageCommand,
  stripeBestPracticesCommand,
];
