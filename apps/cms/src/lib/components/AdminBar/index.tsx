'use client';

import { useRouter, useSelectedLayoutSegments } from 'next/navigation';
import React, { useState } from 'react';

// Local type definitions for RevealUI CMS
export interface RevealUIAdminBarProps {
  className?: string;
  classNames?: {
    controls?: string;
    logo?: string;
    user?: string;
  };
  cmsURL?: string;
  collection?: string;
  collectionLabels?: {
    singular?: string;
    plural?: string;
  };
  logo?: React.ReactNode;
  onAuthChange?: (user: RevealUIMeUser) => void;
  onPreviewExit?: () => void;
  style?: React.CSSProperties;
  preview?: boolean;
}

export interface RevealUIMeUser {
  id?: string | number;
  email?: string;
  [key: string]: unknown;
}

// RevealUI Admin Bar component
const RevealUIAdminBar = (props: RevealUIAdminBarProps) => {
  const { className, logo, onAuthChange, onPreviewExit, style } = props;

  // Fetch user on mount
  React.useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/me', { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (onAuthChange && data?.user) {
          onAuthChange(data.user);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        // Auth check failed — user likely not logged in; hide admin bar
        if (onAuthChange) onAuthChange({});
      });
    return () => controller.abort();
  }, [onAuthChange]);

  return (
    <div className={className} style={style}>
      <div className="flex items-center justify-between">
        <div>{logo}</div>
        <div className="flex items-center gap-4">
          <button type="button" onClick={onPreviewExit} className="text-sm underline">
            Exit Preview
          </button>
        </div>
      </div>
    </div>
  );
};

const collectionLabels = {
  pages: {
    plural: 'Pages',
    singular: 'Page',
  },
  posts: {
    plural: 'Posts',
    singular: 'Post',
  },
  projects: {
    plural: 'Projects',
    singular: 'Project',
  },
};

const Title = () => <span>Dashboard</span>;

export const AdminBar = (props: { adminBarProps?: RevealUIAdminBarProps }) => {
  const { adminBarProps } = props || {};
  const segments = useSelectedLayoutSegments();
  const [show, setShow] = useState(false);
  const segmentKey = segments?.[1] as keyof typeof collectionLabels | undefined;
  const collection = segmentKey && collectionLabels[segmentKey] ? segmentKey : 'pages';

  const router = useRouter();

  const onAuthChange = (user: RevealUIMeUser) => {
    setShow(Boolean(user?.id));
  };

  function cn(
    baseClasses: string,
    conditionalClasses: { block: boolean; hidden: boolean },
  ): string {
    const classes = [baseClasses];

    Object.entries(conditionalClasses).forEach(([className, condition]) => {
      if (condition) {
        classes.push(className);
      }
    });

    return classes.filter(Boolean).join(' ');
  }

  return (
    <div
      className={cn('py-2 bg-black text-white', {
        block: show,
        hidden: !show,
      })}
    >
      <div className="container">
        <RevealUIAdminBar
          {...adminBarProps}
          className="py-2 text-white"
          classNames={{
            controls: 'font-medium text-white',
            logo: 'text-white',
            user: 'text-white',
          }}
          cmsURL={process.env.NEXT_PUBLIC_SERVER_URL}
          {...(collection && {
            collection,
            collectionLabels: {
              plural: collectionLabels[collection]?.plural || 'Pages',
              singular: collectionLabels[collection]?.singular || 'Page',
            },
          })}
          logo={<Title />}
          onAuthChange={onAuthChange}
          onPreviewExit={() => {
            fetch('/next/exit-preview').then(() => {
              router.push('/');
              router.refresh();
            });
          }}
          style={{
            backgroundColor: 'transparent',
            padding: 0,
            position: 'relative',
            zIndex: 'unset',
          }}
        />
      </div>
    </div>
  );
};
