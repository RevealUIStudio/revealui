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

interface ContactBody {
  name?: string;
  email?: string;
  topic?: string;
  message?: string;
}

export async function POST(request: Request) {
  let body: ContactBody;
  try {
    body = (await request.json()) as ContactBody;
  } catch {
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 });
  }

  const { name, email, topic, message } = body;

  if (!name || typeof name !== 'string' || name.length < 1) {
    return NextResponse.json({ message: 'Name is required.' }, { status: 400 });
  }
  if (!(email && isValidEmail(email))) {
    return NextResponse.json({ message: 'Valid email is required.' }, { status: 400 });
  }
  if (!message || typeof message !== 'string' || message.length < 10) {
    return NextResponse.json(
      { message: 'Message must be at least 10 characters.' },
      { status: 400 },
    );
  }

  // Forward to main API
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com';
  try {
    const res = await fetch(`${apiUrl}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        topic: topic ?? 'general',
        message,
        source: 'marketing-site',
      }),
    });
    if (res.ok) {
      return NextResponse.json({ message: 'Message sent successfully.' });
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
