/**
 * Global Contract Tests
 *
 * Tests the GlobalContract for validation and type safety
 */

import { describe, expect, it } from 'vitest';
import { isGlobalConfig, parseGlobal, validateGlobal } from '../admin/global.js';
import { MockSettingsGlobal } from './mocks/revealui.js';

describe('Global Contract', () => {
  describe('Validation', () => {
    it('validates valid global configs', () => {
      const result = validateGlobal(MockSettingsGlobal);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.slug).toBe('settings');
      }
    });

    it('rejects invalid global configs', () => {
      const invalid = {
        // Missing required fields
        fields: [],
      };

      const result = validateGlobal(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Type Guards', () => {
    it('correctly identifies global configs', () => {
      expect(isGlobalConfig(MockSettingsGlobal)).toBe(true);
      expect(isGlobalConfig({})).toBe(false);
      expect(isGlobalConfig(null)).toBe(false);
    });

    it('narrows types correctly', () => {
      const unknownData: unknown = MockSettingsGlobal;

      if (isGlobalConfig(unknownData)) {
        // TypeScript should narrow to GlobalContractType
        expect(unknownData.slug).toBe('settings');
      }
    });
  });

  describe('Parse', () => {
    it('parses valid globals', () => {
      const global = parseGlobal(MockSettingsGlobal);
      expect(global.slug).toBe('settings');
    });

    it('throws on invalid globals', () => {
      const invalid = {};

      expect(() => parseGlobal(invalid)).toThrow();
    });
  });
});
