import React, { Fragment } from "react";
import { CallToActionBlock } from "./CallToAction/Component";
import { ContentBlock } from "./Content/Component";
import { FormBlock } from "./Form/Component";
import { ArchiveBlock } from "./ArchiveBlock/Component";
import { MediaBlock } from "./MediaBlock/Component";
import { Page } from "@/types";
// import { BannerBlock } from "./Banner/Component";
// import { CodeBlock } from "./Code/Component";

// Define individual block types
type CallToActionBlockProps = Extract<Page["layout"][0], { blockType: "cta" }>;
type ContentBlockProps = Extract<Page["layout"][0], { blockType: "content" }>;
type FormBlockProps = Extract<Page["layout"][0], { blockType: "formBlock" }>;
type ArchiveBlockProps = Extract<Page["layout"][0], { blockType: "archive" }>;
type MediaBlockProps = Extract<Page["layout"][0], { blockType: "mediaBlock" }>;

// type CodeBlockProps = Extract<Page["layout"][0], { blockType: "code" }>;
// type BannerBlockProps = Extract<Page["layout"][0], { blockType: "banner" }>;

// Combine all block props into a single union type
export type BlockProps =
  | CallToActionBlockProps
  | ContentBlockProps
  | FormBlockProps
  | ArchiveBlockProps
  | MediaBlockProps;
// | BannerBlockProps
// | CodeBlockProps;

const blockComponents = {
  archive: ArchiveBlock,
  content: ContentBlock,
  cta: CallToActionBlock,
  formBlock: FormBlock,
  mediaBlock: MediaBlock,
  // banner: BannerBlock,
  // code: CodeBlock,
};

// Type for the RenderBlocks props
export const RenderBlocks: React.FC<{
  blocks: BlockProps;
}> = ({ blocks }) => {
  const hasBlocks = blocks && Array.isArray(blocks) && blocks.length > 0;

  if (hasBlocks) {
    return (
      <Fragment>
        {blocks.map((block, index) => {
          const { blockType } = block;

          // Ensure that blockType matches the keys of blockComponents
          const Block =
            blockComponents[blockType as keyof typeof blockComponents];

          if (Block) {
            return (
              <div className="my-16" key={index}>
                <Block {...block} />
                {/* Cast block to BlockProps */}
              </div>
            );
          }
          return null; // Handle case where blockType doesn't match any component
        })}
      </Fragment>
    );
  }

  return null; // Render nothing if there are no blocks
};

// import React, { Fragment } from "react";
// import { CallToActionBlock } from "./CallToAction/Component";
// import { ContentBlock } from "./Content/Component";
// import { FormBlock } from "./Form/Component";
// import { ArchiveBlock } from "./ArchiveBlock/Component";
// import { MediaBlock } from "./MediaBlock/Component";
// import { Page } from "@/types";

// // Define individual block types
// export type CallToActionBlockProps = Extract<
//   Page["layout"][0],
//   { blockType: "cta" }
// >;
// export type ContentBlockProps = Extract<
//   Page["layout"][0],
//   { blockType: "content" }
// >;
// export type FormBlockProps = Extract<
//   Page["layout"][0],
//   { blockType: "formBlock" }
// >;
// export type ArchiveBlockProps = Extract<
//   Page["layout"][0],
//   { blockType: "archive" }
// >;
// export type MediaBlockProps = Extract<
//   Page["layout"][0],
//   { blockType: "mediaBlock" }
// >;

// // Combine all block props into a single union type
// export type BlockProps =
//   | CallToActionBlockProps
//   | ContentBlockProps
//   | FormBlockProps
//   | ArchiveBlockProps
//   | MediaBlockProps;

// const blockComponents = {
//   archive: ArchiveBlock,
//   content: ContentBlock,
//   cta: CallToActionBlock,
//   formBlock: FormBlock,
//   mediaBlock: MediaBlock,
// };

// export const RenderBlocks: React.FC<{
//   blocks: Page["layout"][0][]; // Ensure this matches your structure
// }> = ({ blocks }) => {
//   const hasBlocks = blocks && Array.isArray(blocks) && blocks.length > 0;

//   if (hasBlocks) {
//     return (
//       <Fragment>
//         {blocks.map((block, index) => {
//           const { blockType } = block;

//           if (blockType && blockType in blockComponents) {
//             const Block = blockComponents[blockType];

//             return (
//               <div className="my-16" key={index}>
//                 <Block {...(block as BlockProps)} />{" "}
//               </div>
//             );
//           }
//           return null; // Handle case where blockType doesn't match any component
//         })}
//       </Fragment>
//     );
//   }

//   return null; // Render nothing if there are no blocks
// };

// import React, { Fragment } from "react";
// import { CallToActionBlock } from "./CallToAction/Component";
// import { ContentBlock } from "./Content/Component";
// import { FormBlock } from "./Form/Component";
// import { Page } from "@/types";
// import { ArchiveBlock } from "./ArchiveBlock/Component";
// import { MediaBlock } from "./MediaBlock/Component";
// // import type { Props as CallToActionBlockProps } from "./CallToAction/Component";
// // import type { Props as ContentBlockProps } from "./Content/Component";
// // import type { Props as FormBlockProps } from "./Form/Component";
// // import type { ArchiveBlockProps } from "./ArchiveBlock/Component";
// // import type { Props as MediaBlockProps } from "./MediaBlock/Component";

// export type CallToActionBlockProps = Extract<
//   Page["layout"][0],
//   { blockType: "cta" }
// >;
// export type ContentBlockProps = Extract<
//   Page["layout"][0],
//   { blockType: "content" }
// >;
// export type FormBlockProps = Extract<
//   Page["layout"][0],
//   { blockType: "formBlock" }
// >;
// export type ArchiveBlockProps = Extract<
//   Page["layout"][0],
//   { blockType: "archive" }
// >;
// export type MediaBlockProps = Extract<
//   Page["layout"][0],
//   { blockType: "mediaBlock" }
// >;
// // Combine into a single union type
// export type BlockProps =
//   | CallToActionBlockProps
//   | ContentBlockProps
//   | FormBlockProps
//   | ArchiveBlockProps
//   | MediaBlockProps;

// const blockComponents = {
//   archive: ArchiveBlock,
//   content: ContentBlock,
//   cta: CallToActionBlock,
//   formBlock: FormBlock,
//   mediaBlock: MediaBlock,
// };

// export const RenderBlocks: React.FC<{
//   blocks: Page["layout"][0][];
// }> = (props) => {
//   const { blocks } = props;

//   const hasBlocks = blocks && Array.isArray(blocks) && blocks.length > 0;

//   if (hasBlocks) {
//     return (
//       <Fragment>
//         {blocks.map((block, index) => {
//           const { blockType } = block;

//           if (blockType && blockType in blockComponents) {
//             const Block = blockComponents[blockType];

//             if (Block) {
//               return (
//                 <div className="my-16" key={index}>
//                   <Block {...block} />
//                 </div>
//               );
//             }
//           }
//           return null;
//         })}
//       </Fragment>
//     );
//   }

//   return null;
// };
