/**
 * @revealui/cli/codemods — migration transform infrastructure.
 *
 * Public entry point. `revealui migrate` consumes this module; authors of
 * individual codemods place their transforms under `./transforms/` and
 * register them in `./registry.ts`.
 */

export { getCodemod, registry } from './registry.js';
export { listApplicableCodemods, readInstalledVersion, runCodemods } from './runner.js';
export type {
  Codemod,
  CodemodApi,
  CodemodFileResult,
  CodemodLogger,
  CodemodRunResult,
} from './types.js';
