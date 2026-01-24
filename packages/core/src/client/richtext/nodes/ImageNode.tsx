'use client'

/**
 * RevealUI Rich Text Editor - Image Node
 *
 * A DecoratorNode for rendering images in the Lexical editor.
 */

import type {
  DOMExportOutput,
  ElementFormatType,
  LexicalCommand,
  LexicalNode,
  NodeKey,
  Spread,
} from 'lexical'
import { $applyNodeReplacement, createCommand } from 'lexical'
import * as React from 'react'
import { DecoratorBlockNode, type SerializedDecoratorBlockNode } from './DecoratorBlockNode.js'

const ImageComponent = React.lazy(() =>
  import('../components/ImageNodeComponent.js').then((module) => ({
    default: module.ImageNodeComponent,
  })),
)

export type ImageNodeData = {
  src: string
  alt?: string
  width?: number
  height?: number
  caption?: string
}

export type SerializedImageNode = Spread<
  {
    children?: never
    type: 'image'
    fields: ImageNodeData
  },
  SerializedDecoratorBlockNode
>

export const INSERT_IMAGE_COMMAND: LexicalCommand<ImageNodeData> =
  createCommand('INSERT_IMAGE_COMMAND')

export const OPEN_IMAGE_UPLOAD_COMMAND: LexicalCommand<{
  data?: ImageNodeData | null
  nodeKey?: string
}> = createCommand('OPEN_IMAGE_UPLOAD_COMMAND')

export class ImageNode extends DecoratorBlockNode {
  __data: ImageNodeData

  constructor({
    data,
    format,
    key,
  }: {
    data: ImageNodeData
    format?: ElementFormatType
    key?: NodeKey
  }) {
    super(format, key)
    this.__data = data
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode({
      data: node.__data,
      format: node.__format,
      key: node.__key,
    })
  }

  static getType(): string {
    return 'image'
  }

  /**
   * Import from JSON - takes saved data and converts it into a node.
   */
  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    const importedData: ImageNodeData = {
      src: serializedNode.fields.src,
      alt: serializedNode.fields.alt,
      width: serializedNode.fields.width,
      height: serializedNode.fields.height,
      caption: serializedNode.fields.caption,
    }
    const node = $createImageNode(importedData)
    node.setFormat(serializedNode.format)
    return node
  }

  /**
   * Render React component for the image
   */
  decorate(): React.ReactElement {
    return <ImageComponent nodeKey={this.__key} data={this.__data} />
  }

  exportDOM(): DOMExportOutput {
    const img = document.createElement('img')
    img.setAttribute('src', this.__data.src)
    if (this.__data.alt) {
      img.setAttribute('alt', this.__data.alt)
    }
    if (this.__data.width) {
      img.setAttribute('width', String(this.__data.width))
    }
    if (this.__data.height) {
      img.setAttribute('height', String(this.__data.height))
    }
    const container = document.createElement('figure')
    container.appendChild(img)
    if (this.__data.caption) {
      const caption = document.createElement('figcaption')
      caption.textContent = this.__data.caption
      container.appendChild(caption)
    }
    return { element: container }
  }

  exportJSON(): SerializedImageNode {
    return {
      ...super.exportJSON(),
      fields: this.getData(),
      type: 'image',
      version: 1,
    }
  }

  getData(): ImageNodeData {
    return this.getLatest().__data
  }

  setData(data: ImageNodeData): void {
    const writable = this.getWritable()
    writable.__data = data
  }

  getTextContent(): string {
    return '\n'
  }
}

export function $createImageNode(data: ImageNodeData): ImageNode {
  return $applyNodeReplacement(
    new ImageNode({
      data,
    }),
  )
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode
}
