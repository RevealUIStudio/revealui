/**
 * Character-set sanitizers for Mermaid / SVG text. No authored regex.
 */

const CONTROL_MAX = 31;

function isControlChar(char: string): boolean {
  const code = char.codePointAt(0);
  return code !== undefined && code <= CONTROL_MAX;
}

/** Flatten a node/edge label so Mermaid flowchart text stays one safe line. */
export function mermaidLabel(text: string): string {
  return Array.from(text)
    .map((char) => {
      if (char === '"') return "'";
      if (char === '[' || char === '{') return '(';
      if (char === ']' || char === '}') return ')';
      if (char === '|') return '/';
      if (char === '\n' || char === '\r') return ' ';
      if (isControlChar(char)) return '';
      return char;
    })
    .join('');
}

/** Escape text for an SVG text node. */
export function svgText(text: string): string {
  return Array.from(text)
    .map((char) => {
      if (char === '&') return '&amp;';
      if (char === '<') return '&lt;';
      if (char === '>') return '&gt;';
      if (char === '"') return '&quot;';
      if (char === "'") return '&apos;';
      if (isControlChar(char)) return '';
      return char;
    })
    .join('');
}

/** Stable Mermaid node id (`n0`, `n1`, …). Index is assigned by the caller. */
export function mermaidNodeId(index: number): string {
  return `n${index}`;
}
