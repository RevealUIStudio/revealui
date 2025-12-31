/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react"
import { cn } from "reveal/ui/layouts/classNames.js" // Ensure layout utilities are used for class name handling
import { serializeLexical } from "./serialize" // Serialize function for handling rich text content

type Props = {
  className?: string // Additional class names for styling
  content: Record<string, any> // Rich text content structure
  enableGutter?: boolean // Whether to enable gutter
  enableProse?: boolean // Whether to apply prose styles
}

// Main RichText component
const RichText: React.FC<Props> = ({
  className,
  content,
  enableGutter = true,
  enableProse = true,
}) => {
  if (!content) {
    return null // Return null if content is not provided
  }

  return (
    <div
      className={cn(
        {
          container: enableGutter,
          "max-w-none": !enableGutter,
          "mx-auto prose dark:prose-invert": enableProse,
        },
        className // Include additional class names
      )}
    >
      {
        content &&
          typeof content === "object" &&
          "root" in content &&
          serializeLexical({
            nodes: content.root.children,
          }) // Serialize and render rich text content
      }
    </div>
  )
}

export default RichText

// /* eslint-disable @typescript-eslint/no-explicit-any */
// import { layoutUtils } from "reveal";
// import React from "react";

// import { serializeLexical } from "./serialize";

// type Props = {
//   className?: string;
//   content: Record<string, any>;
//   enableGutter?: boolean;
//   enableProse?: boolean;
// };

// const RichText: React.FC<Props> = ({
//   className,
//   content,
//   enableGutter = true,
//   enableProse = true,
// }) => {
//   if (!content) {
//     return null;
//   }

//   return (
//     <div
//       className={cn(
//         {
//           "container ": enableGutter,
//           "max-w-none": !enableGutter,
//           "mx-auto prose dark:prose-invert ": enableProse,
//         },
//         className,
//       )}
//     >
//       {content &&
//         !Array.isArray(content) &&
//         typeof content === "object" &&
//         "root" in content &&
//         serializeLexical({ nodes: content?.root?.children })}
//     </div>
//   );
// };

// export default RichText;
