/**
 * Integration tests for dev package configs
 *
 * Tests that all configs can be imported and have correct structure
 */

import { describe, expect, it } from 'vitest';

describe('Dev Package Configs Integration', () => {
  describe('Tailwind Config', () => {
    it('should import tailwind config', async () => {
      const config = await import('@revealui/dev/tailwind');
      expect(config.default).toBeDefined();
      expect(config.default.theme).toBeDefined();
      expect(config.default.plugins).toBeDefined();
      expect(Array.isArray(config.default.plugins)).toBe(true);
      expect(config.default.plugins?.length).toBeGreaterThan(0);
    }, 15_000);

    it('should import createTailwindConfig helper', async () => {
      const { createTailwindConfig } = await import('@revealui/dev/tailwind/create-config');
      expect(typeof createTailwindConfig).toBe('function');
    });

    it('should create valid config with createTailwindConfig', async () => {
      const { createTailwindConfig } = await import('@revealui/dev/tailwind/create-config');
      const config = createTailwindConfig({
        content: ['./src/**/*.{ts,tsx}'],
        theme: {
          extend: {
            colors: {
              test: '#ff0000',
            },
          },
        },
      });

      expect(config.content).toEqual(['./src/**/*.{ts,tsx}']);
      expect(config.theme?.extend?.colors).toHaveProperty('test');
      expect(config.plugins).toBeDefined();
      expect(Array.isArray(config.plugins)).toBe(true);
    });

    it('should deep merge theme.extend correctly', async () => {
      const { createTailwindConfig } = await import('@revealui/dev/tailwind/create-config');
      const config = createTailwindConfig({
        content: ['./test'],
        theme: {
          extend: {
            screens: {
              custom: '999px',
            },
            colors: {
              brand: {
                primary: '#ff0000',
                secondary: '#00ff00',
              },
            },
          },
        },
      });

      // Should have custom screens merged with shared screens
      expect(config.theme?.extend?.screens).toHaveProperty('custom');
      expect((config.theme?.extend?.screens as Record<string, unknown>)?.xs).toBeDefined(); // Shared screen

      // Should have custom colors merged with shared colors
      expect(config.theme?.extend?.colors).toHaveProperty('brand');
    });
  });

  describe('PostCSS Config', () => {
    it('should import postcss config', async () => {
      const config = await import('@revealui/dev/postcss');
      expect(config.default).toBeDefined();
      expect(config.default.plugins).toBeDefined();
      expect(typeof config.default.plugins).toBe('object');
    });

    it('should have required plugins', async () => {
      const config = await import('@revealui/dev/postcss');
      const plugins = config.default.plugins as Record<string, unknown>;
      // Tailwind CSS v4 handles imports natively via @tailwindcss/postcss
      // postcss-import and autoprefixer are no longer needed
      expect(plugins).toHaveProperty('@tailwindcss/postcss');
    });
  });

  describe('Vite Config', () => {
    it('should import vite config', async () => {
      const config = await import('@revealui/dev/vite');
      expect(config.default).toBeDefined();
      expect(config.default.build).toBeDefined();
      expect(config.default.resolve).toBeDefined();
    });

    it('should have build configuration', async () => {
      const config = await import('@revealui/dev/vite');
      expect(config.default.build?.target).toBeDefined();
      expect(config.default.build?.sourcemap).toBe(true);
      expect(config.default.build?.rolldownOptions).toBeDefined();
    });

    it('should have resolve aliases', async () => {
      const config = await import('@revealui/dev/vite');
      expect(config.default.resolve?.alias).toBeDefined();
      expect(typeof config.default.resolve?.alias).toBe('object');
    });
  });

  describe('Biome Config', () => {
    it('should import biome config', async () => {
      const config = await import('@revealui/dev/biome');
      expect(config.biomeConfig).toBeDefined();
      expect(typeof config.biomeConfig).toBe('object');
    });

    it('should have formatter configuration', async () => {
      const config = await import('@revealui/dev/biome');
      expect(config.biomeConfig.formatter).toBeDefined();
    });
  });

  describe('TypeScript Configs', () => {
    it('should have base.json config file', async () => {
      // TypeScript configs are JSON files, so we import as JSON
      const basePath = new URL('../../ts/base.json', import.meta.url).pathname;
      const fs = await import('node:fs/promises');
      const exists = await fs
        .access(basePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should have nextjs.json config file', async () => {
      const nextjsPath = new URL('../../ts/nextjs.json', import.meta.url).pathname;
      const fs = await import('node:fs/promises');
      const exists = await fs
        .access(nextjsPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should have revealui.json config file', async () => {
      const revealPath = new URL('../../ts/revealui.json', import.meta.url).pathname;
      const fs = await import('node:fs/promises');
      const exists = await fs
        .access(revealPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('App Config Integration', () => {
    it('should work with web app configs', async () => {
      // Test that configs can be imported and use dev package correctly
      // We test by verifying the config structure rather than importing from relative paths
      // (which may not resolve correctly in test context)
      const tailwindConfig = await import('@revealui/dev/tailwind/create-config');
      const config = tailwindConfig.createTailwindConfig({
        content: ['./src/**/*.{ts,tsx}'],
      });
      expect(config.content).toEqual(['./src/**/*.{ts,tsx}']);
      expect(config.plugins).toBeDefined();
    });

    it('should verify all config exports are accessible', async () => {
      const tailwind = await import('@revealui/dev/tailwind');
      const postcss = await import('@revealui/dev/postcss');
      const vite = await import('@revealui/dev/vite');

      expect(tailwind.default).toBeDefined();
      expect(postcss.default).toBeDefined();
      expect(vite.default).toBeDefined();
    });
  });
});
