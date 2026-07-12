'use client';

import { useShape } from '@electric-sql/react';
import { useCallback, useMemo, useRef } from 'react';
import { csrfHeaders } from '../csrf.js';
import { fetchWithTimeout } from '../fetch-with-timeout.js';
import { useElectricConfig } from '../provider/index.js';
import {
  buildAnnotationPatch,
  buildKgViewDocumentId,
  buildLayoutPatch,
  buildPinPatch,
  buildPresencePatch,
  isValidKgViewSlug,
  type KgViewState,
  parseKgViewState,
} from './kg-view.js';
import { readScratchpad, type ScratchpadPatch } from './scratchpad-patch-applier.js';

const EMPTY_STATE: KgViewState = {
  annotations: new Map(),
  pins: new Set(),
  layout: new Map(),
  presence: new Map(),
};

/** Default timeout for a curation-overlay patch POST (milliseconds). */
const PATCH_FETCH_TIMEOUT_MS = 10_000;

export interface UseKgViewDocumentResult {
  documentId: string | null;
  state: KgViewState;
  connectedClients: number;
  isLoading: boolean;
  error: Error | null;
  /** Annotate a node with free text. Overwrites any prior annotation for that node. */
  annotate: (nodeId: string, text: string, authorAgentId: string) => Promise<boolean>;
  /** Pin or unpin a node in this view. */
  setPinned: (nodeId: string, pinned: boolean) => Promise<boolean>;
  /** Set a node's layout position in this view. */
  setLayout: (nodeId: string, x: number, y: number) => Promise<boolean>;
  /** Presence heartbeat — see kg-view.ts header comment ("Presence (awareness deferred)"). */
  touchPresence: (clientId: string, name: string, nodeId: string | null) => Promise<boolean>;
}

function decodeBase64State(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Curation overlay for one graph view (design spec §8.3). Reads the
 * `kg-view-<slug>` Y.Doc via the dedicated `/api/shapes/kg-views` shape
 * (repo-agnostic; see that route's header comment for why it is separate
 * from `/api/shapes/yjs-documents`), and writes through the EXISTING,
 * unmodified `/api/sync/yjs-document-patches` route.
 */
export function useKgViewDocument(slug: string): UseKgViewDocumentResult {
  const { proxyBaseUrl } = useElectricConfig();
  const isValid = isValidKgViewSlug(slug);
  const documentId = isValid ? buildKgViewDocumentId(slug) : null;

  // Hook must always be called (Rules of Hooks). Pass an impossible id when
  // the slug is invalid so the shape returns no rows but the hook still runs.
  const { data, isLoading, error } = useShape({
    url: `${proxyBaseUrl}/api/shapes/kg-views`,
    params: { document_id: documentId ?? '__invalid__' },
    fetchClient: fetchWithTimeout,
  });

  const patchUrlRef = useRef<string>('');
  patchUrlRef.current = `${proxyBaseUrl}/api/sync/yjs-document-patches`;

  const { state, connectedClients } = useMemo(() => {
    if (!(documentId && data) || data.length === 0) {
      return { state: EMPTY_STATE, connectedClients: 0 };
    }
    const row = data[0] as Record<string, unknown>;
    const rawState = row.state;
    if (typeof rawState !== 'string' || rawState.length === 0) {
      return { state: EMPTY_STATE, connectedClients: (row.connected_clients as number) ?? 0 };
    }
    const bytes = decodeBase64State(rawState);
    const root = readScratchpad(bytes);
    return {
      state: parseKgViewState(root),
      connectedClients: (row.connected_clients as number) ?? 0,
    };
  }, [documentId, data]);

  const submitPatch = useCallback(
    async (patch: ScratchpadPatch): Promise<boolean> => {
      if (!documentId) return false;
      const url = patchUrlRef.current;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PATCH_FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', ...csrfHeaders(url) },
          body: JSON.stringify({
            document_id: documentId,
            agent_id: 'admin-explorer',
            patch_type: patch.patchType,
            path: patch.path,
            content: patch.content,
          }),
        });
        return response.ok;
      } catch {
        return false;
      } finally {
        clearTimeout(timeout);
      }
    },
    [documentId],
  );

  const annotate = useCallback(
    (nodeId: string, text: string, authorAgentId: string) =>
      submitPatch(buildAnnotationPatch(nodeId, text, authorAgentId)),
    [submitPatch],
  );
  const setPinned = useCallback(
    (nodeId: string, pinned: boolean) => submitPatch(buildPinPatch(nodeId, pinned)),
    [submitPatch],
  );
  const setLayout = useCallback(
    (nodeId: string, x: number, y: number) => submitPatch(buildLayoutPatch(nodeId, x, y)),
    [submitPatch],
  );
  const touchPresence = useCallback(
    (clientId: string, name: string, nodeId: string | null) =>
      submitPatch(buildPresencePatch(clientId, name, nodeId)),
    [submitPatch],
  );

  if (!isValid) {
    return {
      documentId: null,
      state: EMPTY_STATE,
      connectedClients: 0,
      isLoading: false,
      error: new Error(
        'Invalid kg-view slug: lowercase alphanumeric and hyphens only, max 64 chars',
      ),
      annotate,
      setPinned,
      setLayout,
      touchPresence,
    };
  }

  return {
    documentId,
    state,
    connectedClients,
    isLoading,
    error: error || null,
    annotate,
    setPinned,
    setLayout,
    touchPresence,
  };
}
