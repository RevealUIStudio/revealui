export interface Token {
  text: string;
  kind: 'word' | 'symbol' | 'whitespace';
  offset: number;
}

export function tokenize(text: string): Token[] {
  const seg = new Intl.Segmenter('en', { granularity: 'word' });
  const tokens: Token[] = [];
  for (const part of seg.segment(text)) {
    tokens.push({
      text: part.segment,
      kind: part.isWordLike ? 'word' : part.segment.trim() === '' ? 'whitespace' : 'symbol',
      offset: part.index,
    });
  }
  return tokens;
}
