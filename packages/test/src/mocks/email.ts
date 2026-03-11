/**
 * Email mocks
 *
 * Provides mocks for email sending, templates, and delivery
 */

export interface MockEmail {
  id: string;
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  sentAt: Date;
  delivered: boolean;
}

const mockEmails: MockEmail[] = [];

/**
 * Mock email sending
 */
export function mockSendEmail(options: {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<MockEmail> {
  const email: MockEmail = {
    id: `email_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    to: options.to,
    from: options.from || 'noreply@example.com',
    subject: options.subject,
    html: options.html,
    text: options.text,
    sentAt: new Date(),
    delivered: true,
  };

  mockEmails.push(email);
  return Promise.resolve(email);
}

/**
 * Mock email template rendering
 */
export function mockRenderEmailTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return rendered;
}

/**
 * Get sent emails
 */
export function getMockEmails(): MockEmail[] {
  return [...mockEmails];
}

/**
 * Get emails sent to specific address
 */
export function getMockEmailsTo(to: string): MockEmail[] {
  return mockEmails.filter((email) => email.to === to);
}

/**
 * Clear all mock emails
 */
export function clearMockEmails(): void {
  mockEmails.length = 0;
}

/**
 * Create mock email client
 */
export function createMockEmailClient() {
  return {
    send: mockSendEmail,
    renderTemplate: mockRenderEmailTemplate,
    getEmails: getMockEmails,
    getEmailsTo: getMockEmailsTo,
    clear: clearMockEmails,
  };
}
