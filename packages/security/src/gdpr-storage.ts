/**
 * GDPR Storage Abstraction
 *
 * Record-oriented storage interface for GDPR compliance data.
 * Provides a clean seam for replacing the default in-memory implementation
 * with a database-backed store in production.
 */

import type { ConsentRecord, ConsentType, DataBreach, DataDeletionRequest } from './gdpr.js';

/**
 * Storage interface for GDPR consent records and deletion requests.
 *
 * All methods are async to support database-backed implementations.
 * The default `InMemoryGDPRStorage` is suitable for testing and development
 * but must be replaced with a persistent store for production use.
 */
export interface GDPRStorage {
  // ── Consent Records ──────────────────────────────────────────────

  /**
   * Store or update a consent record, keyed by `userId:consentType`.
   */
  setConsent(userId: string, type: ConsentType, record: ConsentRecord): Promise<void>;

  /**
   * Retrieve a consent record by user and type. Returns `undefined` if not found.
   */
  getConsent(userId: string, type: ConsentType): Promise<ConsentRecord | undefined>;

  /**
   * Retrieve all consent records for a given user.
   */
  getConsentsByUser(userId: string): Promise<ConsentRecord[]>;

  /**
   * Retrieve every consent record in storage (used for aggregate statistics).
   */
  getAllConsents(): Promise<ConsentRecord[]>;

  // ── Deletion Requests ────────────────────────────────────────────

  /**
   * Store a deletion request, keyed by its `id`.
   */
  setDeletionRequest(request: DataDeletionRequest): Promise<void>;

  /**
   * Retrieve a deletion request by ID. Returns `undefined` if not found.
   */
  getDeletionRequest(requestId: string): Promise<DataDeletionRequest | undefined>;

  /**
   * Retrieve all deletion requests for a given user.
   */
  getDeletionRequestsByUser(userId: string): Promise<DataDeletionRequest[]>;
}

/**
 * Storage interface for data breach records.
 *
 * All methods are async to support database-backed implementations.
 * The default `InMemoryBreachStorage` is suitable for testing and development
 * but must be replaced with a persistent store for production GDPR compliance.
 */
export interface BreachStorage {
  /**
   * Store a data breach record.
   */
  setBreach(breach: DataBreach): Promise<void>;

  /**
   * Retrieve a breach by ID. Returns `undefined` if not found.
   */
  getBreach(id: string): Promise<DataBreach | undefined>;

  /**
   * Retrieve all breach records.
   */
  getAllBreaches(): Promise<DataBreach[]>;

  /**
   * Update an existing breach record (e.g., status change, add mitigation).
   */
  updateBreach(id: string, updates: Partial<DataBreach>): Promise<void>;
}

/**
 * In-memory implementation of `BreachStorage`.
 *
 * WARNING: All data is lost on process restart or serverless cold start.
 * GDPR requires breach records be retained  -  use database-backed storage in production.
 */
export class InMemoryBreachStorage implements BreachStorage {
  private breaches: Map<string, DataBreach> = new Map();

  async setBreach(breach: DataBreach): Promise<void> {
    this.breaches.set(breach.id, breach);
  }

  async getBreach(id: string): Promise<DataBreach | undefined> {
    return this.breaches.get(id);
  }

  async getAllBreaches(): Promise<DataBreach[]> {
    return Array.from(this.breaches.values());
  }

  async updateBreach(id: string, updates: Partial<DataBreach>): Promise<void> {
    const existing = this.breaches.get(id);
    if (existing) {
      this.breaches.set(id, { ...existing, ...updates });
    }
  }
}

/**
 * In-memory implementation of `GDPRStorage`.
 *
 * WARNING: All data is lost on process restart or serverless cold start.
 * Use this only for development, testing, or as a reference implementation.
 * Production deployments MUST supply a database-backed `GDPRStorage`.
 */
export class InMemoryGDPRStorage implements GDPRStorage {
  private consents: Map<string, ConsentRecord> = new Map();
  private deletionRequests: Map<string, DataDeletionRequest> = new Map();

  // ── Consent Records ──────────────────────────────────────────────

  async setConsent(userId: string, type: ConsentType, record: ConsentRecord): Promise<void> {
    this.consents.set(`${userId}:${type}`, record);
  }

  async getConsent(userId: string, type: ConsentType): Promise<ConsentRecord | undefined> {
    return this.consents.get(`${userId}:${type}`);
  }

  async getConsentsByUser(userId: string): Promise<ConsentRecord[]> {
    return Array.from(this.consents.values()).filter((c) => c.userId === userId);
  }

  async getAllConsents(): Promise<ConsentRecord[]> {
    return Array.from(this.consents.values());
  }

  // ── Deletion Requests ────────────────────────────────────────────

  async setDeletionRequest(request: DataDeletionRequest): Promise<void> {
    this.deletionRequests.set(request.id, request);
  }

  async getDeletionRequest(requestId: string): Promise<DataDeletionRequest | undefined> {
    return this.deletionRequests.get(requestId);
  }

  async getDeletionRequestsByUser(userId: string): Promise<DataDeletionRequest[]> {
    return Array.from(this.deletionRequests.values()).filter((r) => r.userId === userId);
  }
}
