import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { applyPatch, applyPatches, readScratchpad } from '../scratchpad-patch-applier.js';

describe('scratchpad-patch-applier', () => {
  describe('applyPatch', () => {
    it('sets a root-level key with set_key', () => {
      const doc = new Y.Doc();
      applyPatch(doc, { patchType: 'set_key', path: 'title', content: 'My Doc' });
      expect(doc.getMap('root').get('title')).toBe('My Doc');
      doc.destroy();
    });

    it('creates and appends to a Y.Text section with append_section', () => {
      const doc = new Y.Doc();
      applyPatch(doc, { patchType: 'append_section', path: 'findings', content: 'First. ' });
      applyPatch(doc, { patchType: 'append_section', path: 'findings', content: 'Second.' });
      const section = doc.getMap('root').get('findings') as Y.Text;
      expect(section.toString()).toBe('First. Second.');
      doc.destroy();
    });

    it('creates and pushes to a Y.Array with append_item', () => {
      const doc = new Y.Doc();
      applyPatch(doc, { patchType: 'append_item', path: 'bugs', content: 'Bug A' });
      applyPatch(doc, { patchType: 'append_item', path: 'bugs', content: 'Bug B' });
      const arr = doc.getMap('root').get('bugs') as Y.Array<string>;
      expect(arr.toArray()).toEqual(['Bug A', 'Bug B']);
      doc.destroy();
    });

    it('replaces a section entirely with replace_section', () => {
      const doc = new Y.Doc();
      applyPatch(doc, { patchType: 'append_section', path: 'plan', content: 'Old plan' });
      applyPatch(doc, { patchType: 'replace_section', path: 'plan', content: 'New plan' });
      const section = doc.getMap('root').get('plan') as Y.Text;
      expect(section.toString()).toBe('New plan');
      doc.destroy();
    });

    it('overwrites a non-Text value with append_section', () => {
      const doc = new Y.Doc();
      doc.getMap('root').set('notes', 'plain string');
      applyPatch(doc, { patchType: 'append_section', path: 'notes', content: 'Appended' });
      const section = doc.getMap('root').get('notes') as Y.Text;
      expect(section.toString()).toBe('Appended');
      doc.destroy();
    });

    it('overwrites a non-Array value with append_item', () => {
      const doc = new Y.Doc();
      doc.getMap('root').set('items', 'plain string');
      applyPatch(doc, { patchType: 'append_item', path: 'items', content: 'Item 1' });
      const arr = doc.getMap('root').get('items') as Y.Array<string>;
      expect(arr.toArray()).toEqual(['Item 1']);
      doc.destroy();
    });
  });

  describe('applyPatches', () => {
    it('applies multiple patches to a new document', () => {
      const result = applyPatches(null, [
        { patchType: 'set_key', path: 'title', content: 'Test' },
        { patchType: 'append_item', path: 'findings', content: 'Finding 1' },
        { patchType: 'append_item', path: 'findings', content: 'Finding 2' },
      ]);

      expect(result.state).toBeInstanceOf(Uint8Array);
      expect(result.stateVector).toBeInstanceOf(Uint8Array);
      expect(result.state.length).toBeGreaterThan(0);

      // Verify by reading back
      const doc = new Y.Doc();
      Y.applyUpdate(doc, result.state);
      expect(doc.getMap('root').get('title')).toBe('Test');
      const arr = doc.getMap('root').get('findings') as Y.Array<string>;
      expect(arr.toArray()).toEqual(['Finding 1', 'Finding 2']);
      doc.destroy();
    });

    it('applies patches to an existing document state', () => {
      // Create initial state
      const initial = applyPatches(null, [
        { patchType: 'set_key', path: 'title', content: 'Initial' },
      ]);

      // Apply more patches on top
      const updated = applyPatches(initial.state, [
        { patchType: 'set_key', path: 'title', content: 'Updated' },
        { patchType: 'append_section', path: 'notes', content: 'A note.' },
      ]);

      const doc = new Y.Doc();
      Y.applyUpdate(doc, updated.state);
      expect(doc.getMap('root').get('title')).toBe('Updated');
      const notes = doc.getMap('root').get('notes') as Y.Text;
      expect(notes.toString()).toBe('A note.');
      doc.destroy();
    });

    it('returns valid state for empty patch list', () => {
      const result = applyPatches(null, []);
      expect(result.state).toBeInstanceOf(Uint8Array);
      expect(result.stateVector).toBeInstanceOf(Uint8Array);
    });
  });

  describe('readScratchpad', () => {
    it('reads Y.Text as strings', () => {
      const { state } = applyPatches(null, [
        { patchType: 'append_section', path: 'notes', content: 'Hello world' },
      ]);
      const content = readScratchpad(state);
      expect(content.notes).toBe('Hello world');
    });

    it('reads Y.Array as arrays', () => {
      const { state } = applyPatches(null, [
        { patchType: 'append_item', path: 'items', content: 'A' },
        { patchType: 'append_item', path: 'items', content: 'B' },
      ]);
      const content = readScratchpad(state);
      expect(content.items).toEqual(['A', 'B']);
    });

    it('reads plain string values', () => {
      const { state } = applyPatches(null, [
        { patchType: 'set_key', path: 'status', content: 'active' },
      ]);
      const content = readScratchpad(state);
      expect(content.status).toBe('active');
    });

    it('reads mixed content types', () => {
      const { state } = applyPatches(null, [
        { patchType: 'set_key', path: 'title', content: 'My Scratchpad' },
        { patchType: 'append_section', path: 'summary', content: 'A summary.' },
        { patchType: 'append_item', path: 'bugs', content: 'Bug 1' },
        { patchType: 'append_item', path: 'bugs', content: 'Bug 2' },
      ]);
      const content = readScratchpad(state);
      expect(content.title).toBe('My Scratchpad');
      expect(content.summary).toBe('A summary.');
      expect(content.bugs).toEqual(['Bug 1', 'Bug 2']);
    });
  });
});
