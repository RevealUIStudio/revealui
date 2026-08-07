'use client';

import { logger } from '@revealui/core/utils/logger';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useReducer, useState } from 'react';
import type {
  RevealCollectionConfig,
  RevealConfig,
  RevealDocument,
  RevealGlobalConfig,
} from '../../../types/index.js';
import { APIError, APIErrorType, apiClient, postSignOut } from '../utils/index.js';
import { CollectionList } from './CollectionList.js';
import { DocumentForm } from './DocumentForm.js';
import { GlobalForm } from './GlobalForm.js';

// =============================================================================
// Types
// =============================================================================

interface AdminDashboardProps {
  config: RevealConfig;
  /**
   * Resolved brand name for the dashboard chrome. Pass from a server
   * component (e.g. REVEALUI_BRAND_NAME / REVEALUI_TENANT_NAME): client
   * files cannot read those env vars at runtime (build-time inlining).
   */
  siteName?: string;
}

type ViewType = 'dashboard' | 'collection' | 'edit' | 'global';

interface CurrentView {
  type: ViewType;
  collection?: RevealCollectionConfig;
  document?: RevealDocument;
  global?: RevealGlobalConfig;
}

// =============================================================================
// Reducer
// =============================================================================

interface DashboardState {
  view: CurrentView;
  documents: RevealDocument[];
  totalDocs: number;
  page: number;
  totalPages: number;
  collectionLoading: boolean;
  globalDocument: RevealDocument | null;
  globalLoading: boolean;
  saving: boolean;
  deleting: string | null;
  error: string | null;
  successMessage: string | null;
}

type DashboardAction =
  | { type: 'NAVIGATE'; view: CurrentView }
  | {
      type: 'COLLECTION_LOADED';
      documents: RevealDocument[];
      totalDocs: number;
      page: number;
      totalPages: number;
    }
  | { type: 'COLLECTION_LOADING' }
  | { type: 'GLOBAL_LOADED'; document: RevealDocument }
  | { type: 'GLOBAL_LOADING' }
  | { type: 'SET_SAVING'; saving: boolean }
  | { type: 'SET_DELETING'; id: string | null }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_SUCCESS'; message: string | null };

const initialState: DashboardState = {
  view: { type: 'dashboard' },
  documents: [],
  totalDocs: 0,
  page: 1,
  totalPages: 1,
  collectionLoading: false,
  globalDocument: null,
  globalLoading: false,
  saving: false,
  deleting: null,
  error: null,
  successMessage: null,
};

function reducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'NAVIGATE':
      return { ...state, view: action.view, error: null, successMessage: null };
    case 'COLLECTION_LOADING':
      return { ...state, collectionLoading: true };
    case 'COLLECTION_LOADED':
      return {
        ...state,
        documents: action.documents,
        totalDocs: action.totalDocs,
        page: action.page,
        totalPages: action.totalPages,
        collectionLoading: false,
      };
    case 'GLOBAL_LOADING':
      return { ...state, globalDocument: null, globalLoading: true };
    case 'GLOBAL_LOADED':
      return { ...state, globalDocument: action.document, globalLoading: false };
    case 'SET_SAVING':
      return { ...state, saving: action.saving };
    case 'SET_DELETING':
      return { ...state, deleting: action.id };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'SET_SUCCESS':
      return { ...state, successMessage: action.message };
  }
}

// =============================================================================
// Shared sub-components
// =============================================================================

function AdminHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="bg-card shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={onBack}
              className="text-muted-foreground hover:text-muted-foreground"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-2xl font-bold text-foreground capitalize">{title}</h1>
          </div>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}

function StatusBanners({
  error,
  successMessage,
}: {
  error: string | null;
  successMessage: string | null;
}) {
  return (
    <>
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}
      {successMessage && (
        <div className="mb-4 bg-success/10 border border-success/30 text-success px-4 py-3 rounded">
          <p className="font-medium">Success</p>
          <p className="text-sm">{successMessage}</p>
        </div>
      )}
    </>
  );
}

function LoadingSpinner() {
  return (
    <div className="mb-4 text-center py-8">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
    </div>
  );
}

function SignOutButton() {
  const [loading, setLoading] = useState(false);

  const handleSignOut = useCallback(async () => {
    setLoading(true);
    try {
      await postSignOut();
    } catch {
      // Sign out even if the API call fails  -  clear client state regardless
    }
    window.location.href = '/login';
  }, []);

  return (
    <button
      type="button"
      onClick={() => void handleSignOut()}
      disabled={loading}
      className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md hover:bg-muted transition-colors"
    >
      {loading ? 'Signing out...' : 'Sign Out'}
    </button>
  );
}

// =============================================================================
// Dashboard home view
// =============================================================================

/**
 * The dashboard's collection taxonomy. Fixed render order: day-to-day work
 * first, catalog/content structure second, identity and access last.
 */
type CollectionTaxonomyGroup = 'Operate' | 'Build' | 'Configure';

const TAXONOMY_GROUPS: readonly CollectionTaxonomyGroup[] = ['Operate', 'Build', 'Configure'];

function isTaxonomyGroup(value: unknown): value is CollectionTaxonomyGroup {
  return value === 'Operate' || value === 'Build' || value === 'Configure';
}

/**
 * Buckets a collection into Operate / Build / Configure. A collection's own
 * `admin.group` wins when it already names one of the three groups (a
 * project can opt in explicitly). Otherwise the bucket falls out of
 * structural traits every RevealCollectionConfig already carries: auth
 * collections gate who can act (Configure), versioned collections are the
 * ones worked day to day with drafts and publishing (Operate), and
 * everything else is catalog or content structure (Build).
 */
function classifyCollectionGroup(collection: RevealCollectionConfig): CollectionTaxonomyGroup {
  if (isTaxonomyGroup(collection.admin?.group)) {
    return collection.admin.group;
  }
  if (collection.auth) return 'Configure';
  if (collection.versions) return 'Operate';
  return 'Build';
}

function groupCollectionsByTaxonomy(
  collections: RevealCollectionConfig[],
): Record<CollectionTaxonomyGroup, RevealCollectionConfig[]> {
  const grouped: Record<CollectionTaxonomyGroup, RevealCollectionConfig[]> = {
    Operate: [],
    Build: [],
    Configure: [],
  };
  for (const collection of collections) {
    grouped[classifyCollectionGroup(collection)].push(collection);
  }
  return grouped;
}

/**
 * Per-collection link overrides. A slug listed here has a dedicated page
 * that supersedes the generic collection editor, so the dashboard links
 * straight to it instead of opening the generic editor.
 *
 * GAP-452: the generic editor's create path posts JSON to a multipart-only
 * endpoint and 400s for upload collections, so `media` must route to the
 * media library instead.
 */
const COLLECTION_LINK_OVERRIDES: Readonly<Record<string, string>> = {
  media: '/media',
};

// Static icons: hoisted so the same element is reused across renders instead
// of re-created (they take no props and never change).
const collectionsIcon = (
  <svg
    className="h-5 w-5 text-muted-foreground"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
    />
  </svg>
);

const globalsIcon = (
  <svg
    className="h-5 w-5 text-muted-foreground"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
    />
  </svg>
);

/**
 * Small local equivalents of `@revealui/presentation`'s `Badge` / `Stat` /
 * `StatusDot`, built from the same `--rvui-*` token bridge classes (`bg-muted`,
 * `bg-success`, `bg-warning`, ...) this file already uses elsewhere.
 *
 * `@revealui/core` is imported by the Hono API server (`apps/server`), which
 * never renders React. `@revealui/presentation` is a browser UI package built
 * with Vite, a devDependency the server Docker image's install layer does not
 * carry. Depending on it here pulled a client-only build tool into a headless
 * server's dependency closure and broke the `migrate`/`server` Docker builds
 * (turbo builds the whole workspace closure, `vite: ENOENT`). Reproducing the
 * handful of classes these components render keeps the same visual result
 * without adding that edge. See PR discussion for the audited alternative
 * (moving the view into `apps/admin`, which already depends on presentation)
 * — rejected because it duplicates the grouping/status logic across packages
 * for no benefit over inlining a few CSS classes.
 */
function CountBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {count}
    </span>
  );
}

function StatTile({ label, value, icon }: { label: string; value: ReactNode; icon: ReactNode }) {
  return (
    <div className="rounded-lg bg-card p-5 shadow">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="rounded-md bg-muted p-1.5">{icon}</div>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  );
}

function StatusIndicator({
  degraded,
  label,
  pulse = false,
}: {
  degraded: boolean;
  label: string;
  pulse?: boolean;
}) {
  const fill = degraded ? 'bg-warning' : 'bg-success';
  return (
    <span role="img" aria-label={label} className="relative inline-flex size-2.5 shrink-0">
      {pulse && (
        <span
          aria-hidden="true"
          className={`absolute inline-flex size-full motion-safe:animate-ping rounded-full opacity-75 ${fill}`}
        />
      )}
      <span aria-hidden="true" className={`relative inline-flex size-2.5 rounded-full ${fill}`} />
    </span>
  );
}

function CollectionGroupCard({
  group,
  collections,
  onCollectionClick,
}: {
  group: CollectionTaxonomyGroup;
  collections: RevealCollectionConfig[];
  onCollectionClick: (c: RevealCollectionConfig) => void;
}) {
  if (collections.length === 0) return null;
  const headingId = `dashboard-group-${group.toLowerCase()}`;

  return (
    <section aria-labelledby={headingId} className="overflow-hidden rounded-lg bg-card shadow">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <h3 id={headingId} className="text-sm font-semibold text-foreground">
          {group}
        </h3>
        <CountBadge count={collections.length} />
      </div>
      <ul className="divide-y divide-border">
        {collections.map((collection) => {
          const slug = String(collection.slug);
          const overrideHref = COLLECTION_LINK_OVERRIDES[slug];
          const rowClassName =
            'flex w-full items-center px-5 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer';

          return (
            <li key={slug}>
              {overrideHref ? (
                <a href={overrideHref} className={rowClassName}>
                  {slug}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => onCollectionClick(collection)}
                  className={rowClassName}
                >
                  {slug}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function GlobalsCard({
  globals,
  onGlobalClick,
}: {
  globals: RevealGlobalConfig[];
  onGlobalClick: (g: RevealGlobalConfig) => void;
}) {
  return (
    <section
      aria-labelledby="dashboard-globals"
      className="overflow-hidden rounded-lg bg-card shadow"
    >
      <div className="flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-2">
          {globalsIcon}
          <h3 id="dashboard-globals" className="text-sm font-semibold text-foreground">
            Globals
          </h3>
        </div>
        <CountBadge count={globals.length} />
      </div>
      {globals.length > 0 ? (
        <ul className="divide-y divide-border">
          {globals.map((global) => (
            <li key={String(global.slug)}>
              <button
                type="button"
                onClick={() => onGlobalClick(global)}
                className="flex w-full items-center px-5 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
              >
                {global.label || String(global.slug)}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-sm text-muted-foreground">No globals configured</p>
      )}
    </section>
  );
}

/** System status card: a status-dot-led card, never a bare prose sentence. */
function SystemStatusCard({ degraded }: { degraded: boolean }) {
  const word = degraded ? 'Degraded' : 'Healthy';
  const description = degraded
    ? 'The last admin action failed. Retry it or check the server logs.'
    : 'The admin console is responding normally.';

  return (
    <section
      aria-labelledby="dashboard-system-status"
      className="overflow-hidden rounded-lg bg-card shadow"
    >
      <div className="flex items-center justify-between border-b px-5 py-3">
        <h3 id="dashboard-system-status" className="text-sm font-semibold text-foreground">
          System status
        </h3>
        <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
          <StatusIndicator degraded={degraded} label={`System status: ${word}`} pulse={!degraded} />
          {word}
        </span>
      </div>
      <p className="px-5 py-4 text-sm text-muted-foreground">{description}</p>
    </section>
  );
}

function DashboardHome({
  siteName,
  collections,
  globals,
  degraded,
  onCollectionClick,
  onGlobalClick,
}: {
  siteName: string;
  collections: RevealCollectionConfig[];
  globals: RevealGlobalConfig[];
  degraded: boolean;
  onCollectionClick: (c: RevealCollectionConfig) => void;
  onGlobalClick: (g: RevealGlobalConfig) => void;
}) {
  const grouped = groupCollectionsByTaxonomy(collections);

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
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Overview</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Collections, globals, and system status for {siteName}.
          </p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile label="Collections" value={collections.length} icon={collectionsIcon} />
          <StatTile label="Globals" value={globals.length} icon={globalsIcon} />
          <StatTile
            label="Status"
            value={degraded ? 'Degraded' : 'Healthy'}
            icon={<StatusIndicator degraded={degraded} label={degraded ? 'Degraded' : 'Healthy'} />}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 flex flex-col gap-6">
            {collections.length > 0 ? (
              TAXONOMY_GROUPS.map((group) => (
                <CollectionGroupCard
                  key={group}
                  group={group}
                  collections={grouped[group]}
                  onCollectionClick={onCollectionClick}
                />
              ))
            ) : (
              <div className="rounded-lg bg-card p-5 shadow">
                <p className="text-sm text-muted-foreground">No collections configured</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <GlobalsCard globals={globals} onGlobalClick={onGlobalClick} />
            <SystemStatusCard degraded={degraded} />
          </div>
        </div>
      </main>
    </div>
  );
}

// =============================================================================
// Error handling helpers
// =============================================================================

function extractErrorMessage(err: unknown, fallback: string): string {
  return err instanceof APIError ? err.message : fallback;
}

function logApiError(err: unknown, context: string): void {
  logger.error(context, { error: err });
  if (err instanceof APIError && err.type === APIErrorType.Authentication) {
    logger.warn('Authentication required');
  }
}

// =============================================================================
// Main component
// =============================================================================

export function AdminDashboard({ config, siteName = 'RevealUI' }: AdminDashboardProps) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const collections = config.collections || [];
  const globals = config.globals || [];

  // Auto-dismiss success messages
  useEffect(() => {
    if (state.successMessage) {
      const timer = setTimeout(() => dispatch({ type: 'SET_SUCCESS', message: null }), 3000);
      return () => clearTimeout(timer);
    }
    return;
  }, [state.successMessage]);

  // Auto-dismiss error messages
  useEffect(() => {
    if (state.error) {
      const timer = setTimeout(() => dispatch({ type: 'SET_ERROR', error: null }), 5000);
      return () => clearTimeout(timer);
    }
    return;
  }, [state.error]);

  const goToDashboard = () => dispatch({ type: 'NAVIGATE', view: { type: 'dashboard' } });

  const fetchCollection = async (collection: RevealCollectionConfig, page = 1) => {
    try {
      dispatch({ type: 'COLLECTION_LOADING' });
      const response = await apiClient.find({
        collection: String(collection.slug),
        page,
        limit: 10,
      });
      dispatch({
        type: 'COLLECTION_LOADED',
        documents: response.docs || [],
        totalDocs: response.totalDocs || 0,
        page: response.page || 1,
        totalPages: response.totalPages || 1,
      });
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Failed to fetch collection data. Please try again.');
      logApiError(err, 'Failed to fetch collection data');
      dispatch({
        type: 'COLLECTION_LOADED',
        documents: state.documents,
        totalDocs: state.totalDocs,
        page: state.page,
        totalPages: state.totalPages,
      });
      dispatch({ type: 'SET_ERROR', error: msg });
    }
  };

  const handleCollectionClick = async (collection: RevealCollectionConfig) => {
    dispatch({ type: 'NAVIGATE', view: { type: 'collection', collection } });
    await fetchCollection(collection);
  };

  const handleGlobalClick = async (global: RevealGlobalConfig) => {
    dispatch({ type: 'NAVIGATE', view: { type: 'global', global } });
    try {
      dispatch({ type: 'GLOBAL_LOADING' });
      const document = await apiClient.findGlobal({
        slug: String(global.slug),
        depth: 0,
      });
      dispatch({ type: 'GLOBAL_LOADED', document });
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Failed to fetch global data. Please try again.');
      logApiError(err, 'Failed to fetch global data');
      dispatch({ type: 'SET_ERROR', error: msg });
    }
  };

  const handleCreate = (): void => {
    if (state.view.collection) {
      dispatch({
        type: 'NAVIGATE',
        view: { type: 'edit', collection: state.view.collection },
      });
    }
  };

  const handleEdit = (document: RevealDocument): void => {
    if (state.view.collection) {
      dispatch({
        type: 'NAVIGATE',
        view: { type: 'edit', collection: state.view.collection, document },
      });
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    if (!state.view.collection) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete ${ids.length} ${String(state.view.collection.slug)}? This action cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      dispatch({ type: 'SET_ERROR', error: null });
      await apiClient.batchDelete({
        collection: String(state.view.collection.slug),
        ids,
      });
      if (state.view.collection) {
        await fetchCollection(state.view.collection, state.page);
      }
      dispatch({ type: 'SET_SUCCESS', message: `${ids.length} documents deleted` });
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Bulk delete failed. Please try again.');
      logApiError(err, 'Bulk delete failed');
      dispatch({ type: 'SET_ERROR', error: msg });
    }
  };

  const handleBulkPublish = async (ids: string[]) => {
    if (!state.view.collection) return;
    try {
      dispatch({ type: 'SET_ERROR', error: null });
      await apiClient.batchUpdate({
        collection: String(state.view.collection.slug),
        items: ids.map((id) => ({ id, status: 'published' })),
      });
      if (state.view.collection) {
        await fetchCollection(state.view.collection, state.page);
      }
      dispatch({ type: 'SET_SUCCESS', message: `${ids.length} documents published` });
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Bulk publish failed. Please try again.');
      logApiError(err, 'Bulk publish failed');
      dispatch({ type: 'SET_ERROR', error: msg });
    }
  };

  const handleDelete = async (document: RevealDocument) => {
    if (!(state.view.collection && document.id)) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete this ${String(state.view.collection.slug)}? This action cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      dispatch({ type: 'SET_DELETING', id: String(document.id) });
      dispatch({ type: 'SET_ERROR', error: null });

      await apiClient.delete({
        collection: String(state.view.collection.slug),
        id: String(document.id),
      });

      if (state.view.collection) {
        await fetchCollection(state.view.collection);
      }
      dispatch({ type: 'SET_SUCCESS', message: 'Document deleted successfully' });
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Failed to delete document. Please try again.');
      logApiError(err, 'Failed to delete document');
      dispatch({ type: 'SET_ERROR', error: msg });
    } finally {
      dispatch({ type: 'SET_DELETING', id: null });
    }
  };

  const handleSave = async (data: Record<string, unknown>) => {
    if (!state.view.collection) return;

    try {
      dispatch({ type: 'SET_SAVING', saving: true });
      dispatch({ type: 'SET_ERROR', error: null });

      if (state.view.document?.id) {
        await apiClient.update({
          collection: String(state.view.collection.slug),
          id: String(state.view.document.id),
          data,
        });
        dispatch({ type: 'SET_SUCCESS', message: 'Document updated successfully' });
      } else {
        // Auto-generate slug from title if needed
        const hasSlugField = state.view.collection.fields.some(
          (f) => 'name' in f && f.name === 'slug',
        );
        const submitData =
          hasSlugField && !data.slug && typeof data.title === 'string'
            ? {
                ...data,
                slug: data.title
                  .replace(/ /g, '-')
                  .replace(/[^\w-]+/g, '')
                  .toLowerCase(),
              }
            : data;

        await apiClient.create({
          collection: String(state.view.collection.slug),
          data: submitData,
        });
        dispatch({ type: 'SET_SUCCESS', message: 'Document created successfully' });
      }

      await fetchCollection(state.view.collection);
      dispatch({
        type: 'NAVIGATE',
        view: { type: 'collection', collection: state.view.collection },
      });
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Failed to save document. Please try again.');
      logApiError(err, 'Failed to save document');
      dispatch({ type: 'SET_ERROR', error: msg });

      if (err instanceof APIError && err.type === APIErrorType.Validation) {
        logger.warn('Validation error', { field: err.field, message: err.message });
      }
    } finally {
      dispatch({ type: 'SET_SAVING', saving: false });
    }
  };

  const handleSaveGlobal = async (data: Record<string, unknown>) => {
    if (!state.view.global) return;

    try {
      dispatch({ type: 'SET_SAVING', saving: true });
      dispatch({ type: 'SET_ERROR', error: null });

      await apiClient.updateGlobal({
        slug: String(state.view.global.slug),
        data,
      });
      dispatch({ type: 'SET_SUCCESS', message: 'Global updated successfully' });
      goToDashboard();
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Failed to save global. Please try again.');
      logApiError(err, 'Failed to save global');
      dispatch({ type: 'SET_ERROR', error: msg });

      if (err instanceof APIError && err.type === APIErrorType.Validation) {
        logger.warn('Validation error', { field: err.field, message: err.message });
      }
    } finally {
      dispatch({ type: 'SET_SAVING', saving: false });
    }
  };

  // ── Collection list view ──────────────────────────────────────────────
  if (state.view.type === 'collection' && state.view.collection) {
    return (
      <div className="min-h-screen bg-background">
        <AdminHeader title={String(state.view.collection.slug)} onBack={goToDashboard} />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <StatusBanners error={state.error} successMessage={state.successMessage} />
          {state.collectionLoading && <LoadingSpinner />}
          <CollectionList
            collection={state.view.collection}
            documents={state.documents}
            totalDocs={state.totalDocs}
            page={state.page}
            totalPages={state.totalPages}
            onCreate={handleCreate}
            onEdit={handleEdit}
            onDelete={(document) => void handleDelete(document)}
            onPageChange={(nextPage) => {
              const collection = state.view.collection;
              if (collection) void fetchCollection(collection, nextPage);
            }}
            deleting={state.deleting}
            onBulkDelete={(ids) => void handleBulkDelete(ids)}
            onBulkPublish={(ids) => void handleBulkPublish(ids)}
          />
        </main>
      </div>
    );
  }

  // ── Document edit/create view ─────────────────────────────────────────
  if (state.view.type === 'edit' && state.view.collection) {
    return (
      <div className="min-h-screen bg-background">
        <AdminHeader
          title={`${state.view.document ? 'Edit' : 'Create'} ${String(state.view.collection.slug).slice(0, -1)}`}
          onBack={goToDashboard}
        />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <StatusBanners error={state.error} successMessage={state.successMessage} />
            <DocumentForm
              collection={state.view.collection}
              document={state.view.document}
              onSave={(data) => void handleSave(data)}
              onCancel={goToDashboard}
              isLoading={state.saving}
            />
          </div>
        </main>
      </div>
    );
  }

  // ── Global edit view ──────────────────────────────────────────────────
  if (state.view.type === 'global' && state.view.global) {
    return (
      <div className="min-h-screen bg-background">
        <AdminHeader
          title={state.view.global.label || String(state.view.global.slug)}
          onBack={goToDashboard}
        />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <StatusBanners error={state.error} successMessage={state.successMessage} />
            {state.globalLoading && <LoadingSpinner />}
            {!state.globalLoading && state.globalDocument && (
              <GlobalForm
                global={state.view.global}
                document={state.globalDocument}
                onSave={(data) => void handleSaveGlobal(data)}
                onCancel={goToDashboard}
                isLoading={state.saving}
              />
            )}
          </div>
        </main>
      </div>
    );
  }

  // ── Dashboard home ────────────────────────────────────────────────────
  return (
    <DashboardHome
      siteName={siteName}
      collections={collections}
      globals={globals}
      degraded={Boolean(state.error)}
      onCollectionClick={(c) => void handleCollectionClick(c)}
      onGlobalClick={(g) => void handleGlobalClick(g)}
    />
  );
}
