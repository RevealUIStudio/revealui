import type { RevealDocument } from '../types/index.js';
/**
 * Flattens SQL result with dotted notation into nested objects
 * e.g., { 'author.title': 'John', 'author.id': 1 } -> { author: { title: 'John', id: 1 } }
 */
export declare function flattenResult(doc: RevealDocument): RevealDocument;
//# sourceMappingURL=flattenResult.d.ts.map