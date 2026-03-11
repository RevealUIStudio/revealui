'use client';

import type React from 'react';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/styles/classnames';

import type { Props as MediaProps } from '../types';

export const VideoMedia: React.FC<MediaProps> = (props) => {
  const { onClick, resource, videoClassName } = props;

  const videoRef = useRef<HTMLVideoElement>(null);
  // const [showFallback] = useState<boolean>()

  useEffect(() => {
    const { current: video } = videoRef;
    if (video) {
      video.addEventListener('suspend', () => {
        // TODO: implement suspend fallback (setShowFallback + user notification)
      });
    }
  }, []);

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
