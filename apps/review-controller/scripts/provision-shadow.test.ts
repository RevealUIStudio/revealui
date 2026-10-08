import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  importSecrets,
  makeProvisionPlan,
  validateLiveWorkflowConfig,
} from './provision-shadow.js';

const config = {
  flyApp: 'revealui-review-controller',
  repositoryFullName: 'RevealUIStudio/revealui',
  repositoryId: 1127197866,
  policyVersion: 'revealui-review-receipt-shadow-v1',
  maxLifetimeMs: 21_600_000,
  requiredChecks: [
    {
      name: 'CI Feedback',
      appId: 15368,
      workflowId: 220400161,
      workflowPath: '.github/workflows/ci.yml',
      event: 'pull_request',
    },
    { name: 'CodeQL', appId: 57789 },
    ...['Security Gate', 'Dependency Review', 'Secret Scanning (Gitleaks)'].map((name) => ({
      name,
      appId: 15368,
      workflowId: 220400166,
      workflowPath: '.github/workflows/security.yml',
      event: 'pull_request',
    })),
  ],
};

describe('shadow signer provisioning', () => {
  it('checks the current repository and workflow identities before writing secrets', () => {
    const calls: string[] = [];
    const runGitHub = ((_file: string, args: readonly string[]) => {
      const path = args[1] ?? '';
      calls.push(path);
      if (path === 'repos/RevealUIStudio/revealui')
        return JSON.stringify({ id: 1127197866, full_name: 'RevealUIStudio/revealui' });
      if (path.endsWith('/220400161'))
        return JSON.stringify({ id: 220400161, path: '.github/workflows/ci.yml', state: 'active' });
      if (path.endsWith('/220400166'))
        return JSON.stringify({
          id: 220400166,
          path: '.github/workflows/security.yml',
          state: 'active',
        });
      throw new Error(`unexpected path ${path}`);
    }) as typeof import('node:child_process').execFileSync;
    validateLiveWorkflowConfig(config, runGitHub);
    expect(calls).toHaveLength(3);
    expect(() => validateLiveWorkflowConfig({ ...config, repositoryId: 9 }, runGitHub)).toThrow(
      'configured repository identity changed',
    );
  });

  it('generates a distinct Ed25519 key and validates the full shadow policy before import', () => {
    const plan = makeProvisionPlan(config, 'revealui-review-controller-test-key');
    expect(plan.app).toBe('revealui-review-controller');
    expect(plan.publicPath).toContain('trusted-keys/revealui-review-controller-test-key.pem');
    const privateKey = createPrivateKey(plan.secrets.REVIEW_RECEIPT_PRIVATE_KEY);
    const publicKey = createPublicKey(plan.publicPem);
    expect(privateKey.asymmetricKeyType).toBe('ed25519');
    expect(
      verify(
        null,
        Buffer.from('receipt-test'),
        publicKey,
        sign(null, Buffer.from('receipt-test'), privateKey),
      ),
    ).toBe(true);
    expect(plan.secrets.REVIEW_RECEIPT_MODE).toBe('shadow');
    expect(() => makeProvisionPlan({ ...config, requiredChecks: [] }, 'new-key')).toThrow(
      'REVIEW_RECEIPT_REQUIRED_CHECKS',
    );
    expect(() => makeProvisionPlan(config, '../unsafe')).toThrow('invalid receipt key ID');
  });

  it('streams all secrets to Fly in one import without placing values in command arguments', async () => {
    const child = new EventEmitter() as ChildProcess;
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    Object.assign(child, { stdin, stdout, stderr });
    let command = '';
    let args: readonly string[] = [];
    let input = '';
    stdin.on('data', (chunk: Buffer) => {
      input += chunk.toString();
    });
    stdin.on('end', () => child.emit('close', 0));
    const run = ((file: string, argv: readonly string[], _options: SpawnOptions) => {
      command = file;
      args = argv;
      return child;
    }) as typeof import('node:child_process').spawn;
    await importSecrets(
      'revealui-review-controller',
      {
        REVIEW_RECEIPT_MODE: 'shadow',
        REVIEW_RECEIPT_PRIVATE_KEY: 'line1\nline2',
      },
      run,
    );
    expect(command).toBe('fly');
    expect(args).toEqual(['secrets', 'import', '--app', 'revealui-review-controller']);
    expect(args.join(' ')).not.toContain('line1');
    expect(input).toBe('REVIEW_RECEIPT_MODE=shadow\nREVIEW_RECEIPT_PRIVATE_KEY=line1\\nline2\n');
  });
});
