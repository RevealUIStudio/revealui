/**
 * Site Schema
 *
 * A Site is a project container - it holds pages, assets, and configuration.
 * Sites are the primary unit of ownership and collaboration.
 *
 * Sites support both human management (through UI) and agent management
 * (through structured APIs), enabling true human-AI collaboration.
 */

import { z } from 'zod'
import {
  DualEntitySchema,
  toHumanRepresentation,
  toAgentRepresentation,
  createTimestamps,
  REPRESENTATION_SCHEMA_VERSION,
} from '../representation/index.js'

// =============================================================================
// Schema Version
// =============================================================================

export const SITE_SCHEMA_VERSION = 1

// =============================================================================
// Site Status
// =============================================================================

export const SiteStatusSchema = z.enum([
  'draft', // Not published
  'published', // Live
  'archived', // Soft deleted
  'maintenance', // Temporarily offline
])
export type SiteStatus = z.infer<typeof SiteStatusSchema>

// =============================================================================
// Site Theme
// =============================================================================

export const SiteThemeSchema = z.object({
  /** Primary brand color */
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),

  /** Secondary color */
  secondaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),

  /** Accent color */
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),

  /** Background color */
  backgroundColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),

  /** Text color */
  textColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),

  /** Font family */
  fontFamily: z.string().optional(),

  /** Heading font family */
  headingFontFamily: z.string().optional(),

  /** Border radius preset */
  borderRadius: z.enum(['none', 'sm', 'md', 'lg', 'full']).default('md'),

  /** Color mode */
  mode: z.enum(['light', 'dark', 'auto']).default('auto'),

  /** Custom CSS variables */
  customVariables: z.record(z.string(), z.string()).optional(),
})

export type SiteTheme = z.infer<typeof SiteThemeSchema>

// =============================================================================
// Site SEO
// =============================================================================

export const SiteSeoSchema = z.object({
  /** Default page title */
  title: z.string().max(60).optional(),

  /** Default meta description */
  description: z.string().max(160).optional(),

  /** Default social image */
  image: z.string().url().optional(),

  /** Twitter handle */
  twitterHandle: z.string().optional(),

  /** Facebook App ID */
  facebookAppId: z.string().optional(),

  /** Google site verification */
  googleSiteVerification: z.string().optional(),

  /** Robots directive */
  robots: z.string().optional(),
})

export type SiteSeo = z.infer<typeof SiteSeoSchema>

// =============================================================================
// Site Settings
// =============================================================================

export const SiteSettingsSchema = z.object({
  /** Custom domain */
  domain: z.string().optional(),

  /** Subdomain on RevealUI */
  subdomain: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),

  /** Default language */
  language: z.string().default('en'),

  /** Supported languages */
  supportedLanguages: z.array(z.string()).optional(),

  /** Timezone */
  timezone: z.string().default('UTC'),

  /** SEO defaults */
  seo: SiteSeoSchema.optional(),

  /** Analytics tracking ID */
  analyticsId: z.string().optional(),

  /** Whether to allow AI agents to modify this site */
  allowAgentEdits: z.boolean().default(true),

  /** Agent edit restrictions */
  agentRestrictions: z
    .object({
      /** Can agents publish? */
      canPublish: z.boolean().default(false),
      /** Can agents delete pages? */
      canDeletePages: z.boolean().default(false),
      /** Can agents modify settings? */
      canModifySettings: z.boolean().default(false),
      /** Pages agents cannot edit */
      protectedPages: z.array(z.string()).optional(),
    })
    .optional(),

  /** Custom 404 page ID */
  notFoundPageId: z.string().optional(),

  /** Favicon URL */
  faviconUrl: z.string().url().optional(),

  /** Social links */
  socialLinks: z
    .array(
      z.object({
        platform: z.string(),
        url: z.string().url(),
      })
    )
    .optional(),
})

export type SiteSettings = z.infer<typeof SiteSettingsSchema>

// =============================================================================
// Site Collaborator
// =============================================================================

export const SiteCollaboratorSchema = z.object({
  userId: z.string(),
  role: z.enum(['admin', 'editor', 'viewer']),
  addedAt: z.string().datetime(),
  addedBy: z.string(),
})

export type SiteCollaborator = z.infer<typeof SiteCollaboratorSchema>

// =============================================================================
// Site Schema
// =============================================================================

export const SiteSchema = DualEntitySchema.extend({
  /** Schema version for migrations */
  schemaVersion: z.number().int().default(SITE_SCHEMA_VERSION),

  /** Site name */
  name: z.string().min(1).max(100),

  /** URL-safe slug */
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .min(1)
    .max(50),

  /** Site description */
  description: z.string().max(500).optional(),

  /** Owner user ID */
  ownerId: z.string(),

  /** Current status */
  status: SiteStatusSchema,

  /** Site settings */
  settings: SiteSettingsSchema,

  /** Collaborator user IDs with their roles */
  collaborators: z.array(SiteCollaboratorSchema).default([]),

  /** Template this site was created from (if any) */
  templateId: z.string().optional(),

  /** Style/theme configuration (human-adjustable) */
  theme: SiteThemeSchema.optional(),

  /** Page count (denormalized for quick access) */
  pageCount: z.number().int().nonnegative().default(0),

  /** Last published timestamp */
  publishedAt: z.string().datetime().optional(),
})

export type Site = z.infer<typeof SiteSchema>

// =============================================================================
// Site Creation
// =============================================================================

export const CreateSiteInputSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .min(1)
    .max(50),
  description: z.string().max(500).optional(),
  ownerId: z.string(),
  templateId: z.string().optional(),
  settings: SiteSettingsSchema.partial().optional(),
  theme: SiteThemeSchema.optional(),
})

export type CreateSiteInput = z.infer<typeof CreateSiteInputSchema>

/**
 * Creates a new site with dual representation
 */
export function createSite(id: string, input: CreateSiteInput): Site {
  const timestamps = createTimestamps()

  const settings: SiteSettings = {
    language: 'en',
    timezone: 'UTC',
    allowAgentEdits: true,
    ...input.settings,
  }

  return {
    id,
    version: REPRESENTATION_SCHEMA_VERSION,
    schemaVersion: SITE_SCHEMA_VERSION,
    name: input.name,
    slug: input.slug,
    description: input.description,
    ownerId: input.ownerId,
    status: 'draft',
    settings,
    templateId: input.templateId,
    theme: input.theme,
    collaborators: [],
    pageCount: 0,
    human: toHumanRepresentation({
      name: input.name,
      description: input.description,
      icon: 'globe',
    }),
    agent: toAgentRepresentation('site', {
      actions: [
        {
          name: 'addPage',
          description: 'Add a new page to this site',
          params: {
            title: { type: 'string', required: true, description: 'Page title' },
            slug: { type: 'string', required: true, description: 'URL slug' },
            templateId: { type: 'string', required: false, description: 'Template to use' },
          },
        },
        {
          name: 'updateSettings',
          description: 'Update site settings',
          params: {
            settings: { type: 'object', required: true, description: 'Partial settings to update' },
          },
        },
        {
          name: 'updateTheme',
          description: 'Update site theme/styling',
          params: {
            theme: { type: 'object', required: true, description: 'Theme settings' },
          },
        },
        {
          name: 'publish',
          description: 'Publish the site to make it live',
          params: {},
          requiredCapabilities: ['publish'],
          sideEffects: ['Site becomes publicly accessible'],
        },
        {
          name: 'unpublish',
          description: 'Take the site offline',
          params: {},
          requiredCapabilities: ['publish'],
          sideEffects: ['Site becomes inaccessible'],
        },
      ],
      constraints: settings.allowAgentEdits
        ? []
        : [
            {
              type: 'readonly',
              params: {},
              message: 'Agent edits are disabled for this site',
            },
          ],
      metadata: {
        status: 'draft',
        hasTemplate: !!input.templateId,
        language: settings.language,
      },
      keywords: [input.name.toLowerCase(), input.slug, 'site', 'website'],
    }),
    ...timestamps,
  }
}

// =============================================================================
// Site Update
// =============================================================================

export const UpdateSiteInputSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: SiteStatusSchema.optional(),
  settings: SiteSettingsSchema.partial().optional(),
  theme: SiteThemeSchema.partial().optional(),
})

export type UpdateSiteInput = z.infer<typeof UpdateSiteInputSchema>

// =============================================================================
// Site Utilities
// =============================================================================

/**
 * Checks if a user has permission to perform an action on a site
 */
export function canUserPerformAction(
  site: Site,
  userId: string,
  action: 'view' | 'edit' | 'admin' | 'delete'
): boolean {
  // Owner can do everything
  if (site.ownerId === userId) return true

  const collaborator = site.collaborators.find((c) => c.userId === userId)
  if (!collaborator) return false

  switch (action) {
    case 'view':
      return true
    case 'edit':
      return collaborator.role === 'editor' || collaborator.role === 'admin'
    case 'admin':
    case 'delete':
      return collaborator.role === 'admin'
    default:
      return false
  }
}

/**
 * Checks if an agent can edit this site
 */
export function canAgentEditSite(site: Site): boolean {
  return site.settings.allowAgentEdits
}
