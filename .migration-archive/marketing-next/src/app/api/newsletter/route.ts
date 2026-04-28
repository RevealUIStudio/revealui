import { NextResponse } from 'next/server';

/** Structural email validation without regex */
function isValidEmail(email: string): boolean {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length > 254 || trimmed.length < 3) return false;
  const atIndex = trimmed.indexOf('@');
  if (atIndex < 1) return false;
  if (trimmed.indexOf('@', atIndex + 1) !== -1) return false;
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  if (!(local && domain)) return false;
  if (!domain.includes('.')) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  if (trimmed.includes(' ')) return false;
  return true;
}

export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 });
  }

  const { email } = body;
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ message: 'Email is required.' }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ message: 'Please enter a valid email address.' }, { status: 400 });
  }

  // Forward to main API if available, otherwise store locally
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com';
  try {
    const res = await fetch(`${apiUrl}/api/newsletter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source: 'marketing-site' }),
    });
    if (res.ok) {
      return NextResponse.json({ message: 'Welcome aboard. Check your inbox for a confirmation.' });
    }
  } catch {
    // API unavailable
  }

  // API down or errored  -  tell the user so they can retry
  return NextResponse.json(
    { message: 'Our service is temporarily unavailable. Please try again in a few minutes.' },
    { status: 503 },
  );
}
