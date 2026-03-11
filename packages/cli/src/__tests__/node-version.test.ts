import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock the logger to prevent console output
vi.mock('@revealui/setup/utils', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
    header: vi.fn(),
    divider: vi.fn(),
  }),
}));

import { validateNodeVersion } from '../validators/node-version.js';

describe('validateNodeVersion', () => {
  const originalVersion = process.version;

  afterEach(() => {
    Object.defineProperty(process, 'version', { value: originalVersion, writable: true });
  });

  it('returns true for exact required version (v24.13.0)', () => {
    Object.defineProperty(process, 'version', { value: 'v24.13.0', writable: true });
    expect(validateNodeVersion()).toBe(true);
  });

  it('returns true for higher minor version (v24.14.0)', () => {
    Object.defineProperty(process, 'version', { value: 'v24.14.0', writable: true });
    expect(validateNodeVersion()).toBe(true);
  });

  it('returns true for higher major version (v25.0.0)', () => {
    Object.defineProperty(process, 'version', { value: 'v25.0.0', writable: true });
    expect(validateNodeVersion()).toBe(true);
  });

  it('returns false for lower minor version (v24.12.9)', () => {
    Object.defineProperty(process, 'version', { value: 'v24.12.9', writable: true });
    expect(validateNodeVersion()).toBe(false);
  });

  it('returns false for lower major version (v22.0.0)', () => {
    Object.defineProperty(process, 'version', { value: 'v22.0.0', writable: true });
    expect(validateNodeVersion()).toBe(false);
  });

  it('returns true for higher patch version (v24.13.5)', () => {
    Object.defineProperty(process, 'version', { value: 'v24.13.5', writable: true });
    expect(validateNodeVersion()).toBe(true);
  });
});
