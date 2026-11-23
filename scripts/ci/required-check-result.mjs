/**
 * Decision for the required `*-result` jobs and the Docker images summary.
 *
 * The workflow checks this file out from the base commit and runs it.
 * Inputs arrive as environment variables. The script does not read the
 * pull request tree.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @typedef {'unit' | 'build' | 'migrations' | 'integration' | 'e2e-smoke' | 'e2e-accessibility' | 'e2e-visual' | 'coverage' | 'docker'} CheckId */

/**
 * @typedef {Object} RequiredResultInput
 * @property {string} check
 * @property {string} changes
 * @property {string} fullSuite
 * @property {string} result
 * @property {string} eventName
 * @property {string} ref
 * @property {string} baseRef
 */

/**
 * @typedef {Object} RequiredResultDecision
 * @property {boolean} ok
 * @property {string} message
 */

/** @type {Record<string, string>} */
const LABELS = {
  unit: 'Unit Tests',
  build: 'Build',
  migrations: 'Drizzle Migrations',
  integration: 'Integration Tests',
  'e2e-smoke': 'E2E Smoke',
  'e2e-accessibility': 'Accessibility (E2E)',
  'e2e-visual': 'Visual Regression (E2E)',
  coverage: 'Coverage',
  docker: 'Docker images',
};

const STANDARD_CHECKS = new Set([
  'unit',
  'build',
  'migrations',
  'e2e-smoke',
  'e2e-accessibility',
  'e2e-visual',
]);

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {RequiredResultInput}
 */
export function inputFromEnv(env) {
  return {
    check: env.CHECK ?? '',
    changes: env.CHANGES ?? '',
    fullSuite: env.FULL_SUITE ?? '',
    result: env.RESULT ?? '',
    eventName: env.EVENT_NAME ?? '',
    ref: env.REF ?? '',
    baseRef: env.BASE_REF ?? '',
  };
}

/**
 * @param {RequiredResultInput} input
 * @returns {RequiredResultDecision}
 */
export function evaluateRequiredResult(input) {
  const label = LABELS[input.check];
  if (!label) {
    return { ok: false, message: `unknown check: ${input.check}` };
  }

  if (input.check === 'docker') {
    if (input.result === 'success') return { ok: true, message: 'image builds green' };
    if (input.result === 'skipped') {
      return { ok: true, message: 'image-irrelevant diff, builds skipped' };
    }
    return { ok: false, message: `build-and-push result: ${input.result}` };
  }

  if (input.changes !== 'success') {
    return { ok: false, message: `changes job result: ${input.changes}` };
  }

  if (input.result === 'success') {
    return { ok: true, message: `${label} green` };
  }

  if (input.check === 'integration') {
    const scheduled =
      input.fullSuite === 'true' &&
      (input.eventName === 'pull_request' || input.ref === 'refs/heads/main');
    if (input.result === 'skipped' && !scheduled) {
      return {
        ok: true,
        message:
          'Integration Tests skipped (docs/copy, promote, push-to-test, or SHA already covered)',
      };
    }
    return {
      ok: false,
      message: `Integration Tests result: ${input.result} full_suite=${input.fullSuite} scheduled=${scheduled}`,
    };
  }

  if (input.check === 'coverage') {
    const scheduled =
      input.fullSuite === 'true' && (input.ref === 'refs/heads/main' || input.baseRef === 'main');
    if (input.result === 'skipped' && !scheduled) {
      return {
        ok: true,
        message: 'Coverage skipped (not a main/promote full suite, or docs/copy)',
      };
    }
    return {
      ok: false,
      message: `Coverage result: ${input.result} full_suite=${input.fullSuite} scheduled=${scheduled}`,
    };
  }

  if (!STANDARD_CHECKS.has(input.check)) {
    return { ok: false, message: `unknown check: ${input.check}` };
  }

  if (input.result === 'skipped' && input.fullSuite !== 'true') {
    return {
      ok: true,
      message: `${label} skipped (docs/copy, promote, or SHA already covered)`,
    };
  }

  return {
    ok: false,
    message: `${label} result: ${input.result} full_suite=${input.fullSuite}`,
  };
}

function main() {
  const decision = evaluateRequiredResult(inputFromEnv(process.env));
  process.stdout.write(`${decision.message}\n`);
  process.exit(decision.ok ? 0 : 1);
}

const thisFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedFile === thisFile) {
  main();
}
