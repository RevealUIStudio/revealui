import { IconCheck, IconPrimitiveContent, IconSettings } from '@revealui/presentation';

// Local Metadata type to avoid dependency on Next.js
interface Metadata {
  title?: string;
  description?: string;
  [key: string]: unknown;
}

export interface RootPageProps {
  config: {
    collections?: unknown[];
    globals?: unknown[];
    [key: string]: unknown;
  };
  params: Promise<{ segments?: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] }>;
  importMap?: Record<string, unknown>;
}

export interface NotFoundPageProps {
  config: {
    collections?: unknown[];
    globals?: unknown[];
    [key: string]: unknown;
  };
  params: Promise<{ segments?: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] }>;
  importMap?: Record<string, unknown>;
}

export function RootPage({ config }: RootPageProps) {
  type AdminCollectionSummary = { slug?: string; fields?: unknown[] };
  const collections = (config.collections || []) as AdminCollectionSummary[];
  const globals = (config.globals || []) as AdminCollectionSummary[];
  // Server component: white-label kits override via REVEALUI_BRAND_NAME /
  // REVEALUI_TENANT_NAME. `||` not `??`: Compose `${VAR:-}` interpolation
  // delivers unset vars as empty strings.
  const siteName =
    process.env.REVEALUI_BRAND_NAME || process.env.REVEALUI_TENANT_NAME || 'RevealUI';

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-foreground">{`${siteName} Admin`}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span
                className="shrink-0 text-sm tabular-nums text-muted-foreground"
                title="Application version"
              >
                v{process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.APP_VERSION ?? '0.0.0'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Collections */}
            <div className="bg-card overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <IconPrimitiveContent
                      size="lg"
                      className="h-8 w-8 text-muted-foreground"
                      label="Collections"
                    />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-muted-foreground truncate">
                        Collections
                      </dt>
                      <dd className="text-lg font-medium text-foreground">{collections.length}</dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-muted px-5 py-3">
                <div className="text-sm">
                  {collections.length > 0 ? (
                    <ul className="space-y-1">
                      {collections.map((collection) => (
                        <li key={collection.slug} className="text-muted-foreground">
                          <span className="font-medium">{collection.slug}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({collection.fields?.length || 0} fields)
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">No collections configured</p>
                  )}
                </div>
              </div>
            </div>

            {/* Globals */}
            <div className="bg-card overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <IconSettings
                      size="lg"
                      className="h-8 w-8 text-muted-foreground"
                      label="Globals"
                    />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-muted-foreground truncate">
                        Globals
                      </dt>
                      <dd className="text-lg font-medium text-foreground">{globals.length}</dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-muted px-5 py-3">
                <div className="text-sm">
                  {globals.length > 0 ? (
                    <ul className="space-y-1">
                      {globals.map((global) => (
                        <li key={global.slug} className="text-muted-foreground">
                          <span className="font-medium">{global.slug}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({global.fields?.length || 0} fields)
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">No globals configured</p>
                  )}
                </div>
              </div>
            </div>

            {/* System Status */}
            <div className="bg-card overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 bg-success/15 rounded-full flex items-center justify-center">
                      <IconCheck
                        size="sm"
                        className="h-5 w-5 text-success"
                        label="System operational"
                      />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-muted-foreground truncate">
                        System Status
                      </dt>
                      <dd className="text-lg font-medium text-foreground">Operational</dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-muted px-5 py-3">
                <div className="text-sm text-muted-foreground">
                  {siteName} admin is running successfully with {collections.length} collections and{' '}
                  {globals.length} globals configured.
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div>
      <h1>404 - Page Not Found</h1>
      <p>The requested admin page could not be found.</p>
    </div>
  );
}

export function generatePageMetadata(): Metadata {
  // Server-side, resolved per call. White-label kits override via env.
  // `||` not `??`: Compose `${VAR:-}` delivers unset vars as empty strings.
  const siteName =
    process.env.REVEALUI_BRAND_NAME || process.env.REVEALUI_TENANT_NAME || 'RevealUI';
  return {
    title: `${siteName} Admin`,
    description: `${siteName} Content Management System`,
  };
}
