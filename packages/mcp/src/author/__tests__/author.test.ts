import { describe, expect, it } from 'vitest';

import {
  AUTHOR_SDK_TRACKING_ISSUE,
  AuthorSdkNotImplementedError,
  publish,
  runTestHarness,
  scaffold,
} from '../index.js';
import { publish as publishDirect } from '../publish.js';
// Direct subpath imports — exercises the per-module entry points the
// package.json exports map declares (./author/scaffold, ./author/test,
// ./author/publish). Per memory `reference_mcp_barrel_subpath_imports`,
// these are the preferred consumer entrypoints.
import { scaffold as scaffoldDirect } from '../scaffold.js';
import { runTestHarness as testDirect } from '../test.js';

describe('@revealui/mcp/author — Phase 1.6 stub surface', () => {
  describe('AuthorSdkNotImplementedError', () => {
    it('exposes fn + module + a non-empty message', () => {
      const err = new AuthorSdkNotImplementedError('scaffold', '@revealui/mcp/author/scaffold');

      expect(err.name).toBe('AuthorSdkNotImplementedError');
      expect(err.fn).toBe('scaffold');
      expect(err.module).toBe('@revealui/mcp/author/scaffold');
      expect(err.message.length).toBeGreaterThan(0);
      expect(err).toBeInstanceOf(Error);
    });

    it('cites the tracking issue in the message body', () => {
      const err = new AuthorSdkNotImplementedError('publish', '@revealui/mcp/author/publish');

      expect(err.message).toContain(AUTHOR_SDK_TRACKING_ISSUE);
      expect(AUTHOR_SDK_TRACKING_ISSUE).toContain('revealui-jv/issues/');
    });

    it('mentions Phase 1.6 + L2 lock so readers know the deliberate-stub posture', () => {
      const err = new AuthorSdkNotImplementedError('runTestHarness', '@revealui/mcp/author/test');

      expect(err.message).toContain('Phase 1.6');
      expect(err.message).toContain('L2');
    });
  });

  describe('scaffold (barrel + direct subpath agree)', () => {
    it('throws AuthorSdkNotImplementedError with the correct module ID', async () => {
      await expect(scaffold({ name: 'test-server', targetDir: '/tmp/x' })).rejects.toThrowError(
        AuthorSdkNotImplementedError,
      );

      try {
        await scaffold({ name: 'test-server', targetDir: '/tmp/x' });
        expect.fail('expected throw');
      } catch (err) {
        const e = err as AuthorSdkNotImplementedError;
        expect(e.fn).toBe('scaffold');
        expect(e.module).toBe('@revealui/mcp/author/scaffold');
      }
    });

    it('barrel re-export and direct subpath are the same function reference', () => {
      expect(scaffold).toBe(scaffoldDirect);
    });
  });

  describe('runTestHarness (barrel + direct subpath agree)', () => {
    it('throws AuthorSdkNotImplementedError with the correct module ID', async () => {
      await expect(
        runTestHarness({ serverPath: '/tmp/server.js', toolCalls: [] }),
      ).rejects.toThrowError(AuthorSdkNotImplementedError);

      try {
        await runTestHarness({ serverPath: '/tmp/server.js', toolCalls: [] });
        expect.fail('expected throw');
      } catch (err) {
        const e = err as AuthorSdkNotImplementedError;
        expect(e.fn).toBe('runTestHarness');
        expect(e.module).toBe('@revealui/mcp/author/test');
      }
    });

    it('barrel re-export and direct subpath are the same function reference', () => {
      expect(runTestHarness).toBe(testDirect);
    });
  });

  describe('publish (barrel + direct subpath agree)', () => {
    it('throws AuthorSdkNotImplementedError with the correct module ID', async () => {
      await expect(publish({ packageDir: '/tmp/pkg', venue: 'revmarket' })).rejects.toThrowError(
        AuthorSdkNotImplementedError,
      );

      try {
        await publish({ packageDir: '/tmp/pkg', venue: 'npm' });
        expect.fail('expected throw');
      } catch (err) {
        const e = err as AuthorSdkNotImplementedError;
        expect(e.fn).toBe('publish');
        expect(e.module).toBe('@revealui/mcp/author/publish');
      }
    });

    it('barrel re-export and direct subpath are the same function reference', () => {
      expect(publish).toBe(publishDirect);
    });
  });

  describe('barrel surface', () => {
    it('exports the three stub functions + the error class + the tracking constant', () => {
      // Compile-time check: if any of these names dropped from the barrel,
      // the imports at the top of the file would fail at typecheck.
      expect(typeof scaffold).toBe('function');
      expect(typeof runTestHarness).toBe('function');
      expect(typeof publish).toBe('function');
      expect(typeof AuthorSdkNotImplementedError).toBe('function');
      expect(typeof AUTHOR_SDK_TRACKING_ISSUE).toBe('string');
    });
  });
});
