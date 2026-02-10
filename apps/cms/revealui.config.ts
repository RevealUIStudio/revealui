import path from 'node:path'
import { fileURLToPath } from 'node:url'
// Import shared configuration from @revealui/config
import { getSharedCMSConfig } from '@revealui/config/revealui'
import type { Field } from '@revealui/contracts/cms'
import type { RevealUIField, RevealUIInstance } from '@revealui/core'
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
  vercelBlobStorage,
} from '@revealui/core'
import sharp from 'sharp'
import Banners from '@/lib/collections/Banners'
import Cards from '@/lib/collections/Cards'
import Categories from '@/lib/collections/Categories'
import Contents from '@/lib/collections/Contents'
import { Conversations } from '@/lib/collections/Conversations'
import Events from '@/lib/collections/Events'
import Heros from '@/lib/collections/Heros'
import Layouts from '@/lib/collections/Layouts'
import { Media } from '@/lib/collections/Media'
import { Orders } from '@/lib/collections/Orders'
import { Pages } from '@/lib/collections/Pages/index'
import { Posts } from '@/lib/collections/Posts'
import Prices from '@/lib/collections/Prices'
import Products from '@/lib/collections/Products'
import Subscriptions from '@/lib/collections/Subscriptions'
import Tags from '@/lib/collections/Tags'
import { Tenants } from '@/lib/collections/Tenants'
import Users from '@/lib/collections/Users'
import { Footer, Header, Settings } from '@/lib/globals'
import { revalidateRedirects } from '@/lib/hooks/revalidateRedirects'
// Import config and detectEnvironment from the actual config package (NOT the alias!)
// The @revealui/config alias points to THIS file (revealui.config.ts), so using it here
// would create a circular dependency. Instead, import directly from the package.
import config from '../../packages/config/src/index'
import { detectEnvironment } from '../../packages/config/src/loader'
import { en } from '../../packages/core/src/client/admin/i18n/en'

// import { ChatGPTAssistant } from "reveal";
// import { EmbedFeature } from "@/features/embed/feature.server";

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Calculate project root (always absolute from file location)
// This ensures .revealui/cache/ is always created in the project root,
// regardless of where commands are run from (apps/, apps/cms/, etc.)
const _projectRoot = path.resolve(dirname, '../..')

// Config is loaded and validated automatically on import
// Runtime validation happens here - will throw if invalid

// Get shared config and merge with app-specific config
// Shared config provides base serverURL and secret, but we prefer
// the config package values for consistency with the rest of the app
const sharedConfig = getSharedCMSConfig()

// Type assertion needed for RevealCollectionConfig compatibility with base Config type
export default buildConfig({
  // Use shared config as base, but prefer config package values if they differ
  serverURL: config.reveal.publicServerURL || sharedConfig.serverURL,
  secret: config.reveal.secret || sharedConfig.secret,
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
      titleSuffix: '- Streetbeefs Scrapyard',
      icons: [
        {
          url: 'https://res.cloudinary.com/dpytkhyme/image/upload/v1717457061/STREETBEEFS%20SCRAPYARD/streetbeefs-scrapyard-logo-1_jnrb9t.webp',
          sizes: '32x32',
          type: 'image/webp',
        },
      ],
    },
    livePreview: {
      url: ({ data, locale }: { data: unknown; locale?: string }) => {
        const typedData = data as {
          tenant?: { domains?: Array<{ domain: string }> }
          slug?: string
        }
        return `${typedData.tenant?.domains?.[0]?.domain || ''}${
          typedData.slug === 'posts' ? `/posts/${typedData.slug}` : `/${typedData.slug || ''}`
        }${locale ? `?locale=${locale}` : ''}`
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

  cors: config.reveal.corsOrigins || config.reveal.whitelistOrigins || [],
  csrf: config.reveal.corsOrigins || config.reveal.whitelistOrigins || [],
  typescript: {
    autoGenerate: true,
    outputFile: path.resolve(dirname, 'src/types/revealui.ts'),
  },
  // Use SQLite for build/dev when Postgres is not available, Postgres for production
  // Uses universalPostgresAdapter which supports Supabase, Neon, and Vercel Postgres
  // Automatically detects provider and uses appropriate connection method
  // Supports transaction pooling (port 6543) for Supabase serverless environments
  // IMPORTANT: Force SQLite for tests to avoid Postgres dependency
  db:
    process.env.NODE_ENV === 'test'
      ? universalPostgresAdapter({
          provider: 'electric',
        })
      : config.database.url
        ? universalPostgresAdapter({
            connectionString: config.database.url,
          })
        : universalPostgresAdapter({
            provider: 'electric',
          }),
  i18n: {
    supportedLanguages: { en },
  },
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => {
      return [
        ...defaultFeatures,
        FixedToolbarFeature(),
        // EmbedFeature(),
        TreeViewFeature(),
        UnderlineFeature(),
        BoldFeature(),
        ItalicFeature(),
        LinkFeature({
          enabledCollections: ['pages', 'posts'],
        }),
      ]
    },
  }),

  sharp,

  plugins: [
    vercelBlobStorage({
      enabled: true,
      collections: {
        media: true,
      },
      token: config.storage.blobToken,
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
              }
            }
            return field
          })
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
                    ]
                  },
                }),
              }
            }
            return field
          })
        },
      },
    }),
  ],
  collections: [
    Users,
    Tenants,
    Pages,
    Media,
    Layouts,
    Contents,
    Categories,
    Tags,
    Events,
    Cards,
    Heros,
    Products,
    Prices,
    Orders,
    Posts,
    Subscriptions,
    Banners,
    Conversations,
  ],
  // Programmatically create first user on initialization if none exists
  onInit: async (instance: RevealUIInstance) => {
    const revealui = instance
    // Skip onInit in test environment to avoid database access before tables exist
    if (config.optional.devTools.skipOnInit || detectEnvironment() === 'test') {
      return
    }

    // Check if any users exist
    const existingUsers = await revealui.find({
      collection: 'users',
      limit: 1,
      depth: 0,
    })

    // If no users exist, create the first admin user
    if (existingUsers.totalDocs === 0) {
      const adminEmail = config.reveal.adminEmail
      const adminPassword = config.reveal.adminPassword

      // SECURITY: Require credentials from environment - no hardcoded defaults
      if (!(adminEmail && adminPassword)) {
        revealui.logger.warn(
          'No users exist. Set REVEALUI_ADMIN_EMAIL and REVEALUI_ADMIN_PASSWORD environment variables to create initial admin user.',
        )
        return
      }

      // Validate password strength
      if (adminPassword.length < 12) {
        revealui.logger.error(
          'REVEALUI_ADMIN_PASSWORD must be at least 12 characters. Initial admin user not created.',
        )
        return
      }

      try {
        await revealui.create({
          collection: 'users',
          data: {
            name: 'Admin User',
            email: adminEmail,
            password: adminPassword,
            roles: ['user-super-admin'],
          },
        })

        revealui.logger.info(`First admin user created: ${adminEmail}`)
      } catch (error) {
        revealui.logger.error(`Failed to create first admin user: ${error}`)
      }
    }
  },
  // biome-ignore lint/suspicious/noExplicitAny: Type assertion for RevealCollectionConfig compatibility
} as any)
