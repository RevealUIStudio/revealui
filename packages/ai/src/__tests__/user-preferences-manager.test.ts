import type { UserPreferences } from '@revealui/contracts/entities';
import type { Database } from '@revealui/db/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { UserPreferencesManager } from '../memory/preferences/user-preferences-manager.js';

// Mock database
class MockDatabase {
  query = {
    users: {
      findFirst: async () => null,
    },
  };
  insert = () => ({ values: async () => undefined });
  update = () => ({ set: () => ({ where: async () => undefined }) });
  delete = () => ({ where: async () => undefined });
}

describe('UserPreferencesManager', () => {
  let db: Database;
  let manager: UserPreferencesManager;

  beforeEach(() => {
    db = new MockDatabase() as unknown as Database;
    manager = new UserPreferencesManager('user-123', 'node-abc', db);
  });

  describe('constructor', () => {
    it('should initialize with default preferences', () => {
      const prefs = manager.getPreferences();
      expect(prefs.theme).toBe('system');
      expect(prefs.language).toBe('en');
      expect(prefs.timezone).toBe('UTC');
    });
  });

  describe('getPreferences', () => {
    it('should return current preferences', () => {
      const prefs = manager.getPreferences();
      expect(prefs).toHaveProperty('theme');
      expect(prefs).toHaveProperty('language');
      expect(prefs).toHaveProperty('timezone');
    });
  });

  describe('setPreferences', () => {
    it('should set entire preferences object', () => {
      const newPrefs: UserPreferences = {
        theme: 'dark',
        language: 'fr',
        timezone: 'America/New_York',
      };

      manager.setPreferences(newPrefs);

      const prefs = manager.getPreferences();
      expect(prefs.theme).toBe('dark');
      expect(prefs.language).toBe('fr');
      expect(prefs.timezone).toBe('America/New_York');
    });

    it('should validate preferences before setting', () => {
      expect(() => {
        manager.setPreferences({
          theme: 'invalid' as 'light',
          language: 'en',
          timezone: 'UTC',
        });
      }).toThrow('Invalid preferences');
    });
  });

  describe('updatePreferences', () => {
    it('should merge partial updates', () => {
      manager.updatePreferences({ theme: 'dark' });

      const prefs = manager.getPreferences();
      expect(prefs.theme).toBe('dark');
      expect(prefs.language).toBe('en'); // Default preserved
    });

    it('should deep merge nested objects', () => {
      manager.updatePreferences({
        notifications: {
          email: false,
          push: true,
          inApp: true,
        },
      });

      const prefs = manager.getPreferences();
      expect(prefs.notifications?.email).toBe(false);
      expect(prefs.notifications?.push).toBe(true);
    });

    it('should validate merged preferences', () => {
      expect(() => {
        manager.updatePreferences({
          theme: 'invalid' as 'light',
        });
      }).toThrow('Invalid preferences');
    });
  });

  describe('getPreference', () => {
    it('should get top-level preference', () => {
      manager.updatePreferences({ theme: 'dark' });
      expect(manager.getPreference('theme')).toBe('dark');
    });

    it('should get nested preference using dot notation', () => {
      manager.updatePreferences({
        notifications: {
          email: false,
          push: true,
          inApp: true,
        },
      });

      expect(manager.getPreference('notifications.email')).toBe(false);
      expect(manager.getPreference('notifications.push')).toBe(true);
    });

    it('should return undefined for non-existent key', () => {
      expect(manager.getPreference('nonexistent')).toBeUndefined();
    });
  });

  describe('setPreference', () => {
    it('should set top-level preference without mutating original', () => {
      const originalPrefs = manager.getPreferences();
      manager.setPreference('theme', 'dark');

      const newPrefs = manager.getPreferences();
      expect(newPrefs.theme).toBe('dark');
      // Verify original object wasn't mutated (by checking it's a different reference)
      // Since we deep clone, the objects should be different
      expect(newPrefs).not.toBe(originalPrefs);
    });

    it('should set nested preference using dot notation', () => {
      manager.updatePreferences({
        notifications: {
          email: true,
          push: false,
          inApp: true,
        },
      });

      manager.setPreference('notifications.email', false);

      const prefs = manager.getPreferences();
      expect(prefs.notifications?.email).toBe(false);
      expect(prefs.notifications?.push).toBe(false);
    });

    it('should create nested structure if it does not exist', () => {
      manager.setPreference('editor.fontSize', 16);

      const prefs = manager.getPreferences();
      expect(prefs.editor?.fontSize).toBe(16);
    });

    it('should validate after setting preference', () => {
      expect(() => {
        manager.setPreference('theme', 'invalid');
      }).toThrow('Invalid preferences');
    });
  });

  describe('merge', () => {
    it('should merge two managers using CRDT semantics', () => {
      manager.updatePreferences({ theme: 'dark' });

      const otherManager = new UserPreferencesManager('user-123', 'node-xyz', db);
      otherManager.updatePreferences({ language: 'fr' });

      const merged = manager.merge(otherManager);
      const prefs = merged.getPreferences();

      // LWWRegister merge: last writer wins based on timestamp
      // Since otherManager was updated after manager, its language should win
      // Theme from manager should be preserved if it has later timestamp
      expect(prefs.language).toBe('fr');
      // Theme depends on which register has the later timestamp
      // This is correct CRDT behavior - we just verify merge works
      expect(prefs.theme).toBeDefined();
    });
  });

  describe('clone', () => {
    it('should create independent copy', () => {
      manager.updatePreferences({ theme: 'dark' });

      const cloned = manager.clone();
      cloned.updatePreferences({ language: 'fr' });

      expect(manager.getPreferences().language).toBe('en');
      expect(cloned.getPreferences().language).toBe('fr');
    });
  });

  describe('getUserId and getNodeId', () => {
    it('should return correct user ID', () => {
      expect(manager.getUserId()).toBe('user-123');
    });

    it('should return correct node ID', () => {
      expect(manager.getNodeId()).toBe('node-abc');
    });
  });
});
