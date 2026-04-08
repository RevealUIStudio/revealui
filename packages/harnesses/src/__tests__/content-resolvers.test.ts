import { describe, expect, it } from 'vitest';
import { listResolvers, registerResolver, resolveTemplate } from '../content/resolvers/index.js';
import type { ResolverContext } from '../content/resolvers/types.js';

describe('Content Resolvers', () => {
  const ctx: ResolverContext = {
    projectRoot: '/test/project',
    projectName: 'TestProject',
    phase: 'Phase 1',
    packageManager: 'pnpm 10',
    nodeVersion: '24',
  };

  describe('resolveTemplate', () => {
    it('resolves known placeholders', () => {
      const result = resolveTemplate('Project: {{PROJECT_NAME}}, Phase: {{PHASE}}', ctx);
      expect(result).toBe('Project: TestProject, Phase: Phase 1');
    });

    it('leaves unknown placeholders intact', () => {
      const result = resolveTemplate('Value: {{UNKNOWN_KEY}}', ctx);
      expect(result).toBe('Value: {{UNKNOWN_KEY}}');
    });

    it('resolves multiple occurrences', () => {
      const result = resolveTemplate('{{NODE_VERSION}} and {{NODE_VERSION}}', ctx);
      expect(result).toBe('24 and 24');
    });

    it('handles strings with no placeholders', () => {
      const result = resolveTemplate('No placeholders here', ctx);
      expect(result).toBe('No placeholders here');
    });

    it('resolves environment placeholders', () => {
      const result = resolveTemplate('{{PACKAGE_MANAGER}}', ctx);
      expect(result).toBe('pnpm 10');
    });

    it('uses defaults when context values are missing', () => {
      const minimalCtx: ResolverContext = { projectRoot: '/test' };
      const result = resolveTemplate('{{PROJECT_NAME}} on {{NODE_VERSION}}', minimalCtx);
      expect(result).toBe('RevealUI on 24');
    });
  });

  describe('listResolvers', () => {
    it('returns all registered resolver keys', () => {
      const keys = listResolvers();
      expect(keys).toContain('PROJECT_NAME');
      expect(keys).toContain('PHASE');
      expect(keys).toContain('NODE_VERSION');
      expect(keys).toContain('PACKAGE_MANAGER');
      expect(keys).toContain('STACK');
      expect(keys).toContain('BRANCH_PIPELINE');
      expect(keys).toContain('LICENSE_TIERS');
    });
  });

  describe('registerResolver', () => {
    it('adds a custom resolver', () => {
      registerResolver('CUSTOM_KEY', () => 'custom-value');
      const result = resolveTemplate('{{CUSTOM_KEY}}', ctx);
      expect(result).toBe('custom-value');
    });
  });
});
