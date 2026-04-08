'use client';

import { useRef } from 'react';
import { cn } from '@/lib/styles/classnames';

import type { Props as MediaProps } from '../types';

export const VideoMedia = (props: MediaProps) => {
  const { onClick, resource, videoClassName } = props;

  const videoRef = useRef<HTMLVideoElement>(null);

  if (resource && typeof resource === 'object') {
    const { filename } = resource;

    return (
      <video
        autoPlay
        className={cn(videoClassName)}
        controls={false}
        loop
        muted
        onClick={onClick}
        playsInline
        ref={videoRef}
      >
        <source src={`${import.meta.env.NEXT_PUBLIC_SERVER_URL}/media/${filename}`} />
      </video>
    );
  }

  return null;
};
