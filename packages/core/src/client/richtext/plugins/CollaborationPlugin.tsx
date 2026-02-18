'use client'

import { CollaborationPlugin as LexicalCollaborationPlugin } from '@lexical/react/LexicalCollaborationPlugin'
import type { Provider } from '@lexical/yjs'
import type { Doc } from 'yjs'

export interface CollaborationPluginProps {
  id: string
  providerFactory: (id: string, yjsDocMap: Map<string, Doc>) => Provider
  shouldBootstrap: boolean
  username?: string
  cursorColor?: string
}

export function CollaborationPlugin({
  id,
  providerFactory,
  shouldBootstrap,
  username,
  cursorColor,
}: CollaborationPluginProps) {
  return (
    <LexicalCollaborationPlugin
      id={id}
      providerFactory={providerFactory}
      shouldBootstrap={shouldBootstrap}
      username={username}
      cursorColor={cursorColor}
    />
  )
}
