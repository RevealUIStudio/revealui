'use client';

import { logger } from '@revealui/core/utils/logger';
import { useCallback, useEffect, useReducer, useState } from 'react';
import type {
  RevealCollectionConfig,
  RevealConfig,
  RevealDocument,
  RevealGlobalConfig,
} from '../../../types/index.js';
import { APIError, APIErrorType, apiClient } from '../utils/index.js';
import { CollectionList } from './CollectionList.js';
import { DocumentForm } from './DocumentForm.js';
import { GlobalForm } from './GlobalForm.js';

// =============================================================================
// Types
// =============================================================================

interface AdminDashboardProps {
  config: RevealConfig;
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
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-4">
            <button type="button" onClick={onBack} className="text-gray-400 hover:text-gray-600">
              ← Back to Dashboard
            </button>
            <h1 className="text-2xl font-bold text-gray-900 capitalize">{title}</h1>
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
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
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
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      <p className="mt-2 text-sm text-gray-600">Loading...</p>
    </div>
  );
}

function SignOutButton() {
  const [loading, setLoading] = useState(false);

  const handleSignOut = useCallback(async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Sign out even if the API call fails — clear client state regardless
    }
    window.location.href = '/login';
  }, []);

  return (
    <button
      type="button"
      onClick={() => void handleSignOut()}
      disabled={loading}
      className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
    >
      {loading ? 'Signing out...' : 'Sign Out'}
    </button>
  );
}

// =============================================================================
// Dashboard home view
// =============================================================================

function DashboardHome({
  collections,
  globals,
  onCollectionClick,
  onGlobalClick,
}: {
  collections: RevealCollectionConfig[];
  globals: RevealGlobalConfig[];
  onCollectionClick: (c: RevealCollectionConfig) => void;
  onGlobalClick: (g: RevealGlobalConfig) => void;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">RevealUI Admin</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">v0.1.0</span>
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Collections */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-8 w-8 text-gray-400"
                      aria-label="Collections"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      role="img"
                    >
                      <title>Collections</title>
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
                      <dt className="text-sm font-medium text-gray-500 truncate">Collections</dt>
                      <dd className="text-lg font-medium text-gray-900">{collections.length}</dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3">
                <div className="text-sm">
                  {collections.length > 0 ? (
                    <ul className="space-y-1 max-h-48 overflow-y-auto">
                      {collections.map((collection) => (
                        <li
                          key={String(collection.slug)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          <button
                            type="button"
                            onClick={() => onCollectionClick(collection)}
                            className="hover:underline cursor-pointer"
                          >
                            {String(collection.slug)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500">No collections configured</p>
                  )}
                </div>
              </div>
            </div>

            {/* Globals */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-8 w-8 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-labelledby="globals-icon-title"
                      role="img"
                    >
                      <title id="globals-icon-title">Globals</title>
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
                      <dt className="text-sm font-medium text-gray-500 truncate">Globals</dt>
                      <dd className="text-lg font-medium text-gray-900">{globals.length}</dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3">
                <div className="text-sm">
                  {globals.length > 0 ? (
                    <ul className="space-y-1 max-h-32 overflow-y-auto">
                      {globals.map((global) => (
                        <li key={String(global.slug)} className="text-gray-600 hover:text-gray-900">
                          <button
                            type="button"
                            onClick={() => onGlobalClick(global)}
                            className="hover:underline cursor-pointer"
                          >
                            {global.label || String(global.slug)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500">No globals configured</p>
                  )}
                </div>
              </div>
            </div>

            {/* System Status */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                      <svg
                        className="h-5 w-5 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-labelledby="system-status-icon-title"
                        role="img"
                      >
                        <title id="system-status-icon-title">System Status: Healthy</title>
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
                      <dt className="text-sm font-medium text-gray-500 truncate">System Status</dt>
                      <dd className="text-lg font-medium text-gray-900">Healthy</dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3">
                <div className="text-sm text-gray-600">RevealUI admin is running successfully</div>
              </div>
            </div>
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

export function AdminDashboard({ config }: AdminDashboardProps) {
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
      <div className="min-h-screen bg-gray-50">
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
          />
        </main>
      </div>
    );
  }

  // ── Document edit/create view ─────────────────────────────────────────
  if (state.view.type === 'edit' && state.view.collection) {
    return (
      <div className="min-h-screen bg-gray-50">
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
      <div className="min-h-screen bg-gray-50">
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
      collections={collections}
      globals={globals}
      onCollectionClick={(c) => void handleCollectionClick(c)}
      onGlobalClick={(g) => void handleGlobalClick(g)}
    />
  );
}
