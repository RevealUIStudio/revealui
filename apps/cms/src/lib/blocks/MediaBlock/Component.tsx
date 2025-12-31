import type { StaticImageData } from "next/image";

import React from "react";
import { cn } from "reveal/ui/layouts/classNames.js";

import { Page } from "@/types";
import { Media } from "../../components/Media";
import RichText from "../../components/RichText";

type Props = Extract<Page["layout"][0], { blockType: "mediaBlock" }> & {
  breakout?: boolean;
  captionClassName?: string;
  className?: string;
  enableGutter?: boolean;
  id?: string;
  imgClassName?: string;
  staticImage?: StaticImageData;
  disableInnerContainer?: boolean;
};

export const MediaBlock: React.FC<Props> = (props) => {
  const {
    captionClassName,
    className,
    enableGutter = true,
    imgClassName,
    media,
    position = "default",
    staticImage,
    disableInnerContainer,
  } = props;

  let caption;
  if (media && typeof media === "object") caption = media.caption;

  return (
    <div
      className={cn(
        "",
        {
          container: position === "default" && enableGutter,
        },
        className,
      )}
    >
      {position === "fullscreen" && (
        <div className="relative">
          <Media resource={media} src={staticImage} />
        </div>
      )}
      {position === "default" && (
        <Media
          imgClassName={cn("rounded", imgClassName)}
          resource={media}
          src={staticImage}
        />
      )}
      {caption && (
        <div
          className={cn(
            "mt-6",
            {
              container: position === "fullscreen" && !disableInnerContainer,
            },
            captionClassName,
          )}
        >
          <RichText content={caption} enableGutter={false} />
        </div>
      )}
    </div>
  );
};
