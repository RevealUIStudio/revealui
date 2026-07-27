// Build: 2026-03-23

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '@revealui/config';
import { getSharedCMSConfig } from '@revealui/config/revealui';
import type { Field } from '@revealui/contracts/admin';
import type { RevealUIField, RevealUIInstance } from '@revealui/core';
import {
  BoldFeature,
  buildConfig,
  FixedToolbarFeature,
  formBuilderPlugin,
  HeadingFeature,
  ItalicFeature,
  LinkFeature,
  lexicalEditor,
  nestedDocsPlugin,
  redirectsPlugin,
  TreeViewFeature,
  UnderlineFeature,
  universalPostgresAdapter,
} from '@revealui/core';
import { en } from '@revealui/core/admin/i18n/en';
import { createR2Provider, objectStorage } from '@revealui/core/storage';
import { allCollections } from '@/lib/collections/registry';
import Users from '@/lib/collections/Users';
import { createTypedCollectionStorage } from '@/lib/db/typedCollectionStorage';
import { Footer, Header, Settings } from '@/lib/globals';
import { revalidateRedirects } from '@/lib/hooks/revalidateRedirects';

// import { ChatGPTAssistant } from "reveal";
// import { EmbedFeature } from "@/features/embed/feature.server";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

// Get shared config as fallback for serverURL and secret
const sharedConfig = getSharedCMSConfig();
// Share the Drizzle client's pg.Pool with the CMS adapter so both systems
// use a single connection pool. This eliminates dual-pool issues where env
// overrides (probe DB, custom DBs) only reach one system.
// Resolved lazily via poolFactory to avoid pulling @revealui/db/client into
// the top-level module graph (causes Turbopack async module init issues).
const dbAdapter =
  process.env.NODE_ENV === 'test'
    ? universalPostgresAdapter({
        provider: 'electric',
      })
    : universalPostgresAdapter({
        connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
        poolFactory: async () => {
          const { getRestPool } = await import('@revealui/db/client');
          return getRestPool();
        },
      });
// Lazy typed-storage seam: resolve on each call, not at module load.
// CLI seeds call loadSeedEnv() after importing this config module; if we
// snapshot createTypedCollectionStorage() here, POSTGRES_URL is often still
// unset and pages writes fall through to dynamic SQL (which expects a Payload-
// style `_status` column the canonical `pages.status` table does not have).
type TypedStorage = NonNullable<ReturnType<typeof createTypedCollectionStorage>>;
const typedCollectionStorageProxy: TypedStorage = {
  findByID(collection, options) {
    return (
      createTypedCollectionStorage()?.findByID?.(collection, options) ?? Promise.resolve(undefined)
    );
  },
  find(collection, options) {
    return (
      createTypedCollectionStorage()?.find?.(collection, options) ?? Promise.resolve(undefined)
    );
  },
  create(collection, options) {
    return (
      createTypedCollectionStorage()?.create?.(collection, options) ?? Promise.resolve(undefined)
    );
  },
  update(collection, options) {
    return (
      createTypedCollectionStorage()?.update?.(collection, options) ?? Promise.resolve(undefined)
    );
  },
  delete(collection, options) {
    return (
      createTypedCollectionStorage()?.delete?.(collection, options) ?? Promise.resolve(undefined)
    );
  },
};

dbAdapter.collectionStorage = typedCollectionStorageProxy;

export default buildConfig({
  serverURL: (process.env.REVEALUI_PUBLIC_SERVER_URL || sharedConfig.serverURL).trim(),
  secret: (process.env.REVEALUI_SECRET || sharedConfig.secret).trim(),
  admin: {
    importMap: {
      autoGenerate: true,
      baseDir: path.resolve(dirname),
    },
    user: Users.slug as string,
    components: {
      beforeNavLinks: ['@/lib/components/BeforeDashboard'],
      beforeDashboard: ['@/lib/components/Agent'],
      beforeLogin: ['@/lib/components/BeforeLogin'],
      graphics: {
        Icon: '@/lib/components/Icon',
        Logo: '@/lib/components/Logo',
      },
    },
    meta: {
      titleSuffix: '- RevealUI',
      icons: [
        {
          url: '/favicon.ico',
          sizes: '32x32',
          type: 'image/x-icon',
        },
      ],
    },
    livePreview: {
      url: ({ data, locale }: { data: unknown; locale?: string }) => {
        const typedData = data as {
          tenant?: { domains?: Array<{ domain: string }> };
          slug?: string;
        };
        return `${typedData.tenant?.domains?.[0]?.domain || ''}${
          typedData.slug === 'posts' ? `/posts/${typedData.slug}` : `/${typedData.slug || ''}`
        }${locale ? `?locale=${locale}` : ''}`;
      },
      collections: ['pages'],
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  localization: {
    locales: ['en', 'es', 'de'],
    defaultLocale: 'en',
    fallback: true,
  },
  globals: [Settings, Header, Footer],

  cors: (process.env.REVEALUI_CORS_ORIGINS || process.env.REVEALUI_WHITELISTORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  csrf: (process.env.REVEALUI_CORS_ORIGINS || process.env.REVEALUI_WHITELISTORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  typescript: {
    autoGenerate: true,
    outputFile: path.resolve(dirname, 'src/types/revealui.ts'),
  },
  // Use SQLite for build/dev when Postgres is not available, Postgres for production
  // Uses universalPostgresAdapter which supports Supabase, Neon, and Vercel Postgres
  // Automatically detects provider and uses appropriate connection method
  // Supports transaction pooling (port 6543) for Supabase serverless environments
  // IMPORTANT: Force SQLite for tests to avoid Postgres dependency
  db: dbAdapter,
  i18n: {
    supportedLanguages: { en },
  },
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => {
      return [
        ...defaultFeatures,
        FixedToolbarFeature(),
        // EmbedFeature(),
        ...(process.env.NODE_ENV === 'development' ? [TreeViewFeature()] : []),
        UnderlineFeature(),
        BoldFeature(),
        ItalicFeature(),
        LinkFeature({
          enabledCollections: ['pages', 'posts'],
        }),
      ];
    },
  }),

  // sharp is intentionally not injected here: the RevealUI engine does not decode
  // images in-process — resizing is delegated to next/image. (sharp stays in
  // dependencies only for Next.js's own image optimization.)
  plugins: [
    objectStorage({
      collections: {
        media: true,
      },
      // Resolve the storage backend lazily (on first upload), not at config-build
      // time, so admin boots/builds without forcing storage env validation.
      // Cloudflare R2 is the canonical (and sole) backend — mirrors apps/server
      // getMediaStorage(). The legacy Vercel Blob fallback was removed in #1644.
      resolveProvider: () => {
        const { r2 } = config.storage;
        if (r2) return createR2Provider(r2);
        throw new Error(
          'No object-storage backend configured for admin media uploads. Set ' +
            'Cloudflare R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, ' +
            'R2_BUCKET, R2_PUBLIC_BASE_URL) — the canonical (and sole) backend. ' +
            'See docs/guides/deployment.md.',
        );
      },
    }),
    nestedDocsPlugin({
      collections: ['categories'],
    }),
    redirectsPlugin({
      collections: ['pages', 'posts'],
      overrides: {
        fields: ({ defaultFields }: { defaultFields: Field[] }) => {
          return defaultFields.map((field) => {
            if ('name' in field && field.name === 'from') {
              return {
                ...field,
                admin: {
                  description: 'You will need to rebuild the website when changing this field.',
                },
              };
            }
            return field;
          });
        },
        hooks: {
          // @ts-expect-error - revalidateRedirects has a flexible signature that works at runtime
          afterChange: [revalidateRedirects],
        },
      },
    }),
    formBuilderPlugin({
      fields: {
        payment: false,
      },
      formOverrides: {
        fields: ({ defaultFields }: { defaultFields: RevealUIField[] }) => {
          return defaultFields.map((field: RevealUIField) => {
            if ('name' in field && field.name === 'confirmationMessage') {
              return {
                ...field,
                editor: lexicalEditor({
                  features: ({ rootFeatures }) => {
                    return [
                      ...rootFeatures,
                      FixedToolbarFeature(),
                      HeadingFeature({
                        enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'],
                      }),
                    ];
                  },
                }),
              };
            }
            return field;
          });
        },
      },
    }),
  ],
  collections: allCollections,
  // Programmatically create first user on initialization if none exists
  onInit: async (instance: unknown) => {
    const revealui = instance as RevealUIInstance;
    // Skip onInit in test environment to avoid database access before tables exist
    if (process.env.SKIP_ONINIT === 'true' || process.env.NODE_ENV === 'test') {
      return;
    }

    // Validate database connectivity before proceeding
    let existingUsers: { totalDocs: number };
    try {
      existingUsers = await revealui.find({
        collection: 'users',
        limit: 1,
        depth: 0,
        // Trusted env-driven bootstrap (guarded by totalDocs === 0 below):
        // bypass access control so the first-admin seed works on a fresh Fleet
        // kit, where no authenticated user exists yet to satisfy collection access.
        overrideAccess: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isConnectionError =
        message.includes('ECONNREFUSED') ||
        message.includes('connection') ||
        message.includes('ENOTFOUND') ||
        message.includes('timeout');

      if (isConnectionError) {
        revealui.logger.error(
          'Database connection failed. Check that POSTGRES_URL or DATABASE_URL is set and the database is reachable.',
        );
      } else {
        revealui.logger.error(`Database query failed during initialization: ${message}`);
      }
      revealui.logger.warn(
        'Admin app started without database. Dashboard will show errors until a database is connected.',
      );
      return;
    }

    // If no users exist, create the first admin user
    if (existingUsers.totalDocs === 0) {
      const adminEmail = process.env.REVEALUI_ADMIN_EMAIL;
      const adminPassword = process.env.REVEALUI_ADMIN_PASSWORD;

      // SECURITY: Require credentials from environment - no hardcoded defaults
      if (!(adminEmail && adminPassword)) {
        revealui.logger.warn(
          'No users exist. Set REVEALUI_ADMIN_EMAIL and REVEALUI_ADMIN_PASSWORD environment variables to create initial admin user.',
        );
        return;
      }

      // Validate password strength
      if (adminPassword.length < 12) {
        revealui.logger.error(
          'REVEALUI_ADMIN_PASSWORD must be at least 12 characters. Initial admin user not created.',
        );
        return;
      }

      try {
        await revealui.create({
          collection: 'users',
          // See the find() above: this first-admin bootstrap runs before any
          // user exists, so core create()'s access enforcement would otherwise
          // deny it ("Access denied: insufficient permissions to create").
          overrideAccess: true,
          data: {
            name: 'Admin User',
            email: adminEmail,
            password: adminPassword,
            // DB `role` column is CHECK-constrained to the Drizzle enum
            // (owner/admin/editor/viewer/agent/contributor); the app-level
            // 'super-admin' lives in `roles`. Mirrors @revealui/setup bootstrap()
            // — 'super-admin' here violates users_role_check and the create fails.
            role: 'owner',
            roles: ['super-admin'],
            // The operator sets this account via REVEALUI_ADMIN_EMAIL/PASSWORD;
            // it is trusted by definition and there is no mailbox to verify on a
            // self-host. Mark it verified so sign-in does not gate the operator
            // out after the 24h email-verification grace window.
            emailVerified: true,
          },
        });

        revealui.logger.info(`First admin user created: ${adminEmail}`);

        // Stamp TOS acceptance on the typed tos_accepted_at / tos_version
        // columns: revealui.create() above can't persist them (the engine's
        // dynamic-SQL adapter rejects camelCase column identifiers), so an
        // onInit-created owner would otherwise have a NULL tos_accepted_at.
        // Record them via a typed Drizzle write, mirroring the web setup route
        // (api/setup) and the CLI (scripts/admin/bootstrap). Non-fatal — a
        // failure here is a backfillable gap, not a reason to abort startup.
        // Imports are lazy because pulling @revealui/db/client into the
        // top-level module graph causes Turbopack async-module-init issues
        // (see the poolFactory note near the top of this file).
        try {
          const { getClient } = await import('@revealui/db/client');
          const { stampTosAcceptanceByEmail } = await import('@/lib/auth/tos');
          const db = getClient('rest');
          await stampTosAcceptanceByEmail(db, adminEmail);
        } catch (tosError) {
          const message = tosError instanceof Error ? tosError.message : String(tosError);
          revealui.logger.error(
            `Failed to record TOS acceptance for bootstrap admin ${adminEmail}: ${message}`,
          );
        }
      } catch (error) {
        // 23505 = unique_violation  -  user already exists, not a fatal error
        const pgCode = (error as { code?: string }).code;
        if (pgCode === '23505') {
          revealui.logger.info(`Admin user already exists: ${adminEmail}`);
        } else {
          revealui.logger.error(`Failed to create first admin user: ${error}`);
        }
      }
    }
  },
});
