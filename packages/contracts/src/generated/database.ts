/**
 * Generated Database Type for NeonDB
 *
 * This file defines standalone database entity types that match the Drizzle schema
 * definitions in @revealui/db without importing from it, breaking the circular
 * dependency between @revealui/contracts and @revealui/db.
 *
 * The canonical schema definitions live in @revealui/db/src/core/*.ts (Drizzle tables).
 * These types must be kept in sync with those schemas. The type generation script
 * (pnpm generate:types) can verify compatibility.
 *
 * Generated: 2026-01-28T00:00:00.000Z
 */

// =============================================================================
// Shared Column Types
// =============================================================================

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

// =============================================================================
// Agent Actions
// =============================================================================

export interface AgentActionsRow {
  id: string
  version: number
  conversationId: string | null
  agentId: string
  tool: string
  params: JsonValue | null
  result: JsonValue | null
  status: string
  error: string | null
  startedAt: Date
  completedAt: Date | null
  durationMs: number | null
  reasoning: string | null
  confidence: number | null
}

export interface AgentActionsInsert {
  id: string
  version?: number
  conversationId?: string | null
  agentId: string
  tool: string
  params?: JsonValue | null
  result?: JsonValue | null
  status?: string
  error?: string | null
  startedAt?: Date
  completedAt?: Date | null
  durationMs?: number | null
  reasoning?: string | null
  confidence?: number | null
}

export type AgentActionsUpdate = Partial<AgentActionsInsert>

// =============================================================================
// Agent Contexts
// =============================================================================

export interface AgentContextsRow {
  id: string
  version: number
  sessionId: string
  agentId: string
  context: JsonValue | null
  priority: number | null
  embedding: number[] | null
  createdAt: Date
  updatedAt: Date
}

export interface AgentContextsInsert {
  id: string
  version?: number
  sessionId: string
  agentId: string
  context?: JsonValue | null
  priority?: number | null
  embedding?: number[] | null
  createdAt?: Date
  updatedAt?: Date
}

export type AgentContextsUpdate = Partial<AgentContextsInsert>

// =============================================================================
// Agent Memories
// =============================================================================

export interface AgentMemoriesRow {
  id: string
  version: number
  content: string
  type: string
  source: JsonValue
  embedding: number[] | null
  embeddingMetadata: JsonValue | null
  metadata: JsonValue | null
  accessCount: number | null
  accessedAt: Date | null
  verified: boolean | null
  verifiedBy: string | null
  verifiedAt: Date | null
  siteId: string | null
  agentId: string | null
  createdAt: Date
  expiresAt: Date | null
}

export interface AgentMemoriesInsert {
  id: string
  version?: number
  content: string
  type: string
  source: JsonValue
  embedding?: number[] | null
  embeddingMetadata?: JsonValue | null
  metadata?: JsonValue | null
  accessCount?: number | null
  accessedAt?: Date | null
  verified?: boolean | null
  verifiedBy?: string | null
  verifiedAt?: Date | null
  siteId?: string | null
  agentId?: string | null
  createdAt?: Date
  expiresAt?: Date | null
}

export type AgentMemoriesUpdate = Partial<AgentMemoriesInsert>

// =============================================================================
// Conversations
// =============================================================================

export interface ConversationsRow {
  id: string
  userId: string
  agentId: string
  title: string | null
  status: string
  deviceId: string | null
  lastSyncedAt: Date | null
  version: number
  createdAt: Date
  updatedAt: Date
}

export interface ConversationsInsert {
  id?: string
  userId: string
  agentId: string
  title?: string | null
  status?: string
  deviceId?: string | null
  lastSyncedAt?: Date | null
  version?: number
  createdAt?: Date
  updatedAt?: Date
}

export type ConversationsUpdate = Partial<ConversationsInsert>

// =============================================================================
// CRDT Operations
// =============================================================================

export interface CrdtOperationsRow {
  id: string
  crdtId: string
  crdtType: string
  operationType: string
  payload: JsonValue
  nodeId: string
  timestamp: number
  createdAt: Date
}

export interface CrdtOperationsInsert {
  id: string
  crdtId: string
  crdtType: string
  operationType: string
  payload: JsonValue
  nodeId: string
  timestamp: number
  createdAt?: Date
}

export type CrdtOperationsUpdate = Partial<CrdtOperationsInsert>

// =============================================================================
// Failed Attempts
// =============================================================================

export interface FailedAttemptsRow {
  email: string
  count: number
  lockUntil: Date | null
  windowStart: Date
  createdAt: Date
  updatedAt: Date
}

export interface FailedAttemptsInsert {
  email: string
  count?: number
  lockUntil?: Date | null
  windowStart: Date
  createdAt?: Date
  updatedAt?: Date
}

export type FailedAttemptsUpdate = Partial<FailedAttemptsInsert>

// =============================================================================
// Global Footer
// =============================================================================

export interface GlobalFooterRow {
  id: string
  schemaVersion: string
  columns: Array<{ label: string; links: Array<{ label: string; url: string; newTab?: boolean }> }> | null
  copyright: string | null
  socialLinks: Array<{ platform: string; url: string }> | null
  createdAt: Date
  updatedAt: Date
}

export interface GlobalFooterInsert {
  id?: string
  schemaVersion?: string
  columns?: Array<{ label: string; links: Array<{ label: string; url: string; newTab?: boolean }> }> | null
  copyright?: string | null
  socialLinks?: Array<{ platform: string; url: string }> | null
  createdAt?: Date
  updatedAt?: Date
}

export type GlobalFooterUpdate = Partial<GlobalFooterInsert>

// =============================================================================
// Global Header
// =============================================================================

export interface GlobalHeaderRow {
  id: string
  schemaVersion: string
  navItems: Array<{
    label: string
    url: string
    newTab?: boolean
    children?: Array<{ label: string; url: string; newTab?: boolean }>
  }> | null
  logoId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface GlobalHeaderInsert {
  id?: string
  schemaVersion?: string
  navItems?: Array<{
    label: string
    url: string
    newTab?: boolean
    children?: Array<{ label: string; url: string; newTab?: boolean }>
  }> | null
  logoId?: string | null
  createdAt?: Date
  updatedAt?: Date
}

export type GlobalHeaderUpdate = Partial<GlobalHeaderInsert>

// =============================================================================
// Global Settings
// =============================================================================

export interface GlobalSettingsRow {
  id: string
  schemaVersion: string
  siteName: string | null
  siteDescription: string | null
  defaultMeta: JsonValue | null
  contactEmail: string | null
  contactPhone: string | null
  socialProfiles: JsonValue | null
  analyticsId: string | null
  features: JsonValue | null
  createdAt: Date
  updatedAt: Date
}

export interface GlobalSettingsInsert {
  id?: string
  schemaVersion?: string
  siteName?: string | null
  siteDescription?: string | null
  defaultMeta?: JsonValue | null
  contactEmail?: string | null
  contactPhone?: string | null
  socialProfiles?: JsonValue | null
  analyticsId?: string | null
  features?: JsonValue | null
  createdAt?: Date
  updatedAt?: Date
}

export type GlobalSettingsUpdate = Partial<GlobalSettingsInsert>

// =============================================================================
// Media
// =============================================================================

export interface MediaRow {
  id: string
  schemaVersion: string
  filename: string
  mimeType: string
  filesize: number | null
  url: string
  alt: string | null
  width: number | null
  height: number | null
  focalPoint: JsonValue | null
  sizes: JsonValue | null
  uploadedBy: string | null
  createdAt: Date
  updatedAt: Date
}

export interface MediaInsert {
  id: string
  schemaVersion?: string
  filename: string
  mimeType: string
  filesize?: number | null
  url: string
  alt?: string | null
  width?: number | null
  height?: number | null
  focalPoint?: JsonValue | null
  sizes?: JsonValue | null
  uploadedBy?: string | null
  createdAt?: Date
  updatedAt?: Date
}

export type MediaUpdate = Partial<MediaInsert>

// =============================================================================
// Node ID Mappings
// =============================================================================

export interface NodeIdMappingsRow {
  id: string
  entityType: string
  entityId: string
  nodeId: string
  createdAt: Date
  updatedAt: Date
}

export interface NodeIdMappingsInsert {
  id: string
  entityType: string
  entityId: string
  nodeId: string
  createdAt?: Date
  updatedAt?: Date
}

export type NodeIdMappingsUpdate = Partial<NodeIdMappingsInsert>

// =============================================================================
// Page Revisions
// =============================================================================

export interface PageRevisionsRow {
  id: string
  pageId: string
  createdBy: string | null
  revisionNumber: number
  title: string
  blocks: unknown[] | null
  seo: JsonValue | null
  changeDescription: string | null
  createdAt: Date
}

export interface PageRevisionsInsert {
  id: string
  pageId: string
  createdBy?: string | null
  revisionNumber: number
  title: string
  blocks?: unknown[] | null
  seo?: JsonValue | null
  changeDescription?: string | null
  createdAt?: Date
}

export type PageRevisionsUpdate = Partial<PageRevisionsInsert>

// =============================================================================
// Pages
// =============================================================================

export interface PagesRow {
  id: string
  schemaVersion: string
  siteId: string
  parentId: string | null
  templateId: string | null
  title: string
  slug: string
  path: string
  status: string
  blocks: unknown[] | null
  seo: JsonValue | null
  blockCount: number | null
  wordCount: number | null
  lock: JsonValue | null
  scheduledAt: Date | null
  createdAt: Date
  updatedAt: Date
  publishedAt: Date | null
}

export interface PagesInsert {
  id: string
  schemaVersion?: string
  siteId: string
  parentId?: string | null
  templateId?: string | null
  title: string
  slug: string
  path: string
  status?: string
  blocks?: unknown[] | null
  seo?: JsonValue | null
  blockCount?: number | null
  wordCount?: number | null
  lock?: JsonValue | null
  scheduledAt?: Date | null
  createdAt?: Date
  updatedAt?: Date
  publishedAt?: Date | null
}

export type PagesUpdate = Partial<PagesInsert>

// =============================================================================
// Posts
// =============================================================================

export interface PostsRow {
  id: string
  schemaVersion: string
  title: string
  slug: string
  excerpt: string | null
  content: JsonValue | null
  featuredImageId: string | null
  authorId: string | null
  status: string
  published: boolean | null
  meta: JsonValue | null
  categories: string[] | null
  createdAt: Date
  updatedAt: Date
  publishedAt: Date | null
}

export interface PostsInsert {
  id: string
  schemaVersion?: string
  title: string
  slug: string
  excerpt?: string | null
  content?: JsonValue | null
  featuredImageId?: string | null
  authorId?: string | null
  status?: string
  published?: boolean | null
  meta?: JsonValue | null
  categories?: string[] | null
  createdAt?: Date
  updatedAt?: Date
  publishedAt?: Date | null
}

export type PostsUpdate = Partial<PostsInsert>

// =============================================================================
// Rate Limits
// =============================================================================

export interface RateLimitsRow {
  key: string
  value: string
  resetAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface RateLimitsInsert {
  key: string
  value: string
  resetAt: Date
  createdAt?: Date
  updatedAt?: Date
}

export type RateLimitsUpdate = Partial<RateLimitsInsert>

// =============================================================================
// Sessions
// =============================================================================

export interface SessionsRow {
  id: string
  schemaVersion: string
  userId: string
  tokenHash: string
  userAgent: string | null
  ipAddress: string | null
  persistent: boolean | null
  lastActivityAt: Date
  createdAt: Date
  expiresAt: Date
}

export interface SessionsInsert {
  id: string
  schemaVersion?: string
  userId: string
  tokenHash: string
  userAgent?: string | null
  ipAddress?: string | null
  persistent?: boolean | null
  lastActivityAt?: Date
  createdAt?: Date
  expiresAt: Date
}

export type SessionsUpdate = Partial<SessionsInsert>

// =============================================================================
// Site Collaborators
// =============================================================================

export interface SiteCollaboratorsRow {
  id: string
  siteId: string
  userId: string
  role: string
  addedBy: string | null
  addedAt: Date
}

export interface SiteCollaboratorsInsert {
  id: string
  siteId: string
  userId: string
  role?: string
  addedBy?: string | null
  addedAt?: Date
}

export type SiteCollaboratorsUpdate = Partial<SiteCollaboratorsInsert>

// =============================================================================
// Sites
// =============================================================================

export interface SitesRow {
  id: string
  schemaVersion: string
  ownerId: string
  name: string
  slug: string
  description: string | null
  status: string
  theme: JsonValue | null
  settings: JsonValue | null
  pageCount: number | null
  favicon: string | null
  createdAt: Date
  updatedAt: Date
  publishedAt: Date | null
}

export interface SitesInsert {
  id: string
  schemaVersion?: string
  ownerId: string
  name: string
  slug: string
  description?: string | null
  status?: string
  theme?: JsonValue | null
  settings?: JsonValue | null
  pageCount?: number | null
  favicon?: string | null
  createdAt?: Date
  updatedAt?: Date
  publishedAt?: Date | null
}

export type SitesUpdate = Partial<SitesInsert>

// =============================================================================
// Users
// =============================================================================

export interface UsersRow {
  id: string
  schemaVersion: string
  type: string
  name: string
  email: string | null
  avatarUrl: string | null
  passwordHash: string | null
  role: string
  status: string
  agentModel: string | null
  agentCapabilities: string[] | null
  agentConfig: JsonValue | null
  preferences: JsonValue | null
  createdAt: Date
  updatedAt: Date
  lastActiveAt: Date | null
}

export interface UsersInsert {
  id: string
  schemaVersion?: string
  type?: string
  name: string
  email?: string | null
  avatarUrl?: string | null
  passwordHash?: string | null
  role?: string
  status?: string
  agentModel?: string | null
  agentCapabilities?: string[] | null
  agentConfig?: JsonValue | null
  preferences?: JsonValue | null
  createdAt?: Date
  updatedAt?: Date
  lastActiveAt?: Date | null
}

export type UsersUpdate = Partial<UsersInsert>

// =============================================================================
// Database Type (flat mapping for contracts layer)
// =============================================================================

export interface Database {
  // Agent tables
  AgentActions: AgentActionsRow
  AgentContexts: AgentContextsRow
  AgentMemories: AgentMemoriesRow
  Conversations: ConversationsRow

  // CRDT tables
  CrdtOperations: CrdtOperationsRow
  NodeIdMappings: NodeIdMappingsRow

  // CMS tables
  GlobalFooter: GlobalFooterRow
  GlobalHeader: GlobalHeaderRow
  GlobalSettings: GlobalSettingsRow
  Media: MediaRow
  Pages: PagesRow
  PageRevisions: PageRevisionsRow
  Posts: PostsRow

  // Security tables
  FailedAttempts: FailedAttemptsRow
  RateLimits: RateLimitsRow
  Sessions: SessionsRow
  Users: UsersRow

  // Site management
  Sites: SitesRow
  SiteCollaborators: SiteCollaboratorsRow
}

// =============================================================================
// Utility Types
// =============================================================================

export type DatabaseRow<T extends keyof Database> = Database[T]
export type DatabaseInsert<T extends keyof Database> = T extends 'AgentActions'
  ? AgentActionsInsert
  : T extends 'AgentContexts'
    ? AgentContextsInsert
    : T extends 'AgentMemories'
      ? AgentMemoriesInsert
      : T extends 'Conversations'
        ? ConversationsInsert
        : T extends 'CrdtOperations'
          ? CrdtOperationsInsert
          : T extends 'NodeIdMappings'
            ? NodeIdMappingsInsert
            : T extends 'GlobalFooter'
              ? GlobalFooterInsert
              : T extends 'GlobalHeader'
                ? GlobalHeaderInsert
                : T extends 'GlobalSettings'
                  ? GlobalSettingsInsert
                  : T extends 'Media'
                    ? MediaInsert
                    : T extends 'Pages'
                      ? PagesInsert
                      : T extends 'PageRevisions'
                        ? PageRevisionsInsert
                        : T extends 'Posts'
                          ? PostsInsert
                          : T extends 'FailedAttempts'
                            ? FailedAttemptsInsert
                            : T extends 'RateLimits'
                              ? RateLimitsInsert
                              : T extends 'Sessions'
                                ? SessionsInsert
                                : T extends 'Users'
                                  ? UsersInsert
                                  : T extends 'Sites'
                                    ? SitesInsert
                                    : T extends 'SiteCollaborators'
                                      ? SiteCollaboratorsInsert
                                      : never

export type DatabaseUpdate<T extends keyof Database> = Partial<DatabaseInsert<T>>

// =============================================================================
// Table Names Union
// =============================================================================

export type TableName =
  | 'AgentActions'
  | 'AgentContexts'
  | 'AgentMemories'
  | 'Conversations'
  | 'CrdtOperations'
  | 'NodeIdMappings'
  | 'GlobalFooter'
  | 'GlobalHeader'
  | 'GlobalSettings'
  | 'Media'
  | 'Pages'
  | 'PageRevisions'
  | 'Posts'
  | 'FailedAttempts'
  | 'RateLimits'
  | 'Sessions'
  | 'Users'
  | 'Sites'
  | 'SiteCollaborators'
