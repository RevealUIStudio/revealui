'use client';

import { Breadcrumb } from '@revealui/presentation/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useReducer } from 'react';
import { LicenseGate } from '@/lib/components/LicenseGate';

// =============================================================================
// Template definitions
// =============================================================================

type TemplateKey = 'content' | 'code' | 'support' | 'analytics';

interface AgentTemplate {
  key: TemplateKey;
  label: string;
  description: string;
  capabilities: string[];
  model: string;
  temperature: number;
  maxTokens: number;
  systemPromptFn: (name: string) => string;
}

const TEMPLATES: AgentTemplate[] = [
  {
    key: 'content',
    label: 'Content Writer',
    description: 'Creates blog posts, landing pages, product descriptions, and marketing copy.',
    capabilities: ['content-generation', 'seo', 'copywriting'],
    model: 'claude-sonnet-4-6',
    temperature: 0.8,
    maxTokens: 4096,
    systemPromptFn: (name) =>
      `You are ${name}, a professional content writer. You create engaging, SEO-optimized content including blog posts, landing pages, product descriptions, and marketing copy. You understand tone, audience, and brand voice. Always ask for target audience and tone before writing.`,
  },
  {
    key: 'code',
    label: 'Code Assistant',
    description:
      'Reviews TypeScript/React code, generates implementations, fixes bugs, and enforces coding conventions.',
    capabilities: ['code-review', 'code-generation', 'debugging', 'refactoring'],
    model: 'claude-sonnet-4-6',
    temperature: 0.2,
    maxTokens: 8192,
    systemPromptFn: (name) =>
      `You are ${name}, a senior TypeScript and React engineer. You write clean, type-safe code, review pull requests, debug complex issues, and follow RevealUI coding conventions (Biome, strict mode, ES Modules, no any types). Always prefer functional components with hooks and explain your reasoning.`,
  },
  {
    key: 'support',
    label: 'Support Agent',
    description:
      'Triages support tickets, answers common questions, and escalates complex issues to the team.',
    capabilities: ['ticket-management', 'search', 'escalation', 'customer-support'],
    model: 'claude-haiku-4-5-20251001',
    temperature: 0.3,
    maxTokens: 2048,
    systemPromptFn: (name) =>
      `You are ${name}, a helpful support specialist. You triage incoming support requests, answer questions using the knowledge base, and escalate complex technical issues to the engineering team. Always acknowledge the user's frustration, provide clear steps, and confirm resolution before closing.`,
  },
  {
    key: 'analytics',
    label: 'Data Analyst',
    description:
      'Queries application metrics, identifies trends, and generates actionable reports for the team.',
    capabilities: ['data-analysis', 'reporting', 'metrics', 'visualization'],
    model: 'claude-sonnet-4-6',
    temperature: 0.3,
    maxTokens: 4096,
    systemPromptFn: (name) =>
      `You are ${name}, a data analyst. You query application metrics, identify trends, generate clear reports, and surface actionable insights for product and engineering teams. Always present data with context, highlight anomalies, and suggest next steps based on the findings.`,
  },
];

// =============================================================================
// State management
// =============================================================================

interface FormState {
  selectedTemplate: TemplateKey | null;
  name: string;
  description: string;
  systemPrompt: string;
  submitting: boolean;
  error: string | null;
}

type FormAction =
  | { type: 'APPLY_TEMPLATE'; key: TemplateKey; prompt: string }
  | { type: 'SET_NAME'; value: string; prompt: string }
  | { type: 'SET_DESCRIPTION'; value: string }
  | { type: 'SET_SYSTEM_PROMPT'; value: string }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_ERROR'; error: string }
  | { type: 'SUBMIT_END' };

const initialState: FormState = {
  selectedTemplate: null,
  name: '',
  description: '',
  systemPrompt: '',
  submitting: false,
  error: null,
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'APPLY_TEMPLATE':
      return { ...state, selectedTemplate: action.key, systemPrompt: action.prompt };
    case 'SET_NAME':
      return { ...state, name: action.value, systemPrompt: action.prompt };
    case 'SET_DESCRIPTION':
      return { ...state, description: action.value };
    case 'SET_SYSTEM_PROMPT':
      return { ...state, systemPrompt: action.value };
    case 'SUBMIT_START':
      return { ...state, submitting: true, error: null };
    case 'SUBMIT_ERROR':
      return { ...state, submitting: false, error: action.error };
    case 'SUBMIT_END':
      return { ...state, submitting: false };
  }
}

// =============================================================================
// Page
// =============================================================================

export default function NewAgentPage() {
  const router = useRouter();
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com').trim();

  const [state, dispatch] = useReducer(formReducer, initialState);
  const { selectedTemplate, name, description, systemPrompt, submitting, error } = state;

  function applyTemplate(key: TemplateKey) {
    const tpl = TEMPLATES.find((t) => t.key === key);
    if (!tpl) return;
    const shouldUpdatePrompt =
      !systemPrompt.trim() ||
      (selectedTemplate && systemPrompt === getSystemPromptForTemplate(selectedTemplate, name));
    dispatch({
      type: 'APPLY_TEMPLATE',
      key,
      prompt: shouldUpdatePrompt ? tpl.systemPromptFn(name || tpl.label) : systemPrompt,
    });
  }

  function getSystemPromptForTemplate(key: TemplateKey, agentName: string): string {
    const tpl = TEMPLATES.find((t) => t.key === key);
    return tpl ? tpl.systemPromptFn(agentName || tpl.label) : '';
  }

  function handleNameChange(val: string) {
    dispatch({
      type: 'SET_NAME',
      value: val,
      prompt: selectedTemplate ? getSystemPromptForTemplate(selectedTemplate, val) : systemPrompt,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!(selectedTemplate && name.trim())) return;

    const tpl = TEMPLATES.find((t) => t.key === selectedTemplate);
    if (!tpl) return;

    dispatch({ type: 'SUBMIT_START' });

    const agentId = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const def = {
      id: agentId,
      version: 1,
      name: name.trim(),
      description: description.trim() || tpl.description,
      model: tpl.model,
      systemPrompt: systemPrompt.trim(),
      tools: [],
      capabilities: tpl.capabilities,
      temperature: tpl.temperature,
      maxTokens: tpl.maxTokens,
    };

    try {
      const res = await fetch(`${apiUrl}/a2a/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(def),
      });

      if (res.status === 409) {
        dispatch({
          type: 'SUBMIT_ERROR',
          error: `An agent with ID "${agentId}" already exists. Choose a different name.`,
        });
        return;
      }

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        dispatch({ type: 'SUBMIT_ERROR', error: json.error ?? `Server error ${res.status}` });
        return;
      }

      router.push('/agents');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'An unexpected error occurred';
      dispatch({
        type: 'SUBMIT_ERROR',
        error: `Unable to create agent. ${message}. Contact support@revealui.com if this persists.`,
      });
    } finally {
      dispatch({ type: 'SUBMIT_END' });
    }
  }

  const tpl = selectedTemplate ? TEMPLATES.find((t) => t.key === selectedTemplate) : null;

  return (
    <LicenseGate feature="ai">
      <div className="min-h-screen">
        {/* Header */}
        <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
          <Breadcrumb
            items={[
              { label: 'Admin', href: '/' },
              { label: 'Agents', href: '/agents' },
              { label: 'New Agent' },
            ]}
          />
          <p className="mt-2 text-sm text-zinc-400">Scaffold a new AI agent from a template</p>
        </div>

        <div className="mx-auto max-w-2xl p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            {/* Step 1  -  Template */}
            <section>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
                1. Choose a template
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => applyTemplate(t.key)}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      selectedTemplate === t.key
                        ? 'border-zinc-400 bg-zinc-800 ring-1 ring-zinc-400'
                        : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <TemplateIcon templateKey={t.key} />
                      <span className="font-medium text-white text-sm">{t.label}</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{t.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {t.capabilities.slice(0, 2).map((cap) => (
                        <span
                          key={cap}
                          className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300"
                        >
                          {cap}
                        </span>
                      ))}
                      {t.capabilities.length > 2 && (
                        <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                          +{t.capabilities.length - 2}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Step 2  -  Details (shown after template selection) */}
            {selectedTemplate && (
              <section className="flex flex-col gap-4">
                <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
                  2. Configure agent
                </h2>

                {/* Agent Name */}
                <div>
                  <label
                    htmlFor="agent-name"
                    className="block text-sm font-medium text-zinc-300 mb-1.5"
                  >
                    Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="agent-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder={`e.g. ${tpl?.label ?? 'My Agent'}`}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
                  />
                  {name.trim() && (
                    <p className="mt-1 text-xs text-zinc-500">
                      Agent ID:{' '}
                      <code className="font-mono">
                        {name
                          .toLowerCase()
                          .trim()
                          .replace(/\s+/g, '-')
                          .replace(/[^a-z0-9-]/g, '')}
                      </code>
                    </p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label
                    htmlFor="agent-desc"
                    className="block text-sm font-medium text-zinc-300 mb-1.5"
                  >
                    Description
                  </label>
                  <input
                    id="agent-desc"
                    type="text"
                    value={description}
                    onChange={(e) => dispatch({ type: 'SET_DESCRIPTION', value: e.target.value })}
                    placeholder={tpl?.description ?? 'What does this agent do?'}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
                  />
                </div>

                {/* System Prompt */}
                <div>
                  <label
                    htmlFor="agent-prompt"
                    className="block text-sm font-medium text-zinc-300 mb-1.5"
                  >
                    System Prompt
                  </label>
                  <textarea
                    id="agent-prompt"
                    rows={6}
                    value={systemPrompt}
                    onChange={(e) => dispatch({ type: 'SET_SYSTEM_PROMPT', value: e.target.value })}
                    placeholder="Describe the agent's role, personality, and constraints..."
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none resize-none"
                  />
                </div>

                {/* Model info (read-only) */}
                <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-xs text-zinc-400">
                  <span className="font-medium text-zinc-300">Model:</span> {tpl?.model}
                  &nbsp;·&nbsp;
                  <span className="font-medium text-zinc-300">Temp:</span> {tpl?.temperature}
                  &nbsp;·&nbsp;
                  <span className="font-medium text-zinc-300">Max tokens:</span>{' '}
                  {tpl?.maxTokens?.toLocaleString()}
                </div>

                {/* Error */}
                {error && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400"
                  >
                    {error}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={submitting || !name.trim()}
                    className="rounded-lg bg-zinc-100 px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? 'Creating...' : 'Create Agent'}
                  </button>
                  <Link
                    href="/agents"
                    className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
                  >
                    Cancel
                  </Link>
                </div>
              </section>
            )}
          </form>
        </div>
      </div>
    </LicenseGate>
  );
}

// =============================================================================
// Template icon
// =============================================================================

function TemplateIcon({ templateKey }: { templateKey: TemplateKey }) {
  const icons: Record<TemplateKey, React.ReactNode> = {
    content: (
      <svg
        aria-hidden="true"
        className="h-4 w-4 text-zinc-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
        />
      </svg>
    ),
    code: (
      <svg
        aria-hidden="true"
        className="h-4 w-4 text-zinc-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"
        />
      </svg>
    ),
    support: (
      <svg
        aria-hidden="true"
        className="h-4 w-4 text-zinc-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
        />
      </svg>
    ),
    analytics: (
      <svg
        aria-hidden="true"
        className="h-4 w-4 text-zinc-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
        />
      </svg>
    ),
  };
  return <>{icons[templateKey]}</>;
}
