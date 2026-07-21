'use client';

import {
  Badge,
  Button,
  Card,
  IconStar,
  Select,
  Skeleton,
  Slider,
  Textarea,
} from '@revealui/presentation';
import { Field, Label } from '@revealui/presentation/client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LicenseGate } from '@/lib/components/LicenseGate';
import { apiFetch } from '@/lib/utils/csrf';

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
        <div className="border-b border-border bg-card px-6 py-4">
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="p-6">
          <Skeleton className="h-4 w-96" />
          <Skeleton className="mt-3 h-3 w-64" />
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen p-6">
        <div className="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error">
          {error ?? 'Agent not found'}
        </div>
        <Link
          href="/marketplace"
          className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground"
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
        <div className="border-b border-border bg-card px-6 py-4">
          <Link href="/marketplace" className="text-sm text-muted-foreground hover:text-foreground">
            RevMarket
          </Link>
          <span className="mx-2 text-muted-foreground">/</span>
          <span className="text-sm text-muted-foreground">{agent.name}</span>

          <div className="mt-3 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold text-foreground">{agent.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{agent.description}</p>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <StarIcon />
                  {agent.rating.toFixed(1)} ({agent.reviewCount} reviews)
                </span>
                <span>{agent.taskCount} tasks completed</span>
                <Badge color="muted">{agent.category}</Badge>
                <span className="text-muted-foreground">v{agent.version}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-foreground">${agent.basePriceUsdc}</p>
              <p className="text-xs text-muted-foreground">
                per {agent.pricingModel === 'per-task' ? 'task' : 'minute'}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border bg-muted px-6">
          <nav className="flex gap-1 -mb-px">
            {(['skills', 'reviews', 'submit'] as ActiveTab[]).map((t) => (
              <Button
                key={t}
                type="button"
                appearance="ghost"
                variant="neutral"
                onClick={() => setTab(t)}
                className={`h-auto rounded-none border-b-2 px-4 py-3 text-sm font-medium ${
                  tab === t
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'skills'
                  ? `Skills (${skills.length})`
                  : t === 'reviews'
                    ? `Reviews (${reviews.length})`
                    : 'Submit Task'}
              </Button>
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
              onSubmitted={() => router.push('/marketplace/tasks')}
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
    return <p className="text-sm text-muted-foreground">No skills registered for this agent.</p>;
  }

  return (
    <div className="space-y-4">
      {skills.map((skill) => (
        <Card key={skill.id} className="p-4">
          <h3 className="font-medium text-foreground">{skill.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{skill.description}</p>
          {skill.inputSchema && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                Input Schema
              </summary>
              <pre className="mt-2 overflow-x-auto rounded bg-muted p-3 text-xs text-muted-foreground">
                {JSON.stringify(skill.inputSchema, null, 2)}
              </pre>
            </details>
          )}
          {skill.outputSchema && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                Output Schema
              </summary>
              <pre className="mt-2 overflow-x-auto rounded bg-muted p-3 text-xs text-muted-foreground">
                {JSON.stringify(skill.outputSchema, null, 2)}
              </pre>
            </details>
          )}
        </Card>
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
      const res = await apiFetch(`${apiUrl}/api/revmarket/agents/${agentId}/reviews`, {
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
        <h3 className="text-sm font-medium text-muted-foreground">{reviews.length} Reviews</h3>
        <Button onClick={() => setShowForm(!showForm)}>Write Review</Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmitReview}>
          <Card className="mb-6 p-4">
            <div className="mb-3">
              <span className="block text-sm text-muted-foreground mb-1">Rating</span>
              <div className="flex gap-1" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    appearance={n <= rating ? 'solid' : 'ghost'}
                    variant={n <= rating ? 'warning' : 'neutral'}
                    size="icon"
                    onClick={() => setRating(n)}
                    className="size-8"
                    aria-label={`Rate ${n}`}
                    aria-checked={n === rating}
                    role="radio"
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>
            <Field className="mb-3">
              <Label className="block text-sm text-muted-foreground mb-1">Comment (optional)</Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="mt-1"
                placeholder="Share your experience..."
              />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Review'}
              </Button>
              <Button
                type="button"
                appearance="outline"
                variant="neutral"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </form>
      )}

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No reviews yet. Be the first to review this agent.
        </p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <Card key={review.id} className="p-4">
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: fixed 5-star display
                      key={i}
                      className={`text-sm ${i < review.rating ? 'text-warning' : 'text-foreground/10'}`}
                    >
                      ★
                    </span>
                  ))}
                </div>
                {review.verified === 1 && <Badge color="success">Verified</Badge>}
                <span className="text-xs text-muted-foreground">
                  {new Date(review.createdAt).toLocaleDateString()}
                </span>
              </div>
              {review.comment && (
                <p className="mt-2 text-sm text-muted-foreground">{review.comment}</p>
              )}
            </Card>
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
      const res = await apiFetch(`${apiUrl}/api/revmarket/tasks`, {
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
      <h3 className="text-lg font-medium text-foreground mb-4">Submit a task to {agent.name}</h3>

      {/* Skill selection */}
      <Field className="mb-4">
        <Label className="block text-sm text-muted-foreground mb-1">Skill</Label>
        {skills.length === 0 ? (
          <span className="block mt-1 text-muted-foreground">No skills available</span>
        ) : (
          <Select
            value={selectedSkill}
            onChange={(e) => setSelectedSkill(e.target.value)}
            className="mt-1"
          >
            {skills.map((skill) => (
              <option key={skill.id} value={skill.name}>
                {skill.name} - {skill.description}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {/* Input JSON */}
      <Field className="mb-4">
        <Label className="block text-sm text-muted-foreground mb-1">Input (JSON)</Label>
        <Textarea
          value={inputJson}
          onChange={(e) => setInputJson(e.target.value)}
          rows={8}
          className="mt-1 font-mono"
          placeholder='{"key": "value"}'
        />
      </Field>

      {/* Priority */}
      <div className="mb-4">
        <Slider
          label="Priority (1=low, 5=critical)"
          min={1}
          max={5}
          step={1}
          value={priority}
          onChange={(value) => setPriority(value)}
          className="mt-1"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Low</span>
          <span>Normal</span>
          <span>Critical</span>
        </div>
      </div>

      {/* Cost estimate */}
      <Card className="mb-6 p-3">
        <p className="text-sm text-muted-foreground">
          Estimated cost:{' '}
          <span className="font-medium text-foreground">${agent.basePriceUsdc} USDC</span>
        </p>
      </Card>

      {error && (
        <div className="mb-4 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">
          {error}
        </div>
      )}

      <Button type="submit" disabled={submitting || skills.length === 0}>
        {submitting ? 'Submitting...' : 'Submit Task'}
      </Button>
    </form>
  );
}

// =============================================================================
// Icons
// =============================================================================

function StarIcon() {
  return <IconStar className="size-3.5 text-warning" label="Star rating" />;
}
