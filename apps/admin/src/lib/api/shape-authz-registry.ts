/**
 * Electric shape AuthZ registry (GAP-477 Phase C).
 *
 * Every apps/admin/src/app/api/shapes/<name>/route.ts must appear here with an
 * explicit scope kind. Tests fail closed if a route directory is unregistered
 * so new shapes cannot ship as auth-only proxies.
 */

export type ShapeAuthzScope = 'user_self' | 'site_member' | 'admin_platform' | 'acl_resource';

export interface ShapeAuthzEntry {
  /** Electric table (or primary table) this proxy reads. */
  table: string;
  /** How ownership / admin is enforced on the route. */
  scope: ShapeAuthzScope;
  /** One-line how the where / gate is applied. */
  enforcement: string;
}

/**
 * Canonical map: shape route directory name → AuthZ contract.
 * Keep in lockstep with route files under apps/admin/src/app/api/shapes/.
 */
export const SHAPE_AUTHZ_REGISTRY: Readonly<Record<string, ShapeAuthzEntry>> = {
  conversations: {
    table: 'conversations',
    scope: 'user_self',
    enforcement: 'where user_id = session.user.id',
  },
  'task-submissions': {
    table: 'task_submissions',
    scope: 'user_self',
    enforcement: 'where submitter_id = session.user.id',
  },
  'agent-contexts': {
    table: 'agent_contexts',
    scope: 'user_self',
    enforcement: 'where session_id = auth session id (write path key)',
  },
  'agent-memories': {
    table: 'agent_memories',
    scope: 'site_member',
    enforcement: 'admin: agent_id; non-admin: site access + agent_id AND site_id',
  },
  'coordination-sessions': {
    table: 'coordination_sessions',
    scope: 'admin_platform',
    enforcement: 'isAdminRole full-table',
  },
  'coordination-work-items': {
    table: 'coordination_work_items',
    scope: 'admin_platform',
    enforcement: 'isAdminRole full-table',
  },
  'shared-facts': {
    table: 'shared_facts',
    scope: 'admin_platform',
    enforcement: 'isAdminRole + session_id where (no user ACL column)',
  },
  'shared-memories': {
    table: 'agent_memories',
    scope: 'admin_platform',
    enforcement: 'isAdminRole + scope filter (no user ACL join)',
  },
  'yjs-documents': {
    table: 'yjs_documents',
    scope: 'admin_platform',
    enforcement: 'isAdminRole until owner_id ACL migrates (Phase C residual)',
  },
  'yjs-document-patches': {
    table: 'yjs_document_patches',
    scope: 'admin_platform',
    enforcement: 'isAdminRole until document ACL migrates',
  },
  'kg-nodes': {
    table: 'kg_nodes',
    scope: 'admin_platform',
    enforcement: 'isAdminRole + optional repo where (fleet graph)',
  },
  'kg-edges': {
    table: 'kg_edges',
    scope: 'admin_platform',
    enforcement: 'isAdminRole + optional repo where (fleet graph)',
  },
  'kg-edge-episodes': {
    table: 'kg_edge_episodes',
    scope: 'admin_platform',
    enforcement: 'isAdminRole (join table; no ownership column)',
  },
  'kg-views': {
    table: 'yjs_documents',
    scope: 'admin_platform',
    enforcement: 'isAdminRole + document id where (kg-view ids)',
  },
} as const;

export const SHAPE_AUTHZ_ROUTE_NAMES: readonly string[] = Object.keys(SHAPE_AUTHZ_REGISTRY);
