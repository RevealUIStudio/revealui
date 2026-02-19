import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSharedCMSConfig } from '@revealui/config/revealui'
import type { CollectionConfig, Field } from '@revealui/contracts/cms'
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
import { en } from '@revealui/core/admin/i18n/en'
import sharp from 'sharp'
// Import shared configuration from @revealui/config
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

// import { ChatGPTAssistant } from "reveal";
// import { EmbedFeature } from "@/features/embed/feature.server";

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Calculate project root (always absolute from file location)
// This ensures .revealui/cache/ is always created in the project root,
// regardless of where commands are run from (apps/, apps/cms/, etc.)
const _projectRoot = path.resolve(dirname, '../..')

// Get shared config as fallback for serverURL and secret
const sharedConfig = getSharedCMSConfig()

export default buildConfig({
  serverURL: process.env.REVEALUI_PUBLIC_SERVER_URL || sharedConfig.serverURL,
  secret: process.env.REVEALUI_SECRET || sharedConfig.secret,
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
  db:
    process.env.NODE_ENV === 'test'
      ? universalPostgresAdapter({
          provider: 'electric',
        })
      : process.env.POSTGRES_URL || process.env.DATABASE_URL
        ? universalPostgresAdapter({
            connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
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
      token: process.env.BLOB_READ_WRITE_TOKEN || '',
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
  ] as CollectionConfig<any>[],
  // Programmatically create first user on initialization if none exists
  onInit: async (instance: unknown) => {
    const revealui = instance as RevealUIInstance
    // Skip onInit in test environment to avoid database access before tables exist
    if (process.env.SKIP_ONINIT === 'true' || process.env.NODE_ENV === 'test') {
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
      const adminEmail = process.env.REVEALUI_ADMIN_EMAIL
      const adminPassword = process.env.REVEALUI_ADMIN_PASSWORD

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
})
