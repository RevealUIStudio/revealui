/**
 * GAP-477 residual — yjs_documents.owner_id column is modeled for ACL stamps.
 */
import { describe, expect, it } from 'vitest';
import { yjsDocuments } from '../schema/yjs-documents.js';

describe('yjs_documents owner_id schema', () => {
  it('exports owner_id for Electric shape ACL stamps', () => {
    expect(yjsDocuments.ownerId.name).toBe('owner_id');
    expect(yjsDocuments.id.name).toBe('id');
  });
});
