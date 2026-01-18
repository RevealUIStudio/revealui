'use client'

/**
 * RevealUI Rich Text Editor - DecoratorBlockNode Base Class
 *
 * Base class for custom block nodes in Lexical editor.
 * Moved to separate file to avoid circular dependency issues.
 */

import {
  DecoratorNode,
  type ElementFormatType,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical'
import type { JSX } from 'react'

export type SerializedDecoratorBlockNode<
  T extends Record<string, unknown> = Record<string, unknown>,
> = Spread<
  {
    format: ElementFormatType
    fields: T
  },
  SerializedLexicalNode
>

export abstract class DecoratorBlockNode<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends DecoratorNode<JSX.Element> {
  __format: ElementFormatType

  constructor(format?: ElementFormatType, key?: NodeKey) {
    super(key)
    this.__format = format || ''
  }

  getFormat(): ElementFormatType {
    return this.getLatest().__format
  }

  setFormat(format: ElementFormatType): void {
    const writable = this.getWritable()
    writable.__format = format
  }

  exportJSON(): SerializedDecoratorBlockNode<T> {
    return {
      ...super.exportJSON(),
      format: this.__format,
      fields: {} as T,
    }
  }
}
