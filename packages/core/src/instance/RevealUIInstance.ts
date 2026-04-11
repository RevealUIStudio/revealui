import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { RevealUICollection } from '../collections/CollectionOperations.js';
import { buildCollectionStorageRegistry } from '../collections/registry.js';
import { getDataLoader } from '../dataloader.js';
import { afterRead } from '../fields/hooks/afterRead/index.js';
import { RevealUIGlobal } from '../globals/GlobalOperations.js';
import type {
  Field,
  RevealConfig,
  RevealCreateOptions,
  RevealDeleteOptions,
  RevealDocument,
  RevealFindOptions,
  RevealPaginatedResult,
  RevealRequest,
  RevealUIField,
  RevealUIInstance,
  RevealUpdateOptions,
  SanitizedGlobalConfig,
} from '../types/index.js';
import { isJsonFieldType } from '../utils/type-guards.js';
import { createLogger } from './logger.js';
import { create } from './methods/create.js';
import { deleteMethod } from './methods/delete.js';
import { find } from './methods/find.js';
import { findByID } from './methods/findById.js';
import { update } from './methods/update.js';

/**
 * Creates a new RevealUI instance with collections, globals, and database connections
 */
export async function createRevealUIInstance(config: RevealConfig): Promise<RevealUIInstance> {
  const logger = createLogger();

  // Database connection is lazy  -  only connect on first query.
  // A single shared promise guards against concurrent init from multiple requests.
  let dbConnected = false;
  let dbInitPromise: Promise<void> | null = null;

  const ensureDbConnected = async () => {
    if (dbConnected) return;

    if (!dbInitPromise && config.db) {
      const db = config.db; // capture to satisfy narrowing inside async IIFE
      dbInitPromise = (async () => {
        await db.init?.();

        // Queue table creation BEFORE connect()
        // createTable() pushes promises to a queue that connect() will await
        if (config.collections && db.createTable) {
          for (const collection of config.collections) {
            const fields = collection.fields || [];
            const tableFields: Field[] = fields
              .filter((field: RevealUIField) => field.name && !isJsonFieldType(field))
              .map((field: RevealUIField) => ({
                name: field.name || '',
                type: field.type || 'text',
                required: field.required,
                unique: field.unique,
              }));
            db.createTable(collection.slug, tableFields);
          }
        }

        // Queue global table creation BEFORE connect()
        if (config.globals && db.createGlobalTable) {
          for (const global of config.globals) {
            const fields = global.fields || [];
            const jsonTypes = ['array', 'group', 'blocks', 'richText'];
            const tableFields: Field[] = fields
              .filter((field: RevealUIField) => field.name && !jsonTypes.includes(field.type || ''))
              .map((field: RevealUIField) => ({
                name: field.name || '',
                type: field.type || 'text',
                required: field.required,
                unique: field.unique,
              }));
            db.createGlobalTable(global.slug, tableFields);
          }
        }

        // Now connect() will wait for all queued table creation promises
        await db.connect?.();
        dbConnected = true;
      })();
    }

    if (dbInitPromise) {
      await dbInitPromise;
    }
  };

  // Initialize collections and globals
  const collections: { [slug: string]: RevealUICollection } = {};
  const globals: { [slug: string]: RevealUIGlobal } = {};
  const collectionStorageRegistry = buildCollectionStorageRegistry(config.collections);

  // Initialize collections
  if (config.collections) {
    for (const collectionConfig of config.collections) {
      collections[collectionConfig.slug] = new RevealUICollection(
        collectionConfig,
        config.db || null,
        collectionStorageRegistry[collectionConfig.slug] ?? null,
      );
    }
  }

  // Initialize globals
  if (config.globals) {
    for (const globalConfig of config.globals) {
      globals[globalConfig.slug] = new RevealUIGlobal(globalConfig, config.db || null);
    }
  }

  // Create a base request for DataLoader initialization
  const baseReq: RevealRequest = {
    transactionID: null,
    context: {},
  };

  const revealUIInstance: RevealUIInstance = {
    collections,
    collectionStorageRegistry,
    globals,
    config,
    db: config.db || null,
    logger,
    secret: config.secret || undefined,
    async find(
      options: RevealFindOptions & { collection: string },
    ): Promise<RevealPaginatedResult> {
      return find(revealUIInstance, ensureDbConnected, options);
    },

    async findByID(options: {
      collection: string;
      id: string | number;
      depth?: number;
      req?: import('../types/index.js').RevealRequest;
    }): Promise<RevealDocument | null> {
      return findByID(revealUIInstance, ensureDbConnected, options);
    },

    async create(options: RevealCreateOptions & { collection: string }): Promise<RevealDocument> {
      return create(revealUIInstance, ensureDbConnected, options);
    },

    async update(options: RevealUpdateOptions & { collection: string }): Promise<RevealDocument> {
      return update(revealUIInstance, ensureDbConnected, options);
    },

    async delete(options: RevealDeleteOptions & { collection: string }): Promise<RevealDocument> {
      return deleteMethod(revealUIInstance, ensureDbConnected, options);
    },

    async login(options: {
      collection: string;
      data: { email: string; password: string };
      req?: RevealRequest;
    }): Promise<{ user: RevealDocument; token: string }> {
      const { collection, data } = options;

      if (!collections[collection]) {
        throw new Error(`Collection '${collection}' not found`);
      }

      // Find user by email
      const users = await collections[collection].find({
        where: { email: { equals: data.email } },
        limit: 1,
      });

      const user = users.docs[0];
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Verify password
      const hashedPassword = user.password as string | undefined;
      if (!hashedPassword || typeof hashedPassword !== 'string') {
        throw new Error('Invalid credentials');
      }

      // Verify password against bcrypt hash
      if (!hashedPassword.startsWith('$2')) {
        // Reject plain-text passwords  -  they must be migrated first
        throw new Error('Invalid credentials');
      }
      const isPasswordValid = await bcrypt.compare(data.password, hashedPassword);

      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      // Generate opaque session token for session fixation prevention
      const token = randomBytes(32).toString('hex');

      // Remove password from user object before returning
      const userWithoutPassword = { ...user, password: undefined };

      return { user: userWithoutPassword as RevealDocument, token };
    },

    async findGlobal(options: {
      slug: string;
      depth?: number;
      draft?: boolean;
      locale?: string;
      fallbackLocale?: string;
      overrideAccess?: boolean;
      showHiddenFields?: boolean;
      populate?: import('../types/index.js').PopulateType;
      req?: RevealRequest;
    }): Promise<RevealDocument | null> {
      await ensureDbConnected();
      const {
        slug,
        depth = 0,
        draft = false,
        locale,
        fallbackLocale,
        overrideAccess = false,
        showHiddenFields = false,
        populate,
        req,
      } = options;

      // Find global config
      const globalConfig = config.globals?.find((g) => g.slug === slug);
      if (!globalConfig) {
        throw new Error(`Global '${slug}' not found`);
      }

      // Get or use existing global instance
      if (!globals[slug]) {
        throw new Error(`Global '${slug}' instance not initialized`);
      }

      // Use the global's find method to get the document
      const doc = await globals[slug].find({ depth: 0 }); // Get base document first

      if (!doc) {
        return null;
      }

      // Apply afterRead hook for relationship population if depth > 0 and req provided
      if (req && depth > 0) {
        // RevealGlobalConfig extends GlobalConfig, which matches SanitizedGlobalConfig structure
        const sanitizedConfig = {
          ...globalConfig,
          fields: globalConfig.fields as SanitizedGlobalConfig['fields'],
          flattenedFields: globalConfig.fields as SanitizedGlobalConfig['flattenedFields'],
          endpoints: globalConfig.endpoints === false ? undefined : globalConfig.endpoints,
        } as SanitizedGlobalConfig;

        return await afterRead({
          collection: null,
          global: sanitizedConfig,
          context: req.context || {},
          currentDepth: 1,
          depth,
          doc,
          draft,
          fallbackLocale: fallbackLocale || req.fallbackLocale || 'en',
          findMany: false,
          flattenLocales: true,
          locale: locale || req.locale || 'en',
          overrideAccess,
          populate,
          req,
          select: undefined,
          showHiddenFields,
        });
      }

      return doc;
    },

    async updateGlobal(options: {
      slug: string;
      data: Partial<RevealDocument>;
      depth?: number;
      req?: RevealRequest;
    }): Promise<RevealDocument> {
      await ensureDbConnected();
      const { slug } = options;

      if (!globals[slug]) {
        throw new Error(`Global '${slug}' not found`);
      }

      return globals[slug].update(options);
    },

    /**
     * Manually populate relationships on documents
     *
     * Useful for:
     * - Manual population after queries
     * - AI context generation with relationships
     * - Selective field population
     * - Batch population for performance
     *
     * @example
     * ```typescript
     * // Populate single document
     * const post = await revealui.findByID({ collection: 'posts', id: '123' })
     * const populated = await revealui.populate('posts', post, { depth: 2 })
     *
     * // Populate multiple documents
     * const posts = await revealui.find({ collection: 'posts' })
     * const populated = await revealui.populate('posts', posts.docs, { depth: 1 })
     * ```
     */
    async populate(
      collection: string,
      docs: RevealDocument | RevealDocument[],
      options?: {
        depth?: number;
        draft?: boolean;
        locale?: string;
        fallbackLocale?: string;
        overrideAccess?: boolean;
        showHiddenFields?: boolean;
        req?: RevealRequest;
      },
    ): Promise<RevealDocument | RevealDocument[]> {
      await ensureDbConnected();

      const {
        depth = 1,
        draft = false,
        locale = 'en',
        fallbackLocale = 'en',
        overrideAccess = false,
        showHiddenFields = false,
        req,
      } = options || {};

      // Get collection config
      const collectionConfig = config.collections?.find((c) => c.slug === collection);
      if (!collectionConfig) {
        throw new Error(`Collection '${collection}' not found`);
      }

      // Create a request context if not provided
      const populateReq: RevealRequest = req || {
        ...baseReq,
        locale,
        fallbackLocale,
        revealui: revealUIInstance,
        dataLoader: getDataLoader(baseReq),
      };

      // Handle single document
      if (!Array.isArray(docs)) {
        return await afterRead({
          collection: collectionConfig as import('../types/index.js').SanitizedCollectionConfig,
          context: populateReq.context || {},
          currentDepth: 0,
          depth,
          doc: docs,
          draft,
          fallbackLocale,
          findMany: false,
          flattenLocales: true,
          global: null,
          locale,
          overrideAccess,
          populate: undefined,
          req: populateReq,
          select: undefined,
          showHiddenFields,
        });
      }

      // Handle array of documents
      return await Promise.all(
        docs.map(async (doc) =>
          afterRead({
            collection: collectionConfig as import('../types/index.js').SanitizedCollectionConfig,
            context: populateReq.context || {},
            currentDepth: 0,
            depth,
            doc,
            draft,
            fallbackLocale,
            findMany: false,
            flattenLocales: true,
            global: null,
            locale,
            overrideAccess,
            populate: undefined,
            req: populateReq,
            select: undefined,
            showHiddenFields,
          }),
        ),
      );
    },
  };

  // Run onInit hook if provided (skip during build to avoid database connections)
  const isBuildTime =
    process.env.NEXT_PHASE === 'phase-production-build' ||
    (process.env.NODE_ENV === 'production' && !process.env.RUNTIME_INIT);

  if (config.onInit && !isBuildTime) {
    await config.onInit(revealUIInstance);
  }

  // Initialize DataLoader for the base request
  baseReq.revealui = revealUIInstance;
  baseReq.dataLoader = getDataLoader(baseReq);

  return revealUIInstance;
}
