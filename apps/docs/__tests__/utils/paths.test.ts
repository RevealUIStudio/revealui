/**
 * Unit tests for path utilities
 */

import { describe, expect, it } from 'vitest';
import { isPathSafe, resolveDocPath, sanitizePath } from '../../app/utils/paths';

describe('sanitizePath', () => {
  it('should remove directory traversal attempts', () => {
    // Removes .. segments but preserves other valid segments
    expect(sanitizePath('../../etc/passwd')).toBe('etc/passwd');
    expect(sanitizePath('../..')).toBe('');
    expect(sanitizePath('....')).toBe('');
  });

  it('should remove null bytes', () => {
    expect(sanitizePath('file\0.txt')).toBe('file.txt');
  });

  it('should remove control characters', () => {
    expect(sanitizePath('file\nwith\nnewlines')).toBe('filewithnewlines');
  });

  it('should handle normal paths', () => {
    expect(sanitizePath('getting-started')).toBe('getting-started');
    expect(sanitizePath('guides/nested/page')).toBe('guides/nested/page');
  });

  it('should normalize path separators', () => {
    expect(sanitizePath('path\\with\\backslashes')).toBe('path/with/backslashes');
  });

  it('should trim leading/trailing slashes', () => {
    expect(sanitizePath('/path/')).toBe('path');
    expect(sanitizePath('///path///')).toBe('path');
  });

  it('should handle empty strings', () => {
    expect(sanitizePath('')).toBe('');
  });
});

describe('isPathSafe', () => {
  it('should reject directory traversal attempts', () => {
    expect(isPathSafe('../etc/passwd')).toBe(false);
    expect(isPathSafe('..')).toBe(false);
  });

  it('should reject null bytes', () => {
    expect(isPathSafe('file\0.txt')).toBe(false);
  });

  it('should reject absolute paths', () => {
    expect(isPathSafe('/absolute/path')).toBe(false);
    expect(isPathSafe('C:\\Windows\\System32')).toBe(false);
  });

  it('should reject control characters', () => {
    expect(isPathSafe('file\nwith\nnewlines')).toBe(false);
  });

  it('should accept safe paths', () => {
    expect(isPathSafe('getting-started')).toBe(true);
    expect(isPathSafe('guides/nested/page')).toBe(true);
    expect(isPathSafe('file.md')).toBe(true);
  });

  it('should reject empty strings', () => {
    expect(isPathSafe('')).toBe(false);
  });
});

describe('resolveDocPath', () => {
  describe('guides section', () => {
    it('should resolve index path', () => {
      const result = resolveDocPath({ section: 'guides' });
      expect(result.markdownPath).toBe('/guides/README.md');
      expect(result.isIndex).toBe(true);
    });

    it('should resolve guide path with extension', () => {
      const result = resolveDocPath({
        section: 'guides',
        routePath: 'getting-started.md',
      });
      expect(result.markdownPath).toBe('/guides/getting-started.md');
      expect(result.isIndex).toBe(false);
    });

    it('should add .md extension if missing', () => {
      const result = resolveDocPath({
        section: 'guides',
        routePath: 'getting-started',
      });
      expect(result.markdownPath).toBe('/guides/getting-started.md');
    });

    it('should handle nested paths', () => {
      const result = resolveDocPath({
        section: 'guides',
        routePath: 'deployment/vercel',
      });
      expect(result.markdownPath).toBe('/guides/deployment/vercel.md');
    });

    it('should sanitize dangerous paths', () => {
      const result = resolveDocPath({
        section: 'guides',
        routePath: '../../etc/passwd',
      });
      // Sanitization removes .. segments but preserves valid segments
      // So 'etc/passwd' remains, isIndex is false
      expect(result.isIndex).toBe(false);
      expect(result.markdownPath).toBe('/guides/etc/passwd.md');
    });
  });

  describe('api section', () => {
    it('should resolve index path', () => {
      const result = resolveDocPath({ section: 'api' });
      expect(result.markdownPath).toBe('/api/README.md');
      expect(result.isIndex).toBe(true);
    });

    it('should resolve package name to README', () => {
      const result = resolveDocPath({
        section: 'api',
        routePath: 'revealui-core',
      });
      expect(result.markdownPath).toBe('/api/revealui-core/README.md');
    });

    it('should resolve nested path with extension', () => {
      const result = resolveDocPath({
        section: 'api',
        routePath: 'revealui-core/index',
      });
      expect(result.markdownPath).toBe('/api/revealui-core/index.md');
    });

    it('should handle path with .md extension', () => {
      const result = resolveDocPath({
        section: 'api',
        routePath: 'revealui-core/index.md',
      });
      expect(result.markdownPath).toBe('/api/revealui-core/index.md');
    });
  });

  describe('reference section', () => {
    it('should resolve index path', () => {
      const result = resolveDocPath({ section: 'reference' });
      expect(result.markdownPath).toBe('/reference/README.md');
      expect(result.isIndex).toBe(true);
    });

    it('should add .md extension', () => {
      const result = resolveDocPath({
        section: 'reference',
        routePath: 'config',
      });
      expect(result.markdownPath).toBe('/reference/config.md');
    });
  });
});
