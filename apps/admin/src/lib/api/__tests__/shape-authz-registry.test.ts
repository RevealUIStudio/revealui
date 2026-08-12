/**
 * Shape AuthZ registry completeness (GAP-477 Phase C).
 */

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHAPE_AUTHZ_REGISTRY } from '../shape-authz-registry.js';

const SHAPES_DIR = join(__dirname, '../../../app/api/shapes');

function listShapeRouteDirs(): string[] {
  return readdirSync(SHAPES_DIR).filter((name) => {
    if (name === '__tests__') return false;
    const full = join(SHAPES_DIR, name);
    try {
      return statSync(full).isDirectory();
    } catch {
      return false;
    }
  });
}

describe('SHAPE_AUTHZ_REGISTRY', () => {
  it('registers every shapes/* route directory', () => {
    const dirs = listShapeRouteDirs().sort();
    const registered = Object.keys(SHAPE_AUTHZ_REGISTRY).sort();
    expect(registered).toEqual(dirs);
  });

  it('assigns a known scope kind to every entry', () => {
    const allowed = new Set(['user_self', 'site_member', 'admin_platform', 'acl_resource']);
    for (const [name, entry] of Object.entries(SHAPE_AUTHZ_REGISTRY)) {
      expect(allowed.has(entry.scope), `${name} has invalid scope ${entry.scope}`).toBe(true);
      expect(entry.table.length).toBeGreaterThan(0);
      expect(entry.enforcement.length).toBeGreaterThan(0);
    }
  });
});
