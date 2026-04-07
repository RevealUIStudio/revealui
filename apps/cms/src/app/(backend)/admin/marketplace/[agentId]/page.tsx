'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LicenseGate } from '@/lib/components/LicenseGate';

// =============================================================================
// Types
// =============================================================================

interface AgentDetail {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  rating: number;
  reviewCount: number;
  taskCount: number;
  basePriceUsdc: string;
  pricingModel: string;
  version: string;
  publisherId: string;
  maxExecutionSecs: number;
  definition: Record<string, unknown>;
}

interface AgentSkill {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
}

interface AgentReview {
  id: string;
  rating: number;
  comment: string | null;
  verified: number;
  createdAt: string;
}

type ActiveTab = 'skills' | 'reviews' | 'submit';

// =============================================================================
// Agent Detail Page
// =============================================================================

export default function MarketplaceAgentDetailPage() {
  const params = useParams<{ agentId: string }>();
  const router = useRouter();
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [reviews, setReviews] = useState<AgentReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ActiveTab>('skills');

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com').trim();

  useEffect(() => {
    if (!params.agentId) return;

    setLoading(true);
    Promise.all([
      fetch(`${apiUrl}/api/revmarket/agents/${params.agentId}`, { credentials: 'include' }).then(
        (r) => {
          if (!r.ok) throw new Error(`Agent not found (${r.status})`);
          return r.json();
        },
      ),
      fetch(`${apiUrl}/api/revmarket/agents/${params.agentId}/reviews`, {
        credentials: 'include',
      }).then((r) => r.json()),
    ])
      .then(([agentData, reviewData]) => {
        setAgent(agentData.agent);
        setSkills(agentData.skills ?? []);
        setReviews(reviewData.reviews ?? []);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [apiUrl, params.agentId]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
          <div className="h-5 w-48 animate-pulse rounded bg-zinc-800" />
        </div>
        <div className="p-6">
          <div className="h-4 w-96 animate-pulse rounded bg-zinc-800" />
          <div className="mt-3 h-3 w-64 animate-pulse rounded bg-zinc-800" />
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen p-6">
        <div className="rounded-lg border border-red-900 bg-red-950/50 p-4 text-sm text-red-400">
          {error ?? 'Agent not found'}
        </div>
        <Link
          href="/admin/marketplace"
          className="mt-4 inline-block text-sm text-zinc-400 hover:text-white"
        >
          Back to marketplace
        </Link>
      </div>
    );
  }

  return (
    <LicenseGate feature="ai">
      <div className="min-h-screen">
        {/* Breadcrumb + Header */}
        <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
          <Link href="/admin/marketplace" className="text-sm text-zinc-500 hover:text-zinc-300">
            RevMarket
          </Link>
          <span className="mx-2 text-zinc-700">/</span>
          <span className="text-sm text-zinc-300">{agent.name}</span>

          <div className="mt-3 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold text-white">{agent.name}</h1>
              <p className="mt-1 text-sm text-zinc-400">{agent.description}</p>
              <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <StarIcon />
                  {agent.rating.toFixed(1)} ({agent.reviewCount} reviews)
                </span>
                <span>{agent.taskCount} tasks completed</span>
                <span className="rounded bg-zinc-800 px-2 py-0.5">{agent.category}</span>
                <span className="text-zinc-600">v{agent.version}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-white">${agent.basePriceUsdc}</p>
              <p className="text-xs text-zinc-500">
                per {agent.pricingModel === 'per-task' ? 'task' : 'minute'}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-zinc-800 bg-zinc-950 px-6">
          <nav className="flex gap-1 -mb-px">
            {(['skills', 'reviews', 'submit'] as ActiveTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  tab === t
                    ? 'border-white text-white'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {t === 'skills'
                  ? `Skills (${skills.length})`
                  : t === 'reviews'
                    ? `Reviews (${reviews.length})`
                    : 'Submit Task'}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        <div className="p-6">
          {tab === 'skills' && <SkillsPanel skills={skills} />}
          {tab === 'reviews' && (
            <ReviewsPanel
              reviews={reviews}
              agentId={agent.id}
              apiUrl={apiUrl}
              onReviewAdded={(review) => setReviews((prev) => [review, ...prev])}
            />
          )}
          {tab === 'submit' && (
            <SubmitTaskPanel
              agent={agent}
              skills={skills}
              apiUrl={apiUrl}
              onSubmitted={() => router.push('/admin/marketplace/tasks')}
            />
          )}
        </div>
      </div>
    </LicenseGate>
  );
}

// =============================================================================
// Skills Panel
// =============================================================================

function SkillsPanel({ skills }: { skills: AgentSkill[] }) {
  if (skills.length === 0) {
    return <p className="text-sm text-zinc-500">No skills registered for this agent.</p>;
  }

  return (
    <div className="space-y-4">
      {skills.map((skill) => (
        <div key={skill.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="font-medium text-white">{skill.name}</h3>
          <p className="mt-1 text-sm text-zinc-400">{skill.description}</p>
          {skill.inputSchema && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">
                Input Schema
              </summary>
              <pre className="mt-2 overflow-x-auto rounded bg-zinc-950 p-3 text-xs text-zinc-400">
                {JSON.stringify(skill.inputSchema, null, 2)}
              </pre>
            </details>
          )}
          {skill.outputSchema && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">
                Output Schema
              </summary>
              <pre className="mt-2 overflow-x-auto rounded bg-zinc-950 p-3 text-xs text-zinc-400">
                {JSON.stringify(skill.outputSchema, null, 2)}
              </pre>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Reviews Panel
// =============================================================================

function ReviewsPanel({
  reviews,
  agentId,
  apiUrl,
  onReviewAdded,
}: {
  reviews: AgentReview[];
  agentId: string;
  apiUrl: string;
  onReviewAdded: (review: AgentReview) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch(`${apiUrl}/api/revmarket/agents/${agentId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rating, comment: comment || undefined }),
      });

      if (!res.ok) throw new Error(`Failed to submit review (${res.status})`);

      const data = (await res.json()) as { review: AgentReview };
      onReviewAdded(data.review);
      setShowForm(false);
      setComment('');
      setRating(5);
    } catch {
      // Error is visible from the failed state
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-300">{reviews.length} Reviews</h3>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 transition-colors"
        >
          Write Review
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmitReview}
          className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900 p-4"
        >
          <div className="mb-3">
            <span className="block text-sm text-zinc-400 mb-1">Rating</span>
            <div className="flex gap-1" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`h-8 w-8 rounded transition-colors ${
                    n <= rating ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-600'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-sm text-zinc-400 mb-1">
              Comment (optional)
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                placeholder="Share your experience..."
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {reviews.length === 0 ? (
        <p className="text-sm text-zinc-500">No reviews yet. Be the first to review this agent.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: fixed 5-star display
                      key={i}
                      className={`text-sm ${i < review.rating ? 'text-amber-500' : 'text-zinc-700'}`}
                    >
                      ★
                    </span>
                  ))}
                </div>
                {review.verified === 1 && (
                  <span className="rounded bg-green-900/50 px-2 py-0.5 text-xs text-green-400">
                    Verified
                  </span>
                )}
                <span className="text-xs text-zinc-600">
                  {new Date(review.createdAt).toLocaleDateString()}
                </span>
              </div>
              {review.comment && <p className="mt-2 text-sm text-zinc-400">{review.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Submit Task Panel
// =============================================================================

function SubmitTaskPanel({
  agent,
  skills,
  apiUrl,
  onSubmitted,
}: {
  agent: AgentDetail;
  skills: AgentSkill[];
  apiUrl: string;
  onSubmitted: () => void;
}) {
  const [selectedSkill, setSelectedSkill] = useState(skills[0]?.name ?? '');
  const [inputJson, setInputJson] = useState('{}');
  const [priority, setPriority] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    let input: Record<string, unknown>;
    try {
      input = JSON.parse(inputJson) as Record<string, unknown>;
    } catch {
      setError('Invalid JSON input');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/api/revmarket/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          agentId: agent.id,
          skillName: selectedSkill,
          input,
          priority,
        }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit task');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl">
      <h3 className="text-lg font-medium text-white mb-4">Submit a task to {agent.name}</h3>

      {/* Skill selection */}
      <div className="mb-4">
        {/* biome-ignore lint/a11y/noLabelWithoutControl: select is inside the conditional branch */}
        <label className="block text-sm text-zinc-400 mb-1">
          Skill
          {skills.length === 0 ? (
            <span className="block mt-1 text-zinc-500">No skills available</span>
          ) : (
            <select
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none"
            >
              {skills.map((skill) => (
                <option key={skill.id} value={skill.name}>
                  {skill.name} — {skill.description}
                </option>
              ))}
            </select>
          )}
        </label>
      </div>

      {/* Input JSON */}
      <div className="mb-4">
        <label className="block text-sm text-zinc-400 mb-1">
          Input (JSON)
          <textarea
            value={inputJson}
            onChange={(e) => setInputJson(e.target.value)}
            rows={8}
            className="mt-1 w-full font-mono rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            placeholder='{"key": "value"}'
          />
        </label>
      </div>

      {/* Priority */}
      <div className="mb-4">
        <label className="block text-sm text-zinc-400 mb-1">
          Priority (1=low, 5=critical)
          <input
            type="range"
            min={1}
            max={5}
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="mt-1 w-full"
          />
        </label>
        <div className="flex justify-between text-xs text-zinc-600">
          <span>Low</span>
          <span>Normal</span>
          <span>Critical</span>
        </div>
      </div>

      {/* Cost estimate */}
      <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
        <p className="text-sm text-zinc-400">
          Estimated cost:{' '}
          <span className="font-medium text-white">${agent.basePriceUsdc} USDC</span>
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || skills.length === 0}
        className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {submitting ? 'Submitting...' : 'Submit Task'}
      </button>
    </form>
  );
}

// =============================================================================
// Icons
// =============================================================================

function StarIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 fill-amber-500"
      viewBox="0 0 20 20"
      role="img"
      aria-label="Star rating"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}
