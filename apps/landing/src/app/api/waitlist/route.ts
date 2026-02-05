import { type NextRequest, NextResponse } from 'next/server'
import { logger } from '@revealui/core/observability/logger'

// Simple in-memory storage for demo purposes
// In production, this would be stored in a database
const waitlistEmails: string[] = []

function extractEmail(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }

  const { email } = payload as { email?: unknown }
  return typeof email === 'string' ? email : null
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown
    const email = extractEmail(body)

    // Basic email validation
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Check if email already exists
    if (waitlistEmails.includes(email)) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
    }

    // Add email to waitlist
    waitlistEmails.push(email)

    // TODO: Integrate with Resend/ConvertKit for actual email sending
    // const resend = new Resend(process.env.RESEND_API_KEY)
    // await resend.emails.send({
    //   from: 'RevealUI <welcome@revealui.com>',
    //   to: email,
    //   subject: 'Welcome to RevealUI Early Access!',
    //   html: welcomeEmailTemplate,
    // })

    return NextResponse.json({
      success: true,
      message: 'Successfully joined the waitlist!',
    })
  } catch (error) {
    logger.error('Waitlist signup error', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET endpoint to view waitlist (for demo purposes)
export function GET() {
  return NextResponse.json({
    total: waitlistEmails.length,
    emails: waitlistEmails,
  })
}
