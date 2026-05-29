/**
 * Cross-origin fetch helpers for apps/server endpoints used by marketing.
 *
 * URL is resolved from VITE_API_URL at build time. Falls back to
 * api.revealui.com in production builds and localhost:3004 in dev.
 */

const DEFAULT_API_URL = import.meta.env.PROD ? 'https://api.revealui.com' : 'http://localhost:3004';

const API_URL = import.meta.env.VITE_API_URL ?? DEFAULT_API_URL;

export interface ContactPayload {
  name: string;
  email: string;
  topic?: string;
  message: string;
}

export interface NewsletterPayload {
  email: string;
}

export interface WaitlistPayload {
  email: string;
  /**
   * Segmentation key — matches the server's WAITLIST_SOURCES enum.
   * e.g. 'managed-cloud' (RevealUI Cloud waitlist), 'newsletter'.
   */
  source: 'managed-cloud' | 'newsletter' | 'landing-page' | 'blog';
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: unknown;
  publishedAt: string | null;
  createdAt: string;
  author?: string;
  isStatic?: boolean;
}

/**
 * Submit the contact form. Returns null on success; an error message string
 * on validation/server failure.
 */
export async function submitContact(payload: ContactPayload): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, source: 'marketing-site' }),
    });
    if (res.ok) return null;
    // empty-catch-ok: malformed JSON from apps/server shouldn't crash the form; falls back to a generic status-coded message below.
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    return data.message ?? `Submission failed: ${res.status}`;
  } catch {
    return 'Our service is temporarily unavailable. Please try again in a few minutes.';
  }
}

/**
 * Capture an email against a named waitlist source. Returns null on success;
 * an error message string on failure. Backed by apps/server POST /api/waitlist
 * (the `waitlist` table, segmented by `source`).
 */
export async function submitWaitlist(payload: WaitlistPayload): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: payload.email, source: payload.source }),
    });
    if (res.ok) return null;
    // empty-catch-ok: malformed JSON from apps/server shouldn't crash the form; falls back to a generic status-coded message below.
    const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    return data.error ?? data.message ?? `Signup failed: ${res.status}`;
  } catch {
    return 'Our service is temporarily unavailable. Please try again in a few minutes.';
  }
}

/**
 * Subscribe an email to the newsletter. Returns null on success; an error
 * message string on failure.
 *
 * Routes through the source-tagged waitlist endpoint (source: 'newsletter').
 * Prior to this it POSTed to a non-existent /api/newsletter and 404'd;
 * /api/waitlist is the canonical email-capture backend.
 */
export async function submitNewsletter(payload: NewsletterPayload): Promise<string | null> {
  return submitWaitlist({ email: payload.email, source: 'newsletter' });
}

/**
 * Fetch published blog posts from apps/server's content endpoint. Returns the
 * paginated list; static-post merging happens in the caller.
 */
export async function fetchPosts(page = 1, limit = 12): Promise<BlogPost[]> {
  try {
    const offset = (page - 1) * limit;
    const res = await fetch(
      `${API_URL}/api/content/posts?limit=${limit}&offset=${offset}&status=published`,
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { success: boolean; data: BlogPost[] };
    return json.data ?? [];
  } catch {
    return [];
  }
}

/**
 * Fetch a single blog post by slug. Returns null when the post is missing or
 * apps/server is unreachable; the caller can fall back to the static registry.
 */
export async function fetchPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const res = await fetch(`${API_URL}/api/content/posts/slug/${encodeURIComponent(slug)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: BlogPost };
    return json.data ?? null;
  } catch {
    return null;
  }
}
