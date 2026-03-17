import { NextResponse } from 'next/server';

/** Waitlist closed — redirect to signup. Kept for external link compatibility. */
export function GET() {
  return NextResponse.redirect('https://cms.revealui.com/signup', 301);
}

export function POST() {
  return NextResponse.json(
    { message: 'Waitlist closed. Sign up at https://cms.revealui.com/signup' },
    { status: 410 },
  );
}
