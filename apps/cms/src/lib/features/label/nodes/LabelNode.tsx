'use client';

import './index.css';
import {
  DecoratorBlockNode,
  type SerializedDecoratorBlockNode,
} from '@revealui/core/richtext/client';
import type {
  DOMExportOutput,
  ElementFormatType,
  LexicalCommand,
  LexicalNode,
  NodeKey,
  Spread,
} from 'lexical';
import { $applyNodeReplacement, createCommand } from 'lexical';
import * as React from 'react';

// Lazy load the LabelComponent
const LabelComponent = React.lazy(() =>
  import('../components/LabelNodeComponent.js').then((module) => ({
    default: module.default,
  })),
);

// Define the data type for the LabelNode
export type LabelNodeData = {
  url: string;
};

// Define the serialized format for the LabelNode
export type SerializedLabelNode = Spread<
  {
    children?: never; // required so that our typed editor state doesn't automatically add children
    type: 'label';
    fields: LabelNodeData;
  },
  SerializedDecoratorBlockNode
>;

// Define commands for inserting the label and opening the label drawer
export const INSERT_LABEL_COMMAND: LexicalCommand<LabelNodeData> =
  createCommand('INSERT_LABEL_COMMAND');

export const OPEN_LABEL_DRAWER_COMMAND: LexicalCommand<{
  data?: LabelNodeData | null;
  nodeKey?: string;
}> = createCommand('OPEN_LABEL_DRAWER_COMMAND');

// Define the LabelNode class
export class LabelNode extends DecoratorBlockNode {
  __data: LabelNodeData;

  constructor({
    data,
    format,
    key,
  }: {
    data: LabelNodeData;
    format?: ElementFormatType;
    key?: NodeKey;
  }) {
    super(format, key);
    this.__data = data;
  }

  static clone(node: LabelNode): LabelNode {
    return new LabelNode({
      data: node.__data,
      format: node.__format,
      key: node.__key,
    });
  }

  static getType(): string {
    return 'label';
  }

  static importJSON(serializedNode: SerializedLabelNode): LabelNode {
    const importedData: LabelNodeData = {
      url: serializedNode.fields.url,
    };
    const node = $createLabelNode(importedData);
    node.setFormat(serializedNode.format);
    return node;
  }

  decorate(): React.ReactElement {
    return <LabelComponent nodeKey={this.__key} data={this.__data} />;
  }

  exportDOM(): DOMExportOutput {
    return { element: document.createElement('div') };
  }

  exportJSON(): SerializedLabelNode {
    return {
      ...super.exportJSON(),
      fields: this.getData(),
      type: 'label',
      version: 2,
    };
  }

  getData(): LabelNodeData {
    return this.getLatest().__data;
  }

  setData(data: LabelNodeData): void {
    const writable = this.getWritable();
    writable.__data = data;
  }

  getTextContent(): string {
    return '\n';
  }
}

// Helper functions for creating and checking LabelNode instances
export function $createLabelNode(data: LabelNodeData): LabelNode {
  return $applyNodeReplacement(
    new LabelNode({
      data,
    }),
  );
}

export function $isLabelNode(node: LexicalNode | null | undefined): node is LabelNode {
  return node instanceof LabelNode;
}

// // 'use server'
// 'use client'

// import './index.css'
// const baseClass = 'rich-text-label'
// interface NodeData {
//   id: string
//   type: string
//   // other properties as needed
// }

// interface LabelNodeProps {
//   attributes: React.HTMLAttributes<HTMLDivElement>
//   node: NodeData // Use the specific type here
//   children: React.ReactNode
// }
// const LabelNode: React.FC<LabelNodeProps> = ({ attributes, children }) => (
//   <div {...attributes}>
//     <span className={baseClass}>{children}</span>
//   </div>
// )
// export default LabelNode
// import type {
//   DOMExportOutput,
//   ElementFormatType,
//   LexicalCommand,
//   LexicalNode,
//   NodeKey,
//   Spread
// } from 'lexical'

// import {
//   DecoratorBlockNode,
//   SerializedDecoratorBlockNode
// } from '@lexical/react/LexicalDecoratorBlockNode'
// import { $applyNodeReplacement, createCommand } from 'lexical'
// import * as React from 'react'

// const LabelComponent = React.lazy(() =>
//   import('../components/LabelNodeComponent.js').then((module) => ({
//     // default: module.Label.NodeComponent
//     default: module.default
//   }))
// )

// export type LabelNodeData = {
//   url: string
// }

// export type SerializedLabelNode = Spread<
//   {
//     children?: never // required so that our typed editor state doesn't automatically add children
//     type: 'label'
//     fields: LabelNodeData
//   },
//   SerializedDecoratorBlockNode
// >

// export const INSERT_LABEL_COMMAND: LexicalCommand<LabelNodeData> =
//   createCommand('INSERT_LABEL_COMMAND')

// export const OPEN_LABEL_DRAWER_COMMAND: LexicalCommand<{
//   data?: LabelNodeData | null
//   nodeKey?: string
// }> = createCommand('OPEN_LABEL_DRAWER_COMMAND')

// export class LabelNode extends DecoratorBlockNode {
//   __data: LabelNodeData

//   constructor({
//     data,
//     format,
//     key
//   }: {
//     data: LabelNodeData
//     format?: ElementFormatType
//     key?: NodeKey
//   }) {
//     super(format, key)
//     this.__data = data
//   }

//   static clone(node: LabelNode): LabelNode {
//     return new LabelNode({
//       data: node.__data,
//       format: node.__format,
//       key: node.__key
//     })
//   }

//   static getType(): string {
//     return 'label'
//   }

//   /**
//    * The data for this node is stored serialized as JSON. This is the "load function" of that node: it takes the saved data and converts it into a node.
//    */
//   static importJSON(serializedNode: SerializedLabelNode): LabelNode {
//     const importedData: LabelNodeData = {
//       url: serializedNode.fields.url
//     }
//     const node = $createLabelNode(importedData)
//     node.setFormat(serializedNode.format)
//     return node
//   }

//   /**
//    * Allows you to render a React component within whatever createDOM returns.
//    */
//   decorate(): React.ReactElement {
//     return <LabelComponent nodeKey={this.__key} data={this.__data} />
//   }

//   exportDOM(): DOMExportOutput {
//     return { element: document.createElement('div') }
//   }

//   exportJSON(): SerializedLabelNode {
//     return {
//       ...super.exportJSON(),
//       fields: this.getData(),
//       type: 'label',
//       version: 2
//     }
//   }

//   getData(): LabelNodeData {
//     return this.getLatest().__data
//   }

//   setData(data: LabelNodeData): void {
//     const writable = this.getWritable()
//     writable.__data = data
//   }

//   getTextContent(): string {
//     return '\n'
//   }
// }

// export function $createLabelNode(data: LabelNodeData): LabelNode {
//   return $applyNodeReplacement(
//     new LabelNode({
//       data
//     })
//   )
// }

// export function $isLabelNode(
//   node: LexicalNode | null | undefined
// ): node is LabelNode {
//   return node instanceof LabelNode
// }
