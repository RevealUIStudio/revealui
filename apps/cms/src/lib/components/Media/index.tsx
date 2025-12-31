/* eslint-disable @typescript-eslint/no-explicit-any */
// Media.tsx
import React, { Fragment } from "react";
import type { Props } from "./types";
import { ImageMedia } from "./ImageMedia";
import { VideoMedia } from "./VideoMedia";

export const Media: React.FC<Props> = (props) => {
  const { className, htmlElement = "div", resource } = props;

  const isVideo =
    typeof resource === "object" &&
    resource !== null &&
    "mimeType" in resource &&
    resource.mimeType?.includes("video");

  const Tag = (htmlElement as any) || Fragment;

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
  );
};

// /* eslint-disable @typescript-eslint/no-explicit-any */
// import React, { Fragment } from "react";

// import type { Props } from "./types";

// import { ImageMedia } from "./ImageMedia";
// import { VideoMedia } from "./VideoMedia";

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
