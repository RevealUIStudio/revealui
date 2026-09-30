import { z } from 'zod';

/** Public inquiry contract shared by browser forms and the delivery endpoint. */
export const ContactInquirySchema = z.object({
  source: z.enum(['agency', 'marketing']).default('marketing'),
  topic: z.string().trim().min(1).max(40),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  email: z.string().trim().email('Enter a valid email address').max(254),
  company: z.string().trim().max(120).optional(),
  message: z.string().trim().min(20, 'Message must be at least 20 characters').max(5000),
  // Filled honeypots reach the endpoint's silent discard instead of leaking a validation error.
  website: z.string().max(5000).optional(),
});

export type ContactInquiry = z.infer<typeof ContactInquirySchema>;
