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
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">v0.1.0</span>
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
                    <svg
                      className="h-8 w-8 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <title>Collections icon</title>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
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
                    <svg
                      className="h-8 w-8 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <title>Globals icon</title>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
                      />
                    </svg>
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
                      <svg
                        className="h-5 w-5 text-success"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <title>System operational</title>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
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
