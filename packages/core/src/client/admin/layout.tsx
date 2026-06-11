// RevealUI Admin Layout - Local implementation
import type React from 'react';
import type { Config } from '../../types/index.js';
import { ServerFunctionProvider } from './context/ServerFunctionContext.js';

export interface RootLayoutProps {
  children: React.ReactNode;
  config: Config;
  importMap?: Record<string, unknown>;
  serverFunction?: (name: string, args: unknown) => Promise<unknown>;
}

export function RootLayout({ children, serverFunction }: RootLayoutProps) {
  // Server component: resolved per request. White-label kits override via
  // REVEALUI_BRAND_NAME / REVEALUI_TENANT_NAME. `||` not `??`: Compose
  // `${VAR:-}` interpolation delivers unset vars as empty strings.
  const siteName =
    process.env.REVEALUI_BRAND_NAME || process.env.REVEALUI_TENANT_NAME || 'RevealUI';
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`${siteName} Admin`}</title>
      </head>
      <body className="antialiased">
        <ServerFunctionProvider serverFunction={serverFunction}>
          <main id="revealui-admin" className="min-h-screen">
            {children}
          </main>
        </ServerFunctionProvider>
      </body>
    </html>
  );
}
