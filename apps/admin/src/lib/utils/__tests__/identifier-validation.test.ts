import { describe, expect, it } from 'vitest';
import { isSyncIdentifier, isUuid } from '../identifier-validation';

describe('isUuid', () => {
  it('accepts lowercase UUIDs', () => {
    expect(isUuid('0b9f2a4e-1c3d-4e5f-8a7b-9c0d1e2f3a4b')).toBe(true);
  });

  it('accepts uppercase and mixed-case UUIDs', () => {
    expect(isUuid('0B9F2A4E-1C3D-4E5F-8A7B-9C0D1E2F3A4B')).toBe(true);
    expect(isUuid('0b9F2a4E-1c3D-4e5F-8a7B-9c0D1e2F3a4B')).toBe(true);
  });

  it('rejects wrong lengths', () => {
    expect(isUuid('')).toBe(false);
    expect(isUuid('0b9f2a4e-1c3d-4e5f-8a7b-9c0d1e2f3a4')).toBe(false);
    expect(isUuid('0b9f2a4e-1c3d-4e5f-8a7b-9c0d1e2f3a4bc')).toBe(false);
  });

  it('rejects non-hex characters', () => {
    expect(isUuid('0b9f2a4g-1c3d-4e5f-8a7b-9c0d1e2f3a4b')).toBe(false);
    expect(isUuid('zb9f2a4e-1c3d-4e5f-8a7b-9c0d1e2f3a4b')).toBe(false);
  });

  it('rejects misplaced dashes at the correct total length', () => {
    expect(isUuid('0b9f2a4e1-c3d-4e5f-8a7b-9c0d1e2f3a4b')).toBe(false);
    expect(isUuid('0b9f2a4e-1c3d-4e5f-8a7b9-c0d1e2f3a4b')).toBe(false);
  });

  it('rejects identifiers that are not UUID-shaped at all', () => {
    expect(isUuid('task_abc123')).toBe(false);
    expect(isUuid('not-a-uuid')).toBe(false);
  });
});

describe('isSyncIdentifier', () => {
  it('accepts alphanumeric ids with hyphens and underscores', () => {
    expect(isSyncIdentifier('agent-system')).toBe(true);
    expect(isSyncIdentifier('task_abc123XYZ')).toBe(true);
    expect(isSyncIdentifier('0b9f2a4e-1c3d-4e5f-8a7b-9c0d1e2f3a4b')).toBe(true);
  });

  it('rejects the empty string', () => {
    expect(isSyncIdentifier('')).toBe(false);
  });

  it('rejects whitespace and punctuation', () => {
    expect(isSyncIdentifier('agent system')).toBe(false);
    expect(isSyncIdentifier('agent/system')).toBe(false);
    expect(isSyncIdentifier('agent.system')).toBe(false);
    expect(isSyncIdentifier('agent:system')).toBe(false);
  });

  it('rejects path traversal and quoting attempts', () => {
    expect(isSyncIdentifier('../etc/passwd')).toBe(false);
    expect(isSyncIdentifier("a'; DROP TABLE--")).toBe(false);
  });

  it('rejects non-ASCII characters', () => {
    expect(isSyncIdentifier('agént')).toBe(false);
  });
});
