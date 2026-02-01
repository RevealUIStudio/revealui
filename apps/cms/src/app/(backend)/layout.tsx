import config from '@/../../revealui.config'
import { RootLayout } from '@revealui/core/admin'
/* RevealUI Admin Layout - Local implementation */
import type React from 'react'

// TODO: Implement local CSS
// import "revealui/cms/admin/css";
import { importMap } from './admin/importMap'
import './custom.css'

type Args = {
  children: React.ReactNode
}

// Create a server function wrapper for RevealUI CMS
// This is required by RootLayout in RevealUI CMS v3
const serverFunction: (name: string, args: unknown) => Promise<unknown> = async (_name, _args) => {
  'use server'
  // This will be handled by RevealUI CMS internally
  return undefined
}

const Layout = ({ children }: Args) => (
  <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
    {children}
  </RootLayout>
)

export default Layout
