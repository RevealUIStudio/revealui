// RevealUI Admin Layout - Local implementation
import type React from 'react'
import type { Config } from '../../core/types/index'

export interface RootLayoutProps {
  children: React.ReactNode
  config: Config
  importMap?: Record<string, unknown>
  serverFunction?: (name: string, args: unknown) => Promise<unknown>
}

export function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>RevealUI Admin</title>
      </head>
      <body className="antialiased">
        <div id="revealui-admin" className="min-h-screen">
          {children}
        </div>
      </body>
    </html>
  )
}
