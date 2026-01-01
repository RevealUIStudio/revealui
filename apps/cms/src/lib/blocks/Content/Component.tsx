/* eslint-disable @typescript-eslint/no-explicit-any */
import { Page } from "@/types" // Importing the Page type
import React from "react"
import { cn } from "@/lib/styles/classnames"
import { CMSLink } from "../../components/Link" // Used for rendering links
import RichText from "../../components/RichText" // Used for rendering rich text content

// Define possible sizes for columns
type SizeType = "full" | "half" | "oneThird" | "twoThirds"

// Mapping of size types to Tailwind CSS grid classes
const colsSpanClasses: Record<SizeType, string> = {
  full: "12",
  half: "6",
  oneThird: "4",
  twoThirds: "8",
}

// Define the structure of a column
type ColumnType = {
  enableLink: boolean // Represents if a link should be rendered
  link?: {
    href: string // The URL for the link
    label: string // The text to display for the link
  } | null // Link can be null if not provided
  richText: Record<string, any> // Rich text content for rendering
  size: SizeType // Size of the column
}

// Props type for the ContentBlock component
export type Props = Extract<Page["layout"][0], { blockType: "content" }> & {
  columns: ColumnType[] // Ensure columns is defined as an array of ColumnType
}

// Main ContentBlock component
export const ContentBlock: React.FC<Props> = ({ columns }) => {
  return (
    <div className="container my-16">
      <div className="grid grid-cols-4 lg:grid-cols-12 gap-y-8 gap-x-16">
        {columns &&
          columns.length > 0 &&
          columns.map((col: ColumnType, index: number) => {
            const { enableLink, link, richText, size } = col

            // Validate column size
            const colSize = size in colsSpanClasses ? size : "full"

            return (
              <div
                className={cn(
                  `col-span-4 lg:col-span-${colsSpanClasses[colSize]}`,
                  {
                    "md:col-span-2": colSize !== "full", // Apply conditional class based on size
                  }
                )}
                key={index} // Key could be improved by using a unique identifier if available
              >
                {richText && (
                  <RichText content={richText} enableGutter={false} />
                )}

                {enableLink && link && (
                  <CMSLink href={link.href} label={link.label} />
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}

// /* eslint-disable @typescript-eslint/no-explicit-any */
// import { layoutUtils } from "reveal"; // Ensure layout utilities are used for class name handling
// import React from "react";
// import RichText from "../../components/RichText"; // Used for rendering rich text content
// import { CMSLink } from "../../components/Link"; // Used for rendering links
// import { Page } from "@/types";

// // Define possible sizes for columns
// type SizeType = "full" | "half" | "oneThird" | "twoThirds";

// // Mapping of size types to Tailwind CSS grid classes
// const colsSpanClasses: Record<SizeType, string> = {
//   full: "12",
//   half: "6",
//   oneThird: "4",
//   twoThirds: "8",
// };

// // Define the structure of a column
// type ColumnType = {
//   enableLink: boolean; // Represents if a link should be rendered
//   link?: {
//     href: string; // The URL for the link
//     label: string; // The text to display for the link
//   } | null; // Link can be null if not provided
//   richText: Record<string, any>; // Rich text content for rendering
//   size: SizeType; // Size of the column
// };

// // Props type for the ContentBlock component
// export type Props = Extract<Page["layout"][0], { blockType: "content" }> & {
//   columns: ColumnType[]; // Ensure columns is defined as an array of ColumnType
// };

// // Main ContentBlock component
// export const ContentBlock: React.FC<Props> = ({ columns }) => {
//   return (
//     <div className="container my-16">
//       <div className="grid grid-cols-4 lg:grid-cols-12 gap-y-8 gap-x-16">
//         {columns &&
//           columns.length > 0 &&
//           columns.map((col: ColumnType, index: number) => {
//             const { enableLink, link, richText, size } = col;

//             // Validate column size
//             const colSize = size in colsSpanClasses ? size : "full";

//             return (
//               <div
//                 className={cn(
//                   `col-span-4 lg:col-span-${colsSpanClasses[colSize]}`,
//                   {
//                     "md:col-span-2": colSize !== "full", // Apply conditional class based on size
//                   },
//                 )}
//                 key={index} // Key could be improved by using a unique identifier if available
//               >
//                 {richText && (
//                   <RichText content={richText} enableGutter={false} />
//                 )}

//                 {enableLink && link && (
//                   <CMSLink href={link.href} label={link.label} />
//                 )}
//               </div>
//             );
//           })}
//       </div>
//     </div>
//   );
// };

// /* eslint-disable @typescript-eslint/no-explicit-any */
// import { layoutUtils } from "reveal";
// import React from "react";
// import RichText from "../../components/RichText";
// import { CMSLink } from "../../components/Link";
// import { Page } from "../../collections/Pages";

// type SizeType = "full" | "half" | "oneThird" | "twoThirds";

// const colsSpanClasses: Record<SizeType, string> = {
//   full: "12",
//   half: "6",
//   oneThird: "4",
//   twoThirds: "8",
// };

// type ColumnType = {
//   enableLink: string;
//   link: object;
//   richText: Record<string, any>;
//   size: SizeType;
// };

// export type Props = Extract<Page["layout"][0], { blockType: "content" }> & {
//   columns: ColumnType[]; // Ensure columns is defined as an array of ColumnType
// };

// export const ContentBlock: React.FC<Props> = (props) => {
//   const { columns } = props;

//   return (
//     <div className="container my-16">
//       <div className="grid grid-cols-4 lg:grid-cols-12 gap-y-8 gap-x-16">
//         {columns &&
//           columns.length > 0 &&
//           columns.map((col: ColumnType, index: number) => {
//             // Added index parameter here
//             const { enableLink, link, richText, size } = col;

//             // Default to "full" if size is undefined or invalid
//             const colSize = size in colsSpanClasses ? size : "full";

//             return (
//               <div
//                 className={cn(
//                   `col-span-4 lg:col-span-${colsSpanClasses[colSize]}`,
//                   {
//                     "md:col-span-2": colSize !== "full",
//                   },
//                 )}
//                 key={index} // Use the index from map
//               >
//                 {richText && (
//                   <RichText content={richText} enableGutter={false} />
//                 )}

//                 {enableLink && <CMSLink {...link} />}
//               </div>
//             );
//           })}
//       </div>
//     </div>
//   );
// };
