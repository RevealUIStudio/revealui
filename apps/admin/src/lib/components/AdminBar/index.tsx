'use client';

import { Button, cn } from '@revealui/presentation';

import { usePathname, useRouter, useSelectedLayoutSegments } from 'next/navigation';
import React, { useState } from 'react';
import { isAuthPath } from '@/lib/auth/auth-paths';

// Local type definitions for RevealUI admin
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
  role?: string;
  [key: string]: unknown;
}

// RevealUI Admin Bar component
const RevealUIAdminBar = (props: RevealUIAdminBarProps) => {
  const { className, logo, onAuthChange, onPreviewExit, preview, style } = props;

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
        // Auth check failed  -  user likely not logged in; hide admin bar
        if (onAuthChange) onAuthChange({});
      });
    return () => controller.abort();
  }, [onAuthChange]);

  return (
    <div className={className} style={style}>
      <div className="flex items-center justify-between">
        <div>{logo}</div>
        <div className="flex items-center gap-4">
          {preview ? (
            <Button
              type="button"
              appearance="link"
              variant="neutral"
              size="sm"
              onClick={onPreviewExit}
              className="h-auto p-0 text-sm text-inherit underline"
            >
              Exit Preview
            </Button>
          ) : null}
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

// Auth-flow pages live in the (frontend) route group alongside content pages, and the
// AdminBar is mounted in that group's layout. The bar is only meaningful to an admin
// editing content (draft preview) — never on login/signup/setup screens, and never for
// non-admin paying customers browsing /welcome or /account/billing.

export const AdminBar = (props: { adminBarProps?: RevealUIAdminBarProps }) => {
  const { adminBarProps } = props || {};
  const segments = useSelectedLayoutSegments();
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const segmentKey = segments?.[1] as keyof typeof collectionLabels | undefined;
  const collection = segmentKey && collectionLabels[segmentKey] ? segmentKey : 'pages';

  const router = useRouter();

  // Only admins see the AdminBar. Self-serve subscribers (role 'user') have no use
  // for the draft-preview controls and previously saw a stray "Dashboard" label on
  // billing/welcome — the bar is admin-only chrome now.
  const onAuthChange = React.useCallback((user: RevealUIMeUser) => {
    setShow(user?.role === 'admin');
  }, []);

  // All hooks above run unconditionally (Rules of Hooks). On auth-flow pages the bar must
  // never render — bail out before mounting RevealUIAdminBar so its /api/auth/me probe is
  // skipped too.
  if (isAuthPath(pathname)) {
    return null;
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
