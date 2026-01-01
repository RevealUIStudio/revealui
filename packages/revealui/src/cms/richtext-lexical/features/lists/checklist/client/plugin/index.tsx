'use client'
import { CheckListPlugin } from '../../lexical/packages/react/LexicalCheckListPlugin.js'
import React from 'react'

import type { PluginComponent } from '../../../typesClient.js'

export const LexicalCheckListPlugin: PluginComponent<undefined> = () => {
  return <CheckListPlugin />
}
