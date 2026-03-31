import {
  escapeIdentifier,
  validateColumnName,
  validateSlug,
} from '../collections/operations/sqlAdapter.js';
import { afterRead } from '../fields/hooks/afterRead/index.js';
import { getRelationshipFields } from '../relationships/analyzer.js';
import type {
  DatabaseResult,
  RevealDocument,
  RevealGlobalConfig,
  RevealRequest,
  SanitizedGlobalConfig,
} from '../types/index.js';
import { flattenResult } from '../utils/flattenResult.js';

/**
 * Global Operations
 *
 * Handles CRUD operations for globals with relationship population.
 */
export class RevealUIGlobal {
  config: RevealGlobalConfig;
  db: {
    query: (query: string, values?: unknown[]) => Promise<DatabaseResult>;
  } | null;

  constructor(
    config: RevealGlobalConfig,
    db: {
      query: (query: string, values?: unknown[]) => Promise<DatabaseResult>;
    } | null,
  ) {
    this.config = config;
    this.db = db;
  }

  async find(
    options: {
      depth?: number;
      populate?: import('../types/index.js').PopulateType;
      req?: RevealRequest;
    } = {},
  ): Promise<RevealDocument | null> {
    const { depth = 0, populate, req } = options;

    // Validate depth
    if (depth < 0 || depth > 3) {
      throw new Error(`Depth must be between 0 and 3, got ${depth}`);
    }

    if (this.db?.query) {
      const slug = this.config.slug;
      try {
        validateSlug(slug);
      } catch {
        throw new Error(
          `Invalid global slug: "${slug}". Must be lowercase alphanumeric with hyphens/underscores.`,
        );
      }
      const tableName = `global_${slug}`;
      let query = `SELECT * FROM "${tableName}" LIMIT 1`;
      const params: unknown[] = [];

      // If depth > 0, we need to populate relationships
      if (depth > 0 && req) {
        // Get relationship fields for this global (similar to collections)
        const relationships = getRelationshipFields(this.config);

        // For now, only handle simple direct FK relationships (depth 1)
        if (relationships.length > 0) {
          const joins: string[] = [];
          const selectColumns: string[] = [`"${tableName}".*`];

          for (const rel of relationships) {
            if (rel.storageType === 'direct_fk' && !rel.hasMany) {
              // Simple foreign key relationship
              const relTableName = Array.isArray(rel.relationTo)
                ? rel.relationTo[0]
                : rel.relationTo;
              if (!relTableName) continue;
              const fkColumn = rel.fkColumnName || `${rel.fieldName}_id`;

              // Validate relationship identifiers to prevent SQL injection via config
              validateSlug(relTableName);
              validateColumnName(fkColumn);

              const alias = `rel_${rel.fieldName}`;

              joins.push(
                `LEFT JOIN "${relTableName}" AS ${alias} ON "${tableName}"."${fkColumn}" = ${alias}.id`,
              );
              selectColumns.push(`${alias}.title AS "${rel.fieldName}.title"`);
              selectColumns.push(`${alias}.id AS "${rel.fieldName}.id"`);
            }
          }

          if (joins.length > 0) {
            query = `SELECT ${selectColumns.join(', ')} FROM "${tableName}" ${joins.join(' ')} LIMIT 1`;
          }
        }
      }

      const result = await this.db.query(query, params);
      let doc = result.rows[0];

      if (!doc) return null;

      // Flatten dotted notation results into nested objects
      doc = flattenResult(doc);

      // Apply relationship population using afterRead hook (similar to collections)
      if (req && depth > 0) {
        // RevealGlobalConfig extends GlobalConfig, which matches SanitizedGlobalConfig structure
        const sanitizedConfig = {
          ...this.config,
          fields: this.config.fields as SanitizedGlobalConfig['fields'],
          flattenedFields: this.config.fields as SanitizedGlobalConfig['flattenedFields'],
          endpoints: this.config.endpoints === false ? undefined : this.config.endpoints,
        } as SanitizedGlobalConfig;

        return await afterRead({
          collection: null,
          global: sanitizedConfig,
          context: req.context || {},
          currentDepth: 1,
          depth,
          doc,
          draft: false,
          fallbackLocale: req.fallbackLocale || 'en',
          findMany: false,
          flattenLocales: true,
          locale: req.locale || 'en',
          overrideAccess: false,
          populate,
          req,
          select: undefined,
          showHiddenFields: false,
        });
      }

      return doc;
    }

    return null;
  }

  async update(options: { data: Partial<RevealDocument> }): Promise<RevealDocument> {
    const { data } = options;

    if (this.db?.query) {
      const slug = this.config.slug;
      try {
        validateSlug(slug);
      } catch {
        throw new Error(
          `Invalid global slug: "${slug}". Must be lowercase alphanumeric with hyphens/underscores.`,
        );
      }
      const tableName = `global_${slug}`;

      // Check if global exists
      const existing = await this.find();
      const id = existing?.id || `global_${slug}`;

      if (existing) {
        // Update (PostgreSQL uses $1, $2 style)
        // Validate column names against allowlist (prevent arbitrary column writes)
        const keys = Object.keys(data);
        for (const key of keys) validateColumnName(key);
        const setClause = keys.map((key, i) => `"${escapeIdentifier(key)}" = $${i + 1}`).join(', ');
        const values = keys.map((key) => {
          const value = data[key];
          // Serialize non-primitive values to JSON strings for SQLite compatibility
          if (
            value !== null &&
            value !== undefined &&
            (typeof value === 'object' || Array.isArray(value))
          ) {
            return JSON.stringify(value);
          }
          return value;
        });
        const query = `UPDATE "${tableName}" SET ${setClause} WHERE id = $${keys.length + 1}`;
        await this.db.query(query, [...values, id]);
      } else {
        // Insert (PostgreSQL uses $1, $2 style)
        // Validate column names against allowlist (prevent arbitrary column writes)
        const columns = Object.keys(data);
        for (const col of columns) validateColumnName(col);
        const placeholders = columns.map((_, i) => `$${i + 2}`).join(', ');
        const values = columns.map((key) => {
          const value = data[key];
          // Serialize non-primitive values to JSON strings for SQLite compatibility
          if (
            value !== null &&
            value !== undefined &&
            (typeof value === 'object' || Array.isArray(value))
          ) {
            return JSON.stringify(value);
          }
          return value;
        });
        const query = `INSERT INTO "${tableName}" (id, ${columns.map((c) => `"${escapeIdentifier(c)}"`).join(', ')}) VALUES ($1, ${placeholders})`;
        await this.db.query(query, [id, ...values]);
      }

      const updatedDoc = await this.find();
      if (!updatedDoc) {
        throw new Error(`Global document ${this.config.slug} not found after update`);
      }
      return updatedDoc;
    }

    return { ...data, id: `global_${this.config.slug}` };
  }
}
