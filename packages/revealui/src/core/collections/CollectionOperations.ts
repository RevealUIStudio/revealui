/**
 * Collection Operations
 *
 * Handles CRUD operations for collections with relationship population,
 * hooks, and query building.
 */

import type {
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
} from '../types/index'
import { create } from './operations/create'
import { deleteDocument } from './operations/delete'
import { find } from './operations/find'
import { findByID } from './operations/findById'
import { update } from './operations/update'

export class RevealUICollection {
  config: RevealCollectionConfig
  db: {
    query: (query: string, values?: unknown[]) => Promise<DatabaseResult>
  } | null

  constructor(
    config: RevealCollectionConfig,
    db: { query: (query: string, values?: unknown[]) => Promise<DatabaseResult> } | null,
  ) {
    this.config = config
    this.db = db
  }

  async find(options: RevealFindOptions): Promise<RevealPaginatedResult> {
    return find(this.config, this.db, options)
  }

  async findByID(options: {
    id: string | number
    depth?: number
    req?: RevealRequest
    populate?: PopulateType
  }): Promise<RevealDocument | null> {
    return findByID(this.config, this.db, options)
  }

  async create(options: RevealCreateOptions): Promise<RevealDocument> {
    return create(this.config, this.db, options)
  }

  async update(options: RevealUpdateOptions): Promise<RevealDocument> {
    return update(this.config, this.db, options)
  }

  async delete(options: RevealDeleteOptions): Promise<RevealDocument> {
    return deleteDocument(this.config, this.db, options)
  }
}
