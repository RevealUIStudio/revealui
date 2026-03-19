/**
 * Collection Operations
 *
 * Handles CRUD operations for collections with relationship population,
 * hooks, and query building.
 */

import type {
  BatchCreateOptions,
  BatchDeleteOptions,
  BatchResult,
  BatchUpdateOptions,
  CollectionStorageDescriptor,
  PopulateType,
  QueryableDatabaseAdapter,
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
import { createMany } from './operations/createMany.js';
import { deleteDocument } from './operations/delete.js';
import { deleteMany } from './operations/deleteMany.js';
import { find } from './operations/find.js';
import { findByID } from './operations/findById.js';
import { update } from './operations/update.js';
import { updateMany } from './operations/updateMany.js';

export class RevealUICollection {
  config: RevealCollectionConfig;
  storage: CollectionStorageDescriptor | null;
  db: QueryableDatabaseAdapter | null;

  constructor(
    config: RevealCollectionConfig,
    db: QueryableDatabaseAdapter | null,
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

  async createMany(options: BatchCreateOptions): Promise<BatchResult<RevealDocument>> {
    return createMany(this.config, this.db, options);
  }

  async updateMany(options: BatchUpdateOptions): Promise<BatchResult<RevealDocument>> {
    return updateMany(this.config, this.db, options);
  }

  async deleteMany(options: BatchDeleteOptions): Promise<BatchResult<RevealDocument>> {
    return deleteMany(this.config, this.db, options);
  }
}
