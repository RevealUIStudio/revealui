/**
 * @revealui/db/schema - Database Schema (Schema/Server-side)
 *
 * Drizzle ORM table definitions derived from @revealui/contracts Zod schemas.
 * Designed for Neon Postgres with pgvector extension for embeddings.
 *
 * The tables mirror the following Zod schemas:
 * - UserSchema, SessionSchema → users, sessions
 * - SiteSchema → sites, siteCollaborators
 * - PageSchema → pages, pageRevisions
 * - AgentContextSchema, AgentMemorySchema, etc. → agent tables
 *
 * This file re-exports both REST and Vector schemas for backward compatibility.
 * For dual database architecture, use:
 * - `@revealui/db/schema/rest` for REST API schemas (NeonDB)
 * - `@revealui/db/schema/vector` for Vector schemas (Supabase)
 */
export * from './rest.js';
export * from './vector.js';
export declare const usersRelations: import("drizzle-orm").Relations<"users", {
    sessions: import("drizzle-orm").Many<"sessions">;
    ownedSites: import("drizzle-orm").Many<"sites">;
    collaborations: import("drizzle-orm").Many<"site_collaborators">;
    pageRevisions: import("drizzle-orm").Many<"page_revisions">;
    conversations: import("drizzle-orm").Many<"conversations">;
}>;
export declare const sessionsRelations: import("drizzle-orm").Relations<"sessions", {
    user: import("drizzle-orm").One<"users", true>;
}>;
export declare const passwordResetTokensRelations: import("drizzle-orm").Relations<"password_reset_tokens", {
    user: import("drizzle-orm").One<"users", true>;
}>;
export declare const sitesRelations: import("drizzle-orm").Relations<"sites", {
    owner: import("drizzle-orm").One<"users", true>;
    collaborators: import("drizzle-orm").Many<"site_collaborators">;
    pages: import("drizzle-orm").Many<"pages">;
}>;
export declare const siteCollaboratorsRelations: import("drizzle-orm").Relations<"site_collaborators", {
    site: import("drizzle-orm").One<"sites", true>;
    user: import("drizzle-orm").One<"users", true>;
    addedByUser: import("drizzle-orm").One<"users", false>;
}>;
export declare const pagesRelations: import("drizzle-orm").Relations<"pages", {
    site: import("drizzle-orm").One<"sites", true>;
    parent: import("drizzle-orm").One<"pages", false>;
    children: import("drizzle-orm").Many<"pages">;
    revisions: import("drizzle-orm").Many<"page_revisions">;
}>;
export declare const pageRevisionsRelations: import("drizzle-orm").Relations<"page_revisions", {
    page: import("drizzle-orm").One<"pages", true>;
    createdByUser: import("drizzle-orm").One<"users", false>;
}>;
export declare const agentContextsRelations: import("drizzle-orm").Relations<"agent_contexts", {}>;
export declare const agentMemoriesRelations: import("drizzle-orm").Relations<"agent_memories", {
    site: import("drizzle-orm").One<"sites", false>;
    verifiedByUser: import("drizzle-orm").One<"users", false>;
}>;
export declare const conversationsRelations: import("drizzle-orm").Relations<"conversations", {
    user: import("drizzle-orm").One<"users", true>;
    actions: import("drizzle-orm").Many<"agent_actions">;
}>;
export declare const agentActionsRelations: import("drizzle-orm").Relations<"agent_actions", {
    conversation: import("drizzle-orm").One<"conversations", false>;
}>;
export declare const postsRelations: import("drizzle-orm").Relations<"posts", {
    author: import("drizzle-orm").One<"users", false>;
    featuredImage: import("drizzle-orm").One<"media", false>;
}>;
export declare const mediaRelations: import("drizzle-orm").Relations<"media", {
    uploadedByUser: import("drizzle-orm").One<"users", false>;
}>;
//# sourceMappingURL=index.d.ts.map