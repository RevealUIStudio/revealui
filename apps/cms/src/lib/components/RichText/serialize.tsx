// biome-ignore-all lint/suspicious/noExplicitAny: Lexical nodes have complex dynamic types
// biome-ignore-all lint/suspicious/noArrayIndexKey: Lexical nodes lack stable IDs, index keys are standard
// biome-ignore-all lint/a11y/useSemanticElements: Lexical checklist uses li with checkbox role
// biome-ignore-all lint/a11y/noNoninteractiveElementToInteractiveRole: Lexical checklist pattern
import type { DefaultNodeTypes, SerializedBlockNode } from '@revealui/core/richtext-lexical'
import type { Page } from '@revealui/core/types/cms'
import React, { Fragment, type JSX } from 'react'
import { BannerBlock, type BannerBlockProps } from '../../blocks/Banner/Component'
import { CallToActionBlock } from '../../blocks/CallToAction/Component'
import { CodeBlock, type CodeBlockProps } from '../../blocks/Code/Component'
import { MediaBlock } from '../../blocks/MediaBlock/Component'
import { CMSLink } from '../Link'
import {
  IS_BOLD,
  IS_CODE,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_SUBSCRIPT,
  IS_SUPERSCRIPT,
  IS_UNDERLINE,
} from './nodeFormat'

// Define the node types including blocks and standard nodes
export type NodeTypes =
  | DefaultNodeTypes
  | SerializedBlockNode<
      | Extract<Page['layout'][0], { blockType: 'cta' }>
      | Extract<Page['layout'][0], { blockType: 'mediaBlock' }>
      | BannerBlockProps
      | CodeBlockProps
    >

type Props = {
  nodes: NodeTypes[]
}

// Function to serialize lexical nodes into React components
export function serializeLexical({ nodes }: Props): JSX.Element {
  return (
    <Fragment>
      {nodes?.map((node, index): JSX.Element | null => {
        if (node == null) {
          return null
        }

        // Cast node for property access since we're handling multiple node types
        const n = node as any

        // Handle text nodes with formatting
        if (node.type === 'text') {
          let text = <React.Fragment key={index}>{n.text}</React.Fragment>
          if (n.format & IS_BOLD) {
            text = <strong key={index}>{text}</strong>
          }
          if (n.format & IS_ITALIC) {
            text = <em key={index}>{text}</em>
          }
          if (n.format & IS_STRIKETHROUGH) {
            text = (
              <span key={index} style={{ textDecoration: 'line-through' }}>
                {text}
              </span>
            )
          }
          if (n.format & IS_UNDERLINE) {
            text = (
              <span key={index} style={{ textDecoration: 'underline' }}>
                {text}
              </span>
            )
          }
          if (n.format & IS_CODE) {
            text = <code key={index}>{n.text}</code>
          }
          if (n.format & IS_SUBSCRIPT) {
            text = <sub key={index}>{text}</sub>
          }
          if (n.format & IS_SUPERSCRIPT) {
            text = <sup key={index}>{text}</sup>
          }

          return text
        }

        // NOTE: Hacky fix for
        // https://github.com/facebook/lexical/blob/d10c4e6e55261b2fdd7d1845aed46151d0f06a8c/packages/lexical-list/src/LexicalListItemNode.ts#L133
        // which does not return checked: false (only true - i.e. there is no prop for false)
        const serializedChildrenFn = (node: NodeTypes): JSX.Element | null => {
          if ((node as any).children == null) {
            return null
          } else {
            if ((node as any)?.type === 'list' && (node as any)?.listType === 'check') {
              for (const item of (node as any).children) {
                if ('checked' in item) {
                  if (!item?.checked) {
                    item.checked = false
                  }
                }
              }
            }
            return serializeLexical({ nodes: (node as any).children as NodeTypes[] })
          }
        }

        const serializedChildren = 'children' in node ? serializedChildrenFn(node) : ''

        // Handle block nodes
        if (node.type === 'block') {
          const block = n.fields
          const blockType = block?.blockType

          if (!block || !blockType) {
            return null
          }

          switch (blockType) {
            case 'cta':
              return <CallToActionBlock key={index} {...block} />
            case 'mediaBlock':
              return (
                <MediaBlock
                  className="col-start-1 col-span-3"
                  imgClassName="m-0"
                  key={index}
                  {...block}
                  captionClassName="mx-auto max-w-[48rem]"
                  enableGutter={false}
                  disableInnerContainer={true}
                />
              )
            case 'banner':
              return <BannerBlock className="col-start-2 mb-4" key={index} {...block} />
            case 'code':
              return <CodeBlock className="col-start-2" key={index} {...block} />
            default:
              return null
          }
        } else {
          // Handle other node types
          switch (node.type) {
            case 'linebreak': {
              return <br className="col-start-2" key={index} />
            }
            case 'paragraph': {
              return (
                <p className="col-start-2" key={index}>
                  {serializedChildren}
                </p>
              )
            }
            case 'heading': {
              const Tag = n?.tag
              return (
                <Tag className="col-start-2" key={index}>
                  {serializedChildren}
                </Tag>
              )
            }
            case 'list': {
              const Tag = n?.tag
              return (
                <Tag className="list col-start-2" key={index}>
                  {serializedChildren}
                </Tag>
              )
            }
            case 'listitem': {
              if (n?.checked != null) {
                return (
                  <li
                    aria-checked={n.checked ? 'true' : 'false'}
                    className={` ${n.checked ? '' : ''}`}
                    key={index}
                    role="checkbox"
                    tabIndex={-1}
                    value={n?.value}
                  >
                    {serializedChildren}
                  </li>
                )
              } else {
                return (
                  <li key={index} value={n?.value}>
                    {serializedChildren}
                  </li>
                )
              }
            }
            case 'quote': {
              return (
                <blockquote className="col-start-2" key={index}>
                  {serializedChildren}
                </blockquote>
              )
            }
            case 'link': {
              const fields = n.fields

              return (
                <CMSLink
                  key={index}
                  newTab={Boolean(fields?.newTab)}
                  reference={fields.doc as any}
                  type={fields.linkType === 'internal' ? 'reference' : 'custom'}
                  url={fields.url}
                >
                  {serializedChildren}
                </CMSLink>
              )
            }

            default:
              return null
          }
        }
      })}
    </Fragment>
  )
}
