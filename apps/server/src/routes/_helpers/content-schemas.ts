import { z } from '@revealui/openapi';

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

export const ErrorSchema = z.object({ success: z.literal(false), error: z.string() });

export const ValidationErrorSchema = z.object({
  success: z.literal(false),
  errors: z.array(z.string()).optional(),
});
