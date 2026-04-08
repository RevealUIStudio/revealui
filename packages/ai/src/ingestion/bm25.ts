/**
 * Pure TypeScript BM25 Implementation
 *
 * Built on-demand from top-N vector candidates — no persistent index.
 * k1=1.5, b=0.75 (standard values). No external deps.
 */

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'been',
  'being',
  'but',
  'by',
  'do',
  'does',
  'doing',
  'for',
  'from',
  'had',
  'has',
  'have',
  'having',
  'he',
  'her',
  'hers',
  'him',
  'his',
  'how',
  'i',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'itself',
  'me',
  'my',
  'nor',
  'not',
  'of',
  'on',
  'or',
  'our',
  'out',
  'own',
  'she',
  'so',
  'some',
  'than',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'through',
  'to',
  'too',
  'up',
  'very',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'while',
  'who',
  'whom',
  'why',
  'will',
  'with',
  'would',
  'you',
  'your',
]);

export interface BM25Document {
  id: string;
  text: string;
}

export interface BM25Result {
  id: string;
  score: number;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

// biome-ignore lint/style/useNamingConvention: BM25 is the canonical algorithm name (Best Match 25)
export class BM25 {
  private k1 = 1.5;
  private b = 0.75;
  private docs: Array<{ id: string; tokens: string[]; length: number }> = [];
  private avgDocLength = 0;
  private termFreqs: Map<string, Map<string, number>> = new Map(); // term → docId → freq
  private docFreqs: Map<string, number> = new Map(); // term → number of docs containing it

  constructor(options?: { k1?: number; b?: number }) {
    if (options?.k1 !== undefined) this.k1 = options.k1;
    if (options?.b !== undefined) this.b = options.b;
  }

  index(documents: BM25Document[]): void {
    this.docs = [];
    this.termFreqs = new Map();
    this.docFreqs = new Map();

    let totalLength = 0;

    for (const doc of documents) {
      const tokens = tokenize(doc.text);
      totalLength += tokens.length;
      this.docs.push({ id: doc.id, tokens, length: tokens.length });

      // Count term frequencies per document
      const tfMap: Map<string, number> = new Map();
      for (const token of tokens) {
        tfMap.set(token, (tfMap.get(token) ?? 0) + 1);
      }

      for (const [term, freq] of tfMap) {
        if (!this.termFreqs.has(term)) this.termFreqs.set(term, new Map());
        // biome-ignore lint/style/noNonNullAssertion: set above guarantees presence
        this.termFreqs.get(term)!.set(doc.id, freq);
        this.docFreqs.set(term, (this.docFreqs.get(term) ?? 0) + 1);
      }
    }

    this.avgDocLength = documents.length > 0 ? totalLength / documents.length : 1;
  }

  search(query: string, topK = 10): BM25Result[] {
    const queryTokens = tokenize(query);
    const N = this.docs.length;
    if (N === 0 || queryTokens.length === 0) return [];

    const scores = new Map<string, number>();

    for (const term of queryTokens) {
      const df = this.docFreqs.get(term) ?? 0;
      if (df === 0) continue;

      // IDF with smoothing
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

      const termDocs = this.termFreqs.get(term);
      if (!termDocs) continue;

      for (const doc of this.docs) {
        const tf = termDocs.get(doc.id) ?? 0;
        if (tf === 0) continue;

        const normTf =
          (tf * (this.k1 + 1)) /
          (tf + this.k1 * (1 - this.b + this.b * (doc.length / this.avgDocLength)));

        scores.set(doc.id, (scores.get(doc.id) ?? 0) + idf * normTf);
      }
    }

    return Array.from(scores.entries())
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}
