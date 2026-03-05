/**
 * Email Service
 *
 * Sends emails using configured email provider.
 * Supports Resend or SMTP (via nodemailer).
 *
 * Installation:
 * - For Resend: Set RESEND_API_KEY
 * - For SMTP: Set SMTP_* variables and install: pnpm add nodemailer @types/nodemailer
 */

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

interface EmailProvider {
  send(options: EmailOptions): Promise<{ success: boolean; error?: string }>
}

/**
 * Resend Email Provider
 */
class ResendProvider implements EmailProvider {
  private apiKey: string
  private fromEmail: string

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY || ''
    this.fromEmail =
      process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@example.com'
  }

  async send(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    if (!this.apiKey) {
      return { success: false, error: 'RESEND_API_KEY not configured' }
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          // biome-ignore lint/style/useNamingConvention: Authorization is a standard HTTP header name (PascalCase)
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        return { success: false, error: `Resend API error: ${error}` }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}

/**
 * SMTP Email Provider
 *
 * Uses nodemailer for SMTP email sending.
 * Install nodemailer: pnpm add nodemailer @types/nodemailer
 */
class SMTPProvider implements EmailProvider {
  private config: {
    host: string
    port: number
    secure: boolean
    auth: {
      user: string
      pass: string
    }
  }
  private fromEmail: string

  constructor() {
    this.config = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    }
    this.fromEmail = process.env.EMAIL_FROM || this.config.auth.user
  }

  async send(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    // Import nodemailer
    let createTransport: typeof import('nodemailer').createTransport
    try {
      const nodemailerModule = await import('nodemailer')
      createTransport = nodemailerModule.createTransport
    } catch (_error) {
      return {
        success: false,
        error: 'nodemailer not installed. Run: pnpm add nodemailer @types/nodemailer',
      }
    }

    // Validate configuration
    if (!(this.config.auth.user && this.config.auth.pass)) {
      return {
        success: false,
        error: 'SMTP_USER and SMTP_PASS must be configured',
      }
    }

    try {
      // Create transporter
      const transporter = createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          user: this.config.auth.user,
          pass: this.config.auth.pass,
        },
      })

      // Send email
      await transporter.sendMail({
        from: this.fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      })

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown SMTP error',
      }
    }
  }
}

/**
 * Mock Email Provider (for testing/development)
 */
class MockEmailProvider implements EmailProvider {
  async send(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    // Only log in development mode
    if (process.env.NODE_ENV === 'development') {
      // Use dynamic import to avoid circular dependencies
      import('@revealui/core/utils/logger')
        .then(({ logger }) => {
          logger.debug('Mock email sent', {
            to: options.to,
            subject: options.subject,
          })
        })
        .catch(() => {
          // Logger not available, skip logging
          // (Previously fell back to console, but we've removed all console.* usage)
        })
    }
    return { success: true }
  }
}

/**
 * Get configured email provider
 */
function getEmailProvider(): EmailProvider {
  // Prefer Resend if configured
  if (process.env.RESEND_API_KEY) {
    return new ResendProvider()
  }

  // Fall back to SMTP if configured
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return new SMTPProvider()
  }

  // Use mock in development, fail in production
  if (process.env.NODE_ENV === 'development') {
    // Lazy import to avoid circular dependencies
    import('@revealui/core/utils/logger').then(({ logger }) => {
      logger.warn('No email provider configured. Using mock provider.')
    })
    return new MockEmailProvider()
  }

  // In production, throw error if not configured
  throw new Error(
    'Email provider not configured. Set RESEND_API_KEY or SMTP_* environment variables.',
  )
}

/**
 * Send an email with automatic retry for transient failures.
 *
 * Retries up to `maxRetries` times with exponential backoff (200ms, 400ms, 800ms).
 * Only retries on errors that look transient (network, 5xx). Validation / auth
 * errors fail immediately.
 */
export async function sendEmail(
  options: EmailOptions,
  { maxRetries = 2 }: { maxRetries?: number } = {},
): Promise<{ success: boolean; error?: string }> {
  const provider = getEmailProvider()

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await provider.send(options)

      if (result.success) return result

      // Don't retry auth/config errors
      if (result.error && /not configured|not installed|unauthorized/i.test(result.error)) {
        return result
      }

      // Last attempt — return whatever we got
      if (attempt === maxRetries) return result

      // Exponential backoff before retrying
      await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** attempt))
    } catch (error) {
      if (attempt === maxRetries) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** attempt))
    }
  }

  return { success: false, error: 'Max retries exceeded' }
}

/**
 * Send password reset email
 *
 * @param email - User email
 * @param resetToken - Password reset token
 * @param resetUrl - Full reset URL (optional, will construct if not provided)
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  resetUrl?: string,
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || process.env.REVEALUI_PUBLIC_SERVER_URL
  if (!baseUrl) {
    return {
      success: false,
      error: 'NEXT_PUBLIC_SERVER_URL or REVEALUI_PUBLIC_SERVER_URL is not set',
    }
  }
  const finalResetUrl = resetUrl || `${baseUrl}/reset-password?token=${resetToken}`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb;">Reset Your Password</h1>
        <p>You requested to reset your password. Click the button below to reset it:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${finalResetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Reset Password
          </a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${finalResetUrl}</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
      </body>
    </html>
  `

  const text = `
Reset Your Password

You requested to reset your password. Click the link below to reset it:

${finalResetUrl}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
  `.trim()

  return sendEmail({
    to: email,
    subject: 'Reset Your Password',
    html,
    text,
  })
}
