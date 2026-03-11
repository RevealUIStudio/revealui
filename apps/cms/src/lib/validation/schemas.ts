import { z } from 'zod/v4';

/**
 * Form validation schemas
 * These schemas validate user input for form submissions and API endpoints
 */

// Re-export password schema from shared utils
export { passwordSchema } from '@revealui/utils/validation';

// Email validation schema with proper email format
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email format')
  .max(255, 'Email is too long');

// Form submission schema
export const formSubmissionSchema = z.object({
  form: z.string().min(1, 'Form ID is required'),
  submissionData: z.array(
    z.object({
      field: z.string().min(1, 'Field name is required'),
      value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]),
    }),
  ),
});

// Text field validation
export const textFieldSchema = z
  .string()
  .min(1, 'This field is required')
  .max(1000, 'Text is too long')
  .transform((val) => val.trim());

// Textarea field validation
export const textareaFieldSchema = z
  .string()
  .min(1, 'This field is required')
  .max(5000, 'Text is too long')
  .transform((val) => val.trim());

// Number field validation
export const numberFieldSchema = z
  .number()
  .or(z.string().regex(/^\d+$/).transform(Number))
  .pipe(z.number().min(0).max(Number.MAX_SAFE_INTEGER));

// URL validation
export const urlSchema = z.string().url('Invalid URL format').max(2048, 'URL is too long');

// Slug validation
export const slugSchema = z
  .string()
  .min(1, 'Slug is required')
  .max(150, 'Slug is too long')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens');

// Webhook signature validation
export const webhookSignatureSchema = z.object({
  signature: z.string().min(1, 'Signature is required'),
  payload: z.string().min(1, 'Payload is required'),
});

// Stripe webhook event validation
export const stripeWebhookSchema = z.object({
  id: z.string(),
  object: z.literal('event'),
  type: z.string(),
  data: z.object({
    object: z.record(z.string(), z.unknown()),
  }),
});

// Tenant ID validation
export const tenantIdSchema = z.string().min(1, 'Tenant ID is required');

// User role validation
export const userRoleSchema = z.enum([
  'user-super-admin',
  'user-admin',
  'tenant-super-admin',
  'tenant-admin',
]);

// Pagination validation
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
});

/**
 * Validation utility functions
 */

export function validateFormData<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error };
}

export function getValidationErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.');
    errors[path] = issue.message;
  }

  return errors;
}
