// Media.tsx
import type React from 'react'
import { Fragment } from 'react'
import { ImageMedia } from './ImageMedia/index.js'
import type { Props } from './types.js'
import { VideoMedia } from './VideoMedia/index.js'

export const Media: React.FC<Props> = (props) => {
  const { className, htmlElement = 'div', resource } = props

  const isVideo =
    typeof resource === 'object' &&
    resource !== null &&
    'mimeType' in resource &&
    resource.mimeType?.includes('video')

  // htmlElement can be a string (HTML tag name) or null/undefined
  const Tag =
    htmlElement && typeof htmlElement === 'string'
      ? (htmlElement as keyof JSX.IntrinsicElements)
      : Fragment

  return (
    <Tag
      {...(htmlElement !== null
        ? {
            className,
          }
        : {})}
    >
      {isVideo ? <VideoMedia {...props} /> : <ImageMedia {...props} />}
    </Tag>
  )
}

// /* eslint-disable @typescript-eslint/no-explicit-any */
// import React, { Fragment } from "react";

// import type { Props } from "./types.js";

// import { ImageMedia } from "./ImageMedia/index.js";
// import { VideoMedia } from "./VideoMedia/index.js";

// export const Media: React.FC<Props> = (props) => {
//   const { className, htmlElement = "div", resource } = props;

//   const isVideo =
//     typeof resource === "object" && resource?.mimeType?.includes("video");
//   const Tag = (htmlElement as any) || Fragment;

//   return (
//     <Tag
//       {...(htmlElement !== null
//         ? {
//             className,
//           }
//         : {})}
//     >
//       {isVideo ? <VideoMedia {...props} /> : <ImageMedia {...props} />}
//     </Tag>
//   );
// };
