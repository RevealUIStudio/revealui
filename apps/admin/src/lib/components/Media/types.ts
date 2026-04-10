import type { Media } from '@revealui/core/types/admin';
import type { StaticImageData } from 'next/image';
import type { ElementType, Ref } from 'react';

// types.ts
export interface MediaType {
  id: number;
  alt: string;
  caption?: {
    root: {
      type: string;
      children: {
        type: string;
        version: number;
        [k: string]: unknown;
      }[];
      direction: ('ltr' | 'rtl') | null;
      format: 'left' | 'start' | 'center' | 'right' | 'end' | 'justify' | '';
      indent: number;
      version: number;
    };
    [k: string]: unknown;
  } | null;
  updatedAt: string;
  createdAt: string;
  url?: string | null;
  thumbnailURL?: string | null;
  filename?: string | null;
  mimeType?: string | null;
  filesize?: number | null;
  width?: number | null;
  height?: number | null;
  focalX?: number | null;
  focalY?: number | null;
}

export interface Props {
  alt?: string;
  className?: string;
  fill?: boolean; // for NextImage only
  htmlElement?: ElementType | null;
  imgClassName?: string;
  onClick?: () => void;
  onLoad?: () => void;
  priority?: boolean; // for NextImage only
  ref?: Ref<HTMLImageElement | HTMLVideoElement | null>;
  resource?: Media | number; // This can accept MediaType, string, or numberring
  size?: string; // for NextImage only
  src?: StaticImageData; // for static media
  videoClassName?: string;
}

// import type { StaticImageData } from "next/image";
// import type { ElementType, Ref } from "react";

// export interface MediaType {
//   id: string;
//   alt: string;
//   caption?: {
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
//   } | null;
//   updatedAt: string;
//   createdAt: string;
//   url?: string | null;
//   thumbnailURL?: string | null;
//   filename?: string | null;
//   mimeType?: string | null;
//   filesize?: number | null;
//   width?: number | null;
//   height?: number | null;
//   focalX?: number | null;
//   focalY?: number | null;
// }

// export interface Props {
//   alt?: string;
//   className?: string;
//   fill?: boolean; // for NextImage only
//   htmlElement?: ElementType | null;
//   imgClassName?: string;
//   onClick?: () => void;
//   onLoad?: () => void;
//   priority?: boolean; // for NextImage only
//   ref?: Ref<HTMLImageElement | HTMLVideoElement | null>;
//   resource?: MediaType | string | number; // for RevealUI media
//   size?: string; // for NextImage only
//   src?: StaticImageData; // for static media
//   videoClassName?: string;
// }
