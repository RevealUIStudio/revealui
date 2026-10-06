/**
 * GDPR Storage Abstraction
 *
 * Record-oriented storage interface for GDPR compliance data.
 * Provides a clean seam for replacing the default in-memory implementation
 * with a database-backed store in production.
 */

import type {
  ConsentRecord,
  ConsentType,
  DataBreach,
  DataCategory,
  DataDeletionRequest,
} from './gdpr.js';

/** Validate category values from public callers and persisted JSON before use. */
export function parseDataCategories(values: readonly string[]): DataCategory[] {
  if (!Array.isArray(values)) throw new Error('Invalid deletion categories');
  const categories: DataCategory[] = [];
  for (let index = 0; index < values.length; index++) {
    if (!Object.hasOwn(values, index)) throw new Error('Invalid deletion category');
    const value = values[index];
    switch (value) {
      case 'personal':
      case 'sensitive':
      case 'financial':
      case 'health':
      case 'behavioral':
      case 'location':
        categories.push(value);
        break;
      default:
        throw new Error('Invalid deletion category');
    }
  }
  return categories;
}

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
   * Create a pending deletion request. Existing IDs must never be overwritten.
   */
  setDeletionRequest(request: DataDeletionRequest): Promise<void>;

  /** Atomically claim a pending request. Return undefined if it cannot be claimed. */
  claimDeletionRequest(requestId: string): Promise<DataDeletionRequest | undefined>;

  /** Finish only a processing request; terminal records are immutable. */
  finishDeletionRequest(
    requestId: string,
    result: {
      status: 'completed' | 'failed';
      processedAt: string;
      deletedData?: string[];
      retainedData?: string[];
    },
  ): Promise<boolean>;

  /**
   * Retrieve a deletion request by ID. Returns `undefined` if not found.
   */
  getDeletionRequest(requestId: string): Promise<DataDeletionRequest | undefined>;

  /**
   * Retrieve all deletion requests for a given user.
   */
  getDeletionRequestsByUser(userId: string): Promise<DataDeletionRequest[]>;
}

/** Validate completion payloads before a storage adapter changes processing state. */
export function parseDeletionResult(
  result: Parameters<GDPRStorage['finishDeletionRequest']>[1],
): Parameters<GDPRStorage['finishDeletionRequest']>[1] {
  if (result === null || typeof result !== 'object') throw new Error('Invalid deletion result');
  const { status, processedAt, deletedData, retainedData } = result;
  if (status !== 'completed' && status !== 'failed')
    throw new Error('Invalid deletion result status');
  if (typeof processedAt !== 'string' || !Number.isFinite(new Date(processedAt).getTime())) {
    throw new Error('Invalid deletion result timestamp');
  }
  return {
    status,
    processedAt,
    deletedData: parseDeletionData(deletedData),
    retainedData: parseDeletionData(retainedData),
  };
}

function parseDeletionData(values: readonly string[] | undefined): string[] | undefined {
  if (values === undefined) return undefined;
  if (!Array.isArray(values)) throw new Error('Invalid deletion result data');
  const data: string[] = [];
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    if (!Object.hasOwn(values, index) || typeof value !== 'string')
      throw new Error('Invalid deletion result data');
    data.push(value);
  }
  return data;
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
    if (
      request.status !== 'pending' ||
      request.processedAt ||
      request.deletedData ||
      request.retainedData
    ) {
      throw new Error('Deletion requests must be created pending without results');
    }
    if (this.deletionRequests.has(request.id)) {
      throw new Error('Deletion request already exists');
    }
    this.deletionRequests.set(
      request.id,
      structuredClone({ ...request, dataCategories: parseDataCategories(request.dataCategories) }),
    );
  }

  async claimDeletionRequest(requestId: string): Promise<DataDeletionRequest | undefined> {
    const request = this.deletionRequests.get(requestId);
    if (request?.status !== 'pending') return undefined;
    const claimed: DataDeletionRequest = { ...request, status: 'processing' };
    this.deletionRequests.set(requestId, claimed);
    return structuredClone(claimed);
  }

  async finishDeletionRequest(
    requestId: string,
    result: Parameters<GDPRStorage['finishDeletionRequest']>[1],
  ): Promise<boolean> {
    const validated = parseDeletionResult(result);
    const request = this.deletionRequests.get(requestId);
    if (request?.status !== 'processing') return false;
    this.deletionRequests.set(requestId, {
      ...request,
      status: validated.status,
      processedAt: validated.processedAt,
      deletedData: validated.deletedData,
      retainedData: validated.retainedData,
    });
    return true;
  }

  async getDeletionRequest(requestId: string): Promise<DataDeletionRequest | undefined> {
    const request = this.deletionRequests.get(requestId);
    return request ? structuredClone(request) : undefined;
  }

  async getDeletionRequestsByUser(userId: string): Promise<DataDeletionRequest[]> {
    return Array.from(this.deletionRequests.values())
      .filter((r) => r.userId === userId)
      .map((request) => structuredClone(request));
  }
}
