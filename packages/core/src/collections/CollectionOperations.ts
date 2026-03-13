/**
 * Collection Operations
 *
 * Handles CRUD operations for collections with relationship population,
 * hooks, and query building.
 */

import type {
  CollectionStorageDescriptor,
  DatabaseResult,
  PopulateType,
  RevealCollectionConfig,
  RevealCreateOptions,
  RevealDeleteOptions,
  RevealDocument,
  RevealFindOptions,
  RevealPaginatedResult,
  RevealRequest,
  RevealUpdateOptions,
} from '../types/index.js';
import { create } from './operations/create.js';
import { deleteDocument } from './operations/delete.js';
import { find } from './operations/find.js';
import { findByID } from './operations/findById.js';
import { update } from './operations/update.js';

export class RevealUICollection {
  config: RevealCollectionConfig;
  storage: CollectionStorageDescriptor | null;
  db: {
    query: (query: string, values?: unknown[]) => Promise<DatabaseResult>;
  } | null;

  constructor(
    config: RevealCollectionConfig,
    db: {
      query: (query: string, values?: unknown[]) => Promise<DatabaseResult>;
    } | null,
    storage: CollectionStorageDescriptor | null = null,
  ) {
    this.config = config;
    this.db = db;
    this.storage = storage;
  }

  async find(options: RevealFindOptions): Promise<RevealPaginatedResult> {
    return find(this.config, this.db, options);
  }

  async findByID(options: {
    id: string | number;
    depth?: number;
    req?: RevealRequest;
    populate?: PopulateType;
  }): Promise<RevealDocument | null> {
    return findByID(this.config, this.db, options);
  }

  async create(options: RevealCreateOptions): Promise<RevealDocument> {
    return create(this.config, this.db, options);
  }

  async update(options: RevealUpdateOptions): Promise<RevealDocument> {
    return update(this.config, this.db, options);
  }

  async delete(options: RevealDeleteOptions): Promise<RevealDocument> {
    return deleteDocument(this.config, this.db, options);
  }
}
