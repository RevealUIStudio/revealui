/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  DefaultNodeTypes,
  SerializedBlockNode,
} from "@revealui/cms/richtext-lexical";
import React, { Fragment, JSX } from "react";
import { BannerBlock, BannerBlockProps } from "../../blocks/Banner/Component";
import { CallToActionBlock } from "../../blocks/CallToAction/Component";
import { CodeBlockProps, CodeBlock } from "../../blocks/Code/Component";
import { MediaBlock } from "../../blocks/MediaBlock/Component";
import { Page } from "@/types";
import { CMSLink } from "../Link";
import {
  IS_BOLD,
  IS_CODE,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_SUBSCRIPT,
  IS_SUPERSCRIPT,
  IS_UNDERLINE,
} from "./nodeFormat";

// Define the node types including blocks and standard nodes
export type NodeTypes =
  | DefaultNodeTypes
  | SerializedBlockNode<
      | Extract<Page["layout"][0], { blockType: "cta" }>
      | Extract<Page["layout"][0], { blockType: "mediaBlock" }>
      | BannerBlockProps
      | CodeBlockProps
    >;

type Props = {
  nodes: NodeTypes[]; // Array of node types to serialize
};

// Function to serialize lexical nodes into React components
export function serializeLexical({ nodes }: Props): JSX.Element {
  return (
    <Fragment>
      {nodes?.map((node, index): JSX.Element | null => {
        if (node == null) {
          return null; // Return null for undefined nodes
        }

        // Handle text nodes with formatting
        if (node.type === "text") {
          let text = <React.Fragment key={index}>{node.text}</React.Fragment>;
          if (node.format & IS_BOLD) {
            text = <strong key={index}>{text}</strong>;
          }
          if (node.format & IS_ITALIC) {
            text = <em key={index}>{text}</em>;
          }
          if (node.format & IS_STRIKETHROUGH) {
            text = (
              <span key={index} style={{ textDecoration: "line-through" }}>
                {text}
              </span>
            );
          }
          if (node.format & IS_UNDERLINE) {
            text = (
              <span key={index} style={{ textDecoration: "underline" }}>
                {text}
              </span>
            );
          }
          if (node.format & IS_CODE) {
            text = <code key={index}>{node.text}</code>;
          }
          if (node.format & IS_SUBSCRIPT) {
            text = <sub key={index}>{text}</sub>;
          }
          if (node.format & IS_SUPERSCRIPT) {
            text = <sup key={index}>{text}</sup>;
          }

          return text; // Return formatted text
        }

        // Function to handle children serialization
        const serializedChildrenFn = (node: NodeTypes): JSX.Element | null => {
          // Type guard: check if node has children property
          if (!("children" in node) || node.children == null) {
            return null; // Return null for nodes without children or empty children
          }
          return serializeLexical({ nodes: node.children as NodeTypes[] });
        };

        const serializedChildren =
          "children" in node ? serializedChildrenFn(node) : "";

        // Handle block nodes
        if (node.type === "block") {
          const block = node.fields;
          const blockType = block?.blockType;

          if (!block || !blockType) {
            return null; // Return null if block is invalid
          }

          switch (blockType) {
            case "cta":
              return <CallToActionBlock key={index} {...block} />;
            case "mediaBlock":
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
              );
            case "banner":
              return (
                <BannerBlock
                  // className="col-start-2 mb-4"
                  key={index}
                  {...block}
                />
              );
            case "code":
              return (
                <CodeBlock className="col-start-2" key={index} {...block} />
              );
            default:
              return null; // Return null for unknown block types
          }
        } else {
          // Handle other node types
          switch (node.type) {
            case "linebreak": {
              return <br className="col-start-2" key={index} />;
            }
            case "paragraph": {
              return (
                <p className="col-start-2" key={index}>
                  {serializedChildren}
                </p>
              );
            }
            case "heading": {
              const Tag = node?.tag; // Wrap this declaration in a block
              return (
                <Tag className="col-start-2" key={index}>
                  {serializedChildren}
                </Tag>
              );
            }
            case "list": {
              const ListTag = node?.tag; // Wrap this declaration in a block
              return (
                <ListTag className="list col-start-2" key={index}>
                  {serializedChildren}
                </ListTag>
              );
            }
            case "listitem": {
              return (
                <li key={index} value={node?.value}>
                  {serializedChildren}
                </li>
              );
            }
            case "quote": {
              return (
                <blockquote className="col-start-2" key={index}>
                  {serializedChildren}
                </blockquote>
              );
            }
            case "link": {
              const fields = node.fields;

              return (
                <CMSLink
                  key={index}
                  newTab={Boolean(fields?.newTab)}
                  reference={fields.doc as any}
                  type={fields.linkType === "internal" ? "reference" : "custom"}
                  url={fields.url}
                >
                  {serializedChildren}
                </CMSLink>
              );
            }
            default:
              return null; // Return null for unknown node types
          }
        }
      })}
    </Fragment>
  );
}

// /* eslint-disable @typescript-eslint/no-explicit-any */

// import {
//   DefaultNodeTypes,
//   SerializedBlockNode,
// } from "@revealui/cms/richtext-lexical";
// import React, { Fragment } from "react";
// import { BannerBlock } from "../../blocks/Banner/Component";
// import { CallToActionBlock } from "../../blocks/CallToAction/Component";
// import { CodeBlockProps, CodeBlock } from "../../blocks/Code/Component";
// import { MediaBlock } from "../../blocks/MediaBlock/Component";
// import {
//   IS_BOLD,
//   IS_CODE,
//   IS_ITALIC,
//   IS_STRIKETHROUGH,
//   IS_SUBSCRIPT,
//   IS_SUPERSCRIPT,
//   IS_UNDERLINE,
// } from "./nodeFormat";
// import { Page } from "@/types";
// import { CMSLink } from "../Link";

// export interface BannerBlockProps {
//   style: "info" | "warning" | "error" | "success";
//   content: {
//     root: {
//       type: string;
//       children: {
//         type: string;
//         version: number;
//         [k: string]: unknown;
//       }[];
//       direction: ("ltr" | "rtl") | null;
//       format: "left" | "start" | "center" | "right" | "end" | "justify" | "";
//       indent: number;
//       version: number;
//     };
//     [k: string]: unknown;
//   };
//   id?: string | null;
//   blockName?: string | null;
//   blockType: "banner";
// }

// export type NodeTypes =
//   | DefaultNodeTypes
//   | SerializedBlockNode<
//       | Extract<Page["layout"][0], { blockType: "cta" }>
//       | Extract<Page["layout"][0], { blockType: "mediaBlock" }>
//       | BannerBlockProps
//       | CodeBlockProps
//     >;

// type Props = {
//   nodes: NodeTypes[];
// };

// export function serializeLexical({ nodes }: Props): JSX.Element {
//   return (
//     <Fragment>
//       {nodes?.map((node, index): JSX.Element | null => {
//         if (node == null) {
//           return null;
//         }

//         if (node.type === "text") {
//           let text = <React.Fragment key={index}>{node.text}</React.Fragment>;
//           if (node.format & IS_BOLD) {
//             text = <strong key={index}>{text}</strong>;
//           }
//           if (node.format & IS_ITALIC) {
//             text = <em key={index}>{text}</em>;
//           }
//           if (node.format & IS_STRIKETHROUGH) {
//             text = (
//               <span key={index} style={{ textDecoration: "line-through" }}>
//                 {text}
//               </span>
//             );
//           }
//           if (node.format & IS_UNDERLINE) {
//             text = (
//               <span key={index} style={{ textDecoration: "underline" }}>
//                 {text}
//               </span>
//             );
//           }
//           if (node.format & IS_CODE) {
//             text = <code key={index}>{node.text}</code>;
//           }
//           if (node.format & IS_SUBSCRIPT) {
//             text = <sub key={index}>{text}</sub>;
//           }
//           if (node.format & IS_SUPERSCRIPT) {
//             text = <sup key={index}>{text}</sup>;
//           }

//           return text;
//         }

//         // NOTE: Hacky fix for
//         // https://github.com/facebook/lexical/blob/d10c4e6e55261b2fdd7d1845aed46151d0f06a8c/packages/lexical-list/src/LexicalListItemNode.ts#L133
//         // which does not return checked: false (only true - i.e. there is no prop for false)
//         const serializedChildrenFn = (node: NodeTypes): JSX.Element | null => {
//           if (node.children == null) {
//             return null;
//           } else {
//             if (node?.type === "list" && node?.listType === "check") {
//               for (const item of node.children) {
//                 if ("checked" in item) {
//                   if (!item?.checked) {
//                     item.checked = false;
//                   }
//                 }
//               }
//             }
//             return serializeLexical({ nodes: node.children as NodeTypes[] });
//           }
//         };

//         const serializedChildren =
//           "children" in node ? serializedChildrenFn(node) : "";

//         if (node.type === "block") {
//           const block = node.fields;

//           const blockType = block?.blockType;

//           if (!block || !blockType) {
//             return null;
//           }

//           switch (blockType) {
//             case "cta":
//               return <CallToActionBlock key={index} {...block} />;
//             case "mediaBlock":
//               return (
//                 <MediaBlock
//                   className="col-start-1 col-span-3"
//                   imgClassName="m-0"
//                   key={index}
//                   {...block}
//                   captionClassName="mx-auto max-w-[48rem]"
//                   enableGutter={false}
//                   disableInnerContainer={true}
//                 />
//               );
//             case "banner":
//               return (
//                 <BannerBlock
//                   className="col-start-2 mb-4"
//                   key={index}
//                   {...block}
//                 />
//               );
//             case "code":
//               return (
//                 <CodeBlock className="col-start-2" key={index} {...block} />
//               );
//             default:
//               return null;
//           }
//         } else {
//           switch (node.type) {
//             case "linebreak": {
//               return <br className="col-start-2" key={index} />;
//             }
//             case "paragraph": {
//               return (
//                 <p className="col-start-2" key={index}>
//                   {serializedChildren}
//                 </p>
//               );
//             }
//             case "heading": {
//               const Tag = node?.tag;
//               return (
//                 <Tag className="col-start-2" key={index}>
//                   {serializedChildren}
//                 </Tag>
//               );
//             }
//             case "list": {
//               const Tag = node?.tag;
//               return (
//                 <Tag className="list col-start-2" key={index}>
//                   {serializedChildren}
//                 </Tag>
//               );
//             }
//             case "listitem": {
//               if (node?.checked != null) {
//                 return (
//                   <li
//                     aria-checked={node.checked ? "true" : "false"}
//                     className={` ${node.checked ? "" : ""}`}
//                     key={index}
//                     // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role
//                     role="checkbox"
//                     tabIndex={-1}
//                     value={node?.value}
//                   >
//                     {serializedChildren}
//                   </li>
//                 );
//               } else {
//                 return (
//                   <li key={index} value={node?.value}>
//                     {serializedChildren}
//                   </li>
//                 );
//               }
//             }
//             case "quote": {
//               return (
//                 <blockquote className="col-start-2" key={index}>
//                   {serializedChildren}
//                 </blockquote>
//               );
//             }
//             case "link": {
//               const fields = node.fields;

//               return (
//                 <CMSLink
//                   key={index}
//                   newTab={Boolean(fields?.newTab)}
//                   reference={fields.doc as any}
//                   type={fields.linkType === "internal" ? "reference" : "custom"}
//                   url={fields.url}
//                 >
//                   {serializedChildren}
//                 </CMSLink>
//               );
//             }

//             default:
//               return null;
//           }
//         }
//       })}
//     </Fragment>
//   );
// }
