/**
 * Scratchpad Patch Applier - Server-side Yjs structured patch application.
 *
 * CLI agents submit structured patches instead of real-time Yjs updates.
 * This module applies those patches to a Yjs document and returns the
 * updated state for persistence.
 *
 * Patch types:
 * - set_key: Set a root-level key to a string value
 * - append_section: Append text to a Y.Text section (create if missing)
 * - append_item: Push an item to a Y.Array section (create if missing)
 * - replace_section: Replace a section entirely with new Y.Text content
 */

import * as Y from 'yjs';

export type PatchType = 'set_key' | 'append_section' | 'append_item' | 'replace_section';

export interface ScratchpadPatch {
  patchType: PatchType;
  path: string;
  content: string;
}

export interface ApplyResult {
  state: Uint8Array;
  stateVector: Uint8Array;
}

/**
 * Apply a single structured patch to a Yjs document.
 * The document uses a Y.Map('root') as the top-level container.
 */
export function applyPatch(doc: Y.Doc, patch: ScratchpadPatch): void {
  const root = doc.getMap('root');

  switch (patch.patchType) {
    case 'set_key': {
      root.set(patch.path, patch.content);
      break;
    }
    case 'append_section': {
      let section = root.get(patch.path);
      if (!(section instanceof Y.Text)) {
        section = new Y.Text();
        root.set(patch.path, section);
      }
      (section as Y.Text).insert((section as Y.Text).length, patch.content);
      break;
    }
    case 'append_item': {
      let arr = root.get(patch.path);
      if (!(arr instanceof Y.Array)) {
        arr = new Y.Array();
        root.set(patch.path, arr);
      }
      (arr as Y.Array<string>).push([patch.content]);
      break;
    }
    case 'replace_section': {
      const text = new Y.Text();
      text.insert(0, patch.content);
      root.set(patch.path, text);
      break;
    }
  }
}

/**
 * Apply one or more patches to an existing Yjs document state.
 * Returns the updated encoded state and state vector.
 */
export function applyPatches(
  existingState: Uint8Array | null,
  patches: ScratchpadPatch[],
): ApplyResult {
  const doc = new Y.Doc();

  if (existingState) {
    Y.applyUpdate(doc, existingState);
  }

  for (const patch of patches) {
    applyPatch(doc, patch);
  }

  const result: ApplyResult = {
    state: Y.encodeStateAsUpdate(doc),
    stateVector: Y.encodeStateVector(doc),
  };

  doc.destroy();
  return result;
}

/**
 * Read the current content of a Yjs scratchpad as a plain object.
 * Converts Y.Text to strings and Y.Array to string arrays.
 */
export function readScratchpad(state: Uint8Array): Record<string, unknown> {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, state);
  const root = doc.getMap('root');
  const result: Record<string, unknown> = {};

  for (const [key, value] of root.entries()) {
    if (value instanceof Y.Text) {
      result[key] = value.toString();
    } else if (value instanceof Y.Array) {
      result[key] = value.toArray();
    } else {
      result[key] = value;
    }
  }

  doc.destroy();
  return result;
}
