import { useShape } from '@electric-sql/react';
import { fetchWithTimeout } from '../fetch-with-timeout.js';
import { useElectricConfig } from '../provider/index.js';

export interface CollabDocumentState {
  initialState: Uint8Array | null;
  connectedClients: number;
  isLoading: boolean;
  error: Error | null;
}

// UUID v4 pattern  -  only format accepted as a yjs_documents PK
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useCollabDocument(documentId: string): CollabDocumentState {
  const { proxyBaseUrl } = useElectricConfig();

  // Validate before interpolating into the WHERE clause. yjs_documents PKs are
  // always UUIDs  -  reject anything else so no untrusted string enters the query.
  const isValidId = UUID_RE.test(documentId);

  // Hook must always be called (Rules of Hooks). Pass an impossible WHERE when
  // the ID is invalid so the shape returns no rows but the hook still runs.
  const { data, isLoading, error } = useShape({
    url: `${proxyBaseUrl}/api/shapes/yjs-documents`,
    params: {
      document_id: isValidId ? documentId : '__invalid__',
    },
    fetchClient: fetchWithTimeout,
  });

  if (!isValidId) {
    return {
      initialState: null,
      connectedClients: 0,
      isLoading: false,
      error: new Error('Invalid documentId: must be a UUID'),
    };
  }

  let initialState: Uint8Array | null = null;
  let connectedClients = 0;

  if (data && data.length > 0) {
    const row = data[0] as Record<string, unknown>;
    const state = row.state as string | null;
    if (state) {
      const binary = atob(state);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      initialState = bytes;
    }
    connectedClients = (row.connected_clients as number) ?? 0;
  }

  return {
    initialState,
    connectedClients,
    isLoading,
    error: error ? new Error(String(error)) : null,
  };
}
