'use client';

import { CollaborationPlugin as LexicalCollaborationPlugin } from '@lexical/react/LexicalCollaborationPlugin';
import type { Provider } from '@lexical/yjs';
import { useRef } from 'react';
import type { Doc } from 'yjs';

export interface CollaborationPluginProps {
  id: string;
  providerFactory: (id: string, yjsDocMap: Map<string, Doc>) => Provider;
  shouldBootstrap: boolean;
  username?: string;
  cursorColor?: string;
  clientType?: 'human' | 'agent';
  agentModel?: string;
}

export function CollaborationPlugin({
  id,
  providerFactory,
  shouldBootstrap,
  username,
  cursorColor,
  clientType = 'human',
  agentModel,
}: CollaborationPluginProps) {
  const cursorsContainerRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <LexicalCollaborationPlugin
        id={id}
        providerFactory={providerFactory}
        shouldBootstrap={shouldBootstrap}
        username={username}
        cursorColor={cursorColor}
        cursorsContainerRef={cursorsContainerRef}
        awarenessData={{ type: clientType, agentModel }}
      />
      <div ref={cursorsContainerRef} className="collab-cursors-container" />
    </>
  );
}
