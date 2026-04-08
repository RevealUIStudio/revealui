'use client';

import cssVariables from 'cssVariables';
import type { StaticImageData } from 'next/image';
import NextImage from 'next/image';
import React from 'react';
import type { Props as MediaProps } from '../types';

const { breakpoints } = cssVariables;

export const ImageMedia = (props: MediaProps) => {
  const {
    alt: altFromProps,
    fill,
    imgClassName,
    onClick,
    onLoad: onLoadFromProps,
    priority,
    resource,
    size: sizeFromProps,
    src: srcFromProps,
  } = props;

  const [isLoading, setIsLoading] = React.useState(true);

  let width: number | undefined;
  let height: number | undefined;
  let alt = altFromProps;
  let src: StaticImageData | string = srcFromProps || '/path-to-fallback-image.png'; // Fallback image

  if (!srcFromProps && resource && typeof resource === 'object' && resource.url) {
    const { alt: altFromResource, height: fullHeight, url, width: fullWidth } = resource;

    width = fullWidth || 300; // Fallback
    height = fullHeight || 300; // Fallback
    alt = altFromResource || 'Default alt text';

    src = `${process.env.NEXT_PUBLIC_SERVER_URL}${url}`;
  }

  // Sizes attribute for responsive images
  const sizes = sizeFromProps
    ? sizeFromProps
    : Object.entries(breakpoints)
        .map(([, value]) => `(max-width: ${value}px) ${value}px`)
        .join(', ');

  function cn(imgClassName: string | undefined): string | undefined {
    if (!imgClassName) return undefined;
    return imgClassName.trim();
  }

  return (
    <>
      {isLoading && <div className="image-loading-spinner" />} {/* Spinner or placeholder */}
      <NextImage
        alt={alt || 'Image'}
        className={cn(imgClassName)}
        fill={fill}
        height={!fill ? height : undefined}
        onClick={onClick}
        onLoad={() => {
          setIsLoading(false);
          if (typeof onLoadFromProps === 'function') {
            onLoadFromProps();
          }
        }}
        priority={priority}
        quality={90}
        sizes={sizes}
        src={src}
        width={!fill ? width : undefined}
      />
    </>
  );
};

// "use client";

// import type { StaticImageData } from "next/image";
// import { cssVariables } from "@/cssVariables";
// import { cn } from "reveal";
// import NextImage from "next/image";
// import React from "react";

// import type { Props as MediaProps } from "../types.js";

// const { breakpoints } = cssVariables;

// export const ImageMedia: React.FC<MediaProps> = (props) => {
//   const {
//     alt: altFromProps,
//     fill,
//     imgClassName,
//     onClick,
//     onLoad: onLoadFromProps,
//     priority,
//     resource,
//     size: sizeFromProps,
//     src: srcFromProps,
//   } = props;

//   const [isLoading, setIsLoading] = React.useState(true);

//   let width: number | undefined;
//   let height: number | undefined;
//   let alt = altFromProps;
//   let src: StaticImageData | string = srcFromProps || "";

//   if (!src && resource && typeof resource === "object") {
//     const {
//       alt: altFromResource,
//       filename: fullFilename,
//       height: fullHeight,
//       url,
//       width: fullWidth,
//     } = resource;

//     width = fullWidth!;
//     height = fullHeight!;
//     alt = altFromResource;

//     src = `${process.env.NEXT_PUBLIC_SERVER_URL}${url}`;
//   }

//   // NOTE: this is used by the browser to determine which image to download at different screen sizes
//   const sizes = sizeFromProps
//     ? sizeFromProps
//     : Object.entries(breakpoints)
//         .map(([, value]) => `(max-width: ${value}px) ${value}px`)
//         .join(", ");

//   return (
//     <NextImage
//       alt={alt || ""}
//       className={cn(imgClassName)}
//       fill={fill}
//       height={!fill ? height : undefined}
//       onClick={onClick}
//       onLoad={() => {
//         setIsLoading(false);
//         if (typeof onLoadFromProps === "function") {
//           onLoadFromProps();
//         }
//       }}
//       priority={priority}
//       quality={90}
//       sizes={sizes}
//       src={src}
//       width={!fill ? width : undefined}
//     />
//   );
// };
