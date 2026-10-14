import {
  PAGE_STATUSES,
  POST_STATUSES,
  SITE_STATUSES,
  SITE_VISIBILITIES,
  SiteConsultationBindingSchema,
} from '@revealui/contracts/entities';
import { z } from '@revealui/openapi';
import { asNonEmptyTuple } from '../../lib/type-guards.js';

export const IdParam = z.object({
  id: z.string().openapi({ param: { name: 'id', in: 'path' }, example: 'abc123' }),
});

export const SiteIdParam = z.object({
  siteId: z.string().openapi({ param: { name: 'siteId', in: 'path' }, example: 'site-abc' }),
});

export const SlugParam = z.object({
  slug: z.string().openapi({ param: { name: 'slug', in: 'path' }, example: 'my-post' }),
});

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SlugField = z
  .string()
  .min(1)
  .max(200)
  .regex(SLUG_PATTERN, 'Slug must be lowercase alphanumeric with hyphens only');

/** Ordinary site PATCH and batch updates share the same public mutation fields. */
export const SitePatchSchema = z.strictObject({
  name: z.string().min(1).max(200).optional(),
  slug: SlugField.optional(),
  description: z.string().max(1000).nullable().optional(),
  status: z.enum(asNonEmptyTuple(SITE_STATUSES)).optional(),
  visibility: z.enum(asNonEmptyTuple(SITE_VISIBILITIES)).optional(),
  favicon: z.string().nullable().optional(),
});

export const SiteCreateSchema = z.strictObject({
  name: z.string().min(1).max(200),
  slug: SlugField,
  description: z.string().max(1000).optional(),
  status: z.enum(asNonEmptyTuple(SITE_STATUSES)).optional(),
  visibility: z.enum(asNonEmptyTuple(SITE_VISIBILITIES)).optional(),
  settings: z.strictObject({ consultation: SiteConsultationBindingSchema }).optional(),
});

export const PostCreateSchema = z.strictObject({
  title: z.string().min(1).max(500),
  slug: SlugField,
  excerpt: z.string().max(1000).optional(),
  content: z.unknown().optional(),
  featuredImageId: z.string().optional(),
  authorId: z.string().optional(),
  status: z.enum(asNonEmptyTuple(POST_STATUSES)).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  categories: z.array(z.string()).optional(),
});

export const PostPatchSchema = z.strictObject({
  title: z.string().min(1).max(500).optional(),
  slug: SlugField.optional(),
  excerpt: z.string().max(1000).nullable().optional(),
  content: z.unknown().optional(),
  featuredImageId: z.string().nullable().optional(),
  status: z.enum(asNonEmptyTuple(POST_STATUSES)).optional(),
  published: z.boolean().optional(),
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
  categories: z.array(z.string()).optional(),
  publishedAt: z.string().datetime().nullable().optional(),
});

export const PageCreateSchema = z.strictObject({
  title: z.string().min(1).max(500),
  slug: SlugField,
  path: z.string().min(1).max(500),
  status: z.enum(asNonEmptyTuple(PAGE_STATUSES)).optional(),
  parentId: z.string().optional(),
  templateId: z.string().optional(),
  blocks: z.array(z.unknown()).optional(),
  seo: z.record(z.string(), z.unknown()).optional(),
});

export const PagePatchSchema = z.strictObject({
  title: z.string().min(1).max(500).optional(),
  slug: SlugField.optional(),
  path: z.string().min(1).max(500).optional(),
  status: z.enum(asNonEmptyTuple(PAGE_STATUSES)).optional(),
  parentId: z.string().nullable().optional(),
  templateId: z.string().nullable().optional(),
  blocks: z.array(z.unknown()).optional(),
  seo: z.record(z.string(), z.unknown()).nullable().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
});

export const MediaPatchSchema = z.strictObject({
  alt: z.string().max(500).nullable().optional(),
  focalPoint: z.strictObject({ x: z.number(), y: z.number() }).nullable().optional(),
});

export const ErrorSchema = z.object({ success: z.literal(false), error: z.string() });

export const ValidationErrorSchema = z.object({
  success: z.literal(false),
  errors: z.array(z.string()).optional(),
});
