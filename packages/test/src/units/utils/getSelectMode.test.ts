/**
 * Unit tests for getSelectMode utility
 *
 * Tests actual utility from packages/core/src/utils/getSelectMode.ts
 */

import { describe, expect, it } from 'vitest';
import type { SelectType } from '../../../../../packages/core/src/types/index.js';
import { getSelectMode } from '../../../../../packages/core/src/utils/getSelectMode.js';

describe('getSelectMode', () => {
  it('should return "include" for select with truthy values', () => {
    const select: SelectType = {
      title: true,
      content: true,
    };

    const mode = getSelectMode(select);
    expect(mode).toBe('include');
  });

  it('should return "exclude" when any value is false', () => {
    const select: SelectType = {
      title: true,
      content: false,
    };

    const mode = getSelectMode(select);
    expect(mode).toBe('exclude');
  });

  it('should return "exclude" when all values are false', () => {
    const select: SelectType = {
      title: false,
      content: false,
    };

    const mode = getSelectMode(select);
    expect(mode).toBe('exclude');
  });

  it('should recursively check nested objects', () => {
    const select: SelectType = {
      title: true,
      author: {
        name: true,
        email: true,
      },
    };

    const mode = getSelectMode(select);
    expect(mode).toBe('include');
  });

  it('should return "exclude" when nested object contains false', () => {
    const select: SelectType = {
      title: true,
      author: {
        name: true,
        email: false,
      },
    };

    const mode = getSelectMode(select);
    expect(mode).toBe('exclude');
  });

  it('should handle deeply nested objects', () => {
    const select = {
      title: true,
      author: {
        profile: {
          name: true,
          bio: true,
        },
      },
    } as unknown as SelectType;

    const mode = getSelectMode(select);
    expect(mode).toBe('include');
  });

  it('should detect false in deeply nested objects', () => {
    const select = {
      title: true,
      author: {
        profile: {
          name: true,
          bio: false,
        },
      },
    } as unknown as SelectType;

    const mode = getSelectMode(select);
    expect(mode).toBe('exclude');
  });

  it('should handle empty object (returns include)', () => {
    const select: SelectType = {};

    const mode = getSelectMode(select);
    expect(mode).toBe('include');
  });

  it('should handle select with null values', () => {
    const select: SelectType = {
      title: true,
      content: null as unknown as boolean,
    };

    const mode = getSelectMode(select);
    // null is treated as object, so it will recursively check
    // Since null is not false, it returns include
    expect(mode).toBe('include');
  });

  it('should handle select with undefined values', () => {
    const select: SelectType = {
      title: true,
      content: undefined as unknown as boolean,
    };

    const mode = getSelectMode(select);
    expect(mode).toBe('include');
  });

  it('should handle select with string values', () => {
    const select: SelectType = {
      title: 'include' as unknown as boolean,
      content: true,
    };

    const mode = getSelectMode(select);
    // String is treated as object-like, will recursively check
    expect(mode).toBe('include');
  });

  it('should handle select with array values', () => {
    const select: SelectType = {
      title: true,
      tags: ['tag1', 'tag2'] as unknown as boolean,
    };

    const mode = getSelectMode(select);
    expect(mode).toBe('include');
  });

  it('should prioritize false detection (exclude)', () => {
    const select: SelectType = {
      title: true,
      content: true,
      author: {
        name: false,
        email: true,
      },
    };

    const mode = getSelectMode(select);
    expect(mode).toBe('exclude');
  });

  it('should handle complex nested structures', () => {
    const select = {
      title: true,
      content: true,
      author: {
        profile: {
          personal: {
            name: true,
          },
          work: {
            company: true,
          },
        },
      },
    } as unknown as SelectType;

    const mode = getSelectMode(select);
    expect(mode).toBe('include');
  });

  it('should detect false in complex nested structures', () => {
    const select = {
      title: true,
      content: true,
      author: {
        profile: {
          personal: {
            name: true,
          },
          work: {
            company: false,
          },
        },
      },
    } as unknown as SelectType;

    const mode = getSelectMode(select);
    expect(mode).toBe('exclude');
  });
});
