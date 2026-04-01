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

const RATE_LIMIT_WINDOW_MS = 300_000; // 5 minutes
const RATE_LIMIT_MAX = 3;
const recentRequests = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = recentRequests.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) return true;
  recent.push(now);
  recentRequests.set(ip, recent);
  return false;
}

interface ContactBody {
  name?: string;
  email?: string;
  topic?: string;
  message?: string;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { message: 'Too many requests. Please try again in a few minutes.' },
      { status: 429 },
    );
  }

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

  // API down or errored — tell the user so they can retry
  return NextResponse.json(
    { message: 'Our service is temporarily unavailable. Please try again in a few minutes.' },
    { status: 503 },
  );
}
