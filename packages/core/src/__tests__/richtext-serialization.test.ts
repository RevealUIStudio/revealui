/**
 * Rich Text Editor - Serialization Tests
 *
 * Tests both server-side (RSC) and client-side (RCC) serializers.
 * Uses renderToStaticMarkup to verify React element output.
 */

import type { SerializedEditorState } from 'lexical'
import ReactDOMServer from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { serializeLexicalStateClient } from '../richtext/exports/client/rcc.js'
import { serializeLexicalState } from '../richtext/exports/server/rsc.js'

// ============================================
// TEST FIXTURES
// ============================================

function makeState(children: unknown[]): SerializedEditorState {
  return {
    root: {
      children: children as SerializedEditorState['root']['children'],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  }
}

function renderRsc(state: SerializedEditorState): string {
  const el = serializeLexicalState(state)
  return el ? ReactDOMServer.renderToStaticMarkup(el) : ''
}

function renderRcc(state: SerializedEditorState): string {
  const el = serializeLexicalStateClient(state)
  return el ? ReactDOMServer.renderToStaticMarkup(el) : ''
}

const plainParagraph = makeState([
  {
    type: 'paragraph',
    children: [{ type: 'text', text: 'Hello world', format: 0 }],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  },
])

const boldText = makeState([
  {
    type: 'paragraph',
    children: [{ type: 'text', text: 'Bold', format: 1 }],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  },
])

const italicText = makeState([
  {
    type: 'paragraph',
    children: [{ type: 'text', text: 'Italic', format: 2 }],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  },
])

const heading = makeState([
  {
    type: 'heading',
    tag: 'h2',
    children: [{ type: 'text', text: 'Title', format: 0 }],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  },
])

const quote = makeState([
  {
    type: 'quote',
    children: [{ type: 'text', text: 'A wise quote', format: 0 }],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  },
])

const unorderedList = makeState([
  {
    type: 'list',
    listType: 'bullet',
    children: [
      {
        type: 'listitem',
        children: [{ type: 'text', text: 'Item 1', format: 0 }],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
        value: 1,
      },
      {
        type: 'listitem',
        children: [{ type: 'text', text: 'Item 2', format: 0 }],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
        value: 2,
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  },
])

const link = makeState([
  {
    type: 'paragraph',
    children: [
      {
        type: 'link',
        url: 'https://example.com',
        children: [{ type: 'text', text: 'Click here', format: 0 }],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
        fields: { url: 'https://example.com', newTab: true },
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  },
])

const linebreak = makeState([
  {
    type: 'paragraph',
    children: [
      { type: 'text', text: 'Line 1', format: 0 },
      { type: 'linebreak', version: 1 },
      { type: 'text', text: 'Line 2', format: 0 },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  },
])

const horizontalRule = makeState([{ type: 'horizontalrule', version: 1 }])

const codeBlock = makeState([
  {
    type: 'code',
    children: [{ type: 'text', text: 'const x = 1', format: 0 }],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  },
])

const mixedFormatting = makeState([
  {
    type: 'paragraph',
    children: [
      { type: 'text', text: 'Normal ', format: 0 },
      { type: 'text', text: 'bold', format: 1 },
      { type: 'text', text: ' and ', format: 0 },
      { type: 'text', text: 'italic', format: 2 },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  },
])

// ============================================
// RSC SERIALIZER TESTS
// ============================================

describe('serializeLexicalState (RSC)', () => {
  it('returns null for null input', () => {
    expect(serializeLexicalState(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(serializeLexicalState(undefined)).toBeNull()
  })

  it('returns null for empty root', () => {
    expect(
      serializeLexicalState({
        root: { children: [], direction: 'ltr', format: '', indent: 0, type: 'root', version: 1 },
      }),
    ).toBeNull()
  })

  it('serializes a plain paragraph', () => {
    const html = renderRsc(plainParagraph)
    expect(html).toContain('<p>')
    expect(html).toContain('Hello world')
  })

  it('serializes bold text', () => {
    const html = renderRsc(boldText)
    expect(html).toContain('<strong>')
    expect(html).toContain('Bold')
  })

  it('serializes italic text', () => {
    const html = renderRsc(italicText)
    expect(html).toContain('<em>')
    expect(html).toContain('Italic')
  })

  it('serializes headings', () => {
    const html = renderRsc(heading)
    expect(html).toContain('<h2>')
    expect(html).toContain('Title')
  })

  it('serializes blockquotes', () => {
    const html = renderRsc(quote)
    expect(html).toContain('<blockquote>')
    expect(html).toContain('A wise quote')
  })

  it('serializes unordered lists', () => {
    const html = renderRsc(unorderedList)
    expect(html).toContain('<ul>')
    expect(html).toContain('<li')
    expect(html).toContain('Item 1')
    expect(html).toContain('Item 2')
  })

  it('serializes links with target', () => {
    const html = renderRsc(link)
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('Click here')
  })

  it('serializes linebreaks', () => {
    const html = renderRsc(linebreak)
    expect(html).toContain('<br')
    expect(html).toContain('Line 1')
    expect(html).toContain('Line 2')
  })

  it('serializes horizontal rules', () => {
    const html = renderRsc(horizontalRule)
    expect(html).toContain('<hr')
  })

  it('serializes code blocks', () => {
    const html = renderRsc(codeBlock)
    expect(html).toContain('<pre>')
    expect(html).toContain('<code>')
    expect(html).toContain('const x = 1')
  })

  it('serializes mixed formatting', () => {
    const html = renderRsc(mixedFormatting)
    expect(html).toContain('Normal ')
    expect(html).toContain('<strong>')
    expect(html).toContain('<em>')
  })
})

// ============================================
// RCC SERIALIZER TESTS
// ============================================

describe('serializeLexicalStateClient (RCC)', () => {
  it('returns null for null input', () => {
    expect(serializeLexicalStateClient(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(serializeLexicalStateClient(undefined)).toBeNull()
  })

  it('serializes a plain paragraph', () => {
    const html = renderRcc(plainParagraph)
    expect(html).toContain('<p>')
    expect(html).toContain('Hello world')
  })

  it('serializes bold text', () => {
    const html = renderRcc(boldText)
    expect(html).toContain('<strong>')
    expect(html).toContain('Bold')
  })

  it('serializes italic text', () => {
    const html = renderRcc(italicText)
    expect(html).toContain('<em>')
    expect(html).toContain('Italic')
  })

  it('serializes headings', () => {
    const html = renderRcc(heading)
    expect(html).toContain('<h2>')
    expect(html).toContain('Title')
  })

  it('serializes blockquotes', () => {
    const html = renderRcc(quote)
    expect(html).toContain('<blockquote>')
    expect(html).toContain('A wise quote')
  })

  it('serializes unordered lists', () => {
    const html = renderRcc(unorderedList)
    expect(html).toContain('<ul>')
    expect(html).toContain('<li')
    expect(html).toContain('Item 1')
  })

  it('serializes linebreaks', () => {
    const html = renderRcc(linebreak)
    expect(html).toContain('<br')
  })

  it('serializes horizontal rules', () => {
    const html = renderRcc(horizontalRule)
    expect(html).toContain('<hr')
  })

  it('serializes code blocks', () => {
    const html = renderRcc(codeBlock)
    expect(html).toContain('<pre>')
    expect(html).toContain('<code>')
  })

  it('serializes mixed formatting', () => {
    const html = renderRcc(mixedFormatting)
    expect(html).toContain('<strong>')
    expect(html).toContain('<em>')
  })
})

// ============================================
// RSC vs RCC PARITY TESTS
// ============================================

describe('RSC / RCC serializer parity', () => {
  const fixtures = [
    ['paragraph', plainParagraph],
    ['bold', boldText],
    ['italic', italicText],
    ['heading', heading],
    ['quote', quote],
    ['list', unorderedList],
    ['linebreak', linebreak],
    ['horizontal rule', horizontalRule],
    ['code block', codeBlock],
  ] as const

  it.each(fixtures)('%s produces equivalent output', (_name, state) => {
    const rsc = renderRsc(state as SerializedEditorState)
    const rcc = renderRcc(state as SerializedEditorState)

    // Both should produce non-empty output
    expect(rsc.length).toBeGreaterThan(0)
    expect(rcc.length).toBeGreaterThan(0)

    // Both should contain the same primary HTML elements
    // (exact attribute order may differ, so we check key content)
    const rscTags = rsc.match(/<\w+/g) || []
    const rccTags = rcc.match(/<\w+/g) || []
    expect(rccTags).toEqual(rscTags)
  })
})
