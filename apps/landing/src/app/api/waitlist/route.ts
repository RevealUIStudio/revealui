import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory storage for demo purposes
// In production, this would be stored in a database
const waitlistEmails: string[] = []

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    // Basic email validation
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Check if email already exists
    if (waitlistEmails.includes(email)) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      )
    }

    // Add email to waitlist
    waitlistEmails.push(email)

    // Log for demo purposes (in production, send welcome email via Resend)
    console.log(`New waitlist signup: ${email}`)

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
      message: 'Successfully joined the waitlist!'
    })

  } catch (error) {
    console.error('Waitlist signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to view waitlist (for demo purposes)
export async function GET() {
  return NextResponse.json({
    total: waitlistEmails.length,
    emails: waitlistEmails
  })
}