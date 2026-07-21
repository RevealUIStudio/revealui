'use client';

import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  IconCode,
  IconEdit,
  IconMonitor,
  IconUsers,
  Input,
  LinkButton,
  Textarea,
} from '@revealui/presentation';
import { Callout, Field, Label } from '@revealui/presentation/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ChangeEvent, useEffect, useReducer, useState } from 'react';
import {
  INFERENCE_PREREQUISITE_COPY,
  type InferenceKeyMetadata,
  resolveInferencePrerequisite,
} from '@/lib/agents/inference-prerequisite';
import { LicenseGate } from '@/lib/components/LicenseGate';
import { apiFetch } from '@/lib/utils/csrf';

// =============================================================================
// Template definitions
// =============================================================================

type TemplateKey = 'content' | 'code' | 'support' | 'analytics';

/**
 * Empty string, mirroring the chat model picker's 'Auto' option (see
 * MODEL_OPTIONS in src/lib/components/Agent/index.tsx). The dispatch runtime
 * resolves the actual model from the account's configured provider
 * (Settings > API Keys) — it never reads a hardcoded id off the agent
 * definition, so the template default must not imply one specific vendor.
 */
const AUTO_MODEL = '';

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
    model: AUTO_MODEL,
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
    model: AUTO_MODEL,
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
    model: AUTO_MODEL,
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
    model: AUTO_MODEL,
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

  // Resolve the inference-provider prerequisite up front. `null` means the check
  // has not resolved yet (still loading, or the request failed) — we only block
  // when we positively know no provider key is configured.
  const [providerConfigured, setProviderConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/user/api-keys')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: InferenceKeyMetadata | null) => {
        if (active) setProviderConfigured(resolveInferencePrerequisite(data).configured);
      })
      .catch(() => {
        // Leave the prerequisite unresolved on a fetch error so a flaky request
        // never blocks agent creation.
      });
    return () => {
      active = false;
    };
  }, []);

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
      const res = await apiFetch(`${apiUrl}/a2a/agents`, {
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
        <div className="border-b border-border bg-card px-6 py-4">
          <Breadcrumb
            items={[
              { label: 'Admin', href: '/' },
              { label: 'Agents', href: '/agents' },
              { label: 'New Agent' },
            ]}
          />
          <p className="mt-2 text-sm text-muted-foreground">
            Scaffold a new AI agent from a template
          </p>
        </div>

        <div className="mx-auto max-w-2xl p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            {/* Step 1  -  Template */}
            <section>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                1. Choose a template
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {TEMPLATES.map((t) => (
                  <Button
                    key={t.key}
                    type="button"
                    appearance="outline"
                    variant="neutral"
                    onClick={() => applyTemplate(t.key)}
                    className={`h-auto flex-col items-stretch rounded-xl border p-4 text-left transition-all ${
                      selectedTemplate === t.key
                        ? 'border-border bg-muted ring-1 ring-ring'
                        : 'border-border bg-card hover:border-border'
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <TemplateIcon templateKey={t.key} />
                      <span className="font-medium text-foreground text-sm">{t.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {t.capabilities.slice(0, 2).map((cap) => (
                        <Badge key={cap} color="muted">
                          {cap}
                        </Badge>
                      ))}
                      {t.capabilities.length > 2 && (
                        <Badge color="muted">+{t.capabilities.length - 2}</Badge>
                      )}
                    </div>
                  </Button>
                ))}
              </div>
            </section>

            {/* Step 2  -  Details (shown after template selection) */}
            {selectedTemplate && (
              <section className="flex flex-col gap-4">
                <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  2. Configure agent
                </h2>

                <Field>
                  <Label>
                    Name <span className="text-error">*</span>
                  </Label>
                  <Input
                    name="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleNameChange(e.target.value)
                    }
                    placeholder={`e.g. ${tpl?.label ?? 'My Agent'}`}
                  />
                  {name.trim() && (
                    <p className="mt-1 text-xs text-muted-foreground">
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
                </Field>

                <Field>
                  <Label>Description</Label>
                  <Input
                    name="description"
                    type="text"
                    value={description}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      dispatch({ type: 'SET_DESCRIPTION', value: e.target.value })
                    }
                    placeholder={tpl?.description ?? 'What does this agent do?'}
                  />
                </Field>

                <Field>
                  <Label>System Prompt</Label>
                  <Textarea
                    name="systemPrompt"
                    rows={6}
                    value={systemPrompt}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                      dispatch({ type: 'SET_SYSTEM_PROMPT', value: e.target.value })
                    }
                    placeholder="Describe the agent's role, personality, and constraints..."
                  />
                </Field>

                {/* Model info (read-only) */}
                <Card className="px-4 py-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Model:</span>{' '}
                  {tpl?.model || 'Auto (resolved from your configured provider)'}
                  &nbsp;·&nbsp;
                  <span className="font-medium text-foreground">Temp:</span> {tpl?.temperature}
                  &nbsp;·&nbsp;
                  <span className="font-medium text-foreground">Max tokens:</span>{' '}
                  {tpl?.maxTokens?.toLocaleString()}
                </Card>
                <p className="text-xs text-muted-foreground">
                  Model providers are configured in{' '}
                  <Link
                    href="/settings/api-keys"
                    className="font-medium text-primary hover:underline"
                  >
                    Settings, API Keys
                  </Link>
                  .
                </p>

                {providerConfigured === false && (
                  <Callout variant="warning" role="alert" title={INFERENCE_PREREQUISITE_COPY.title}>
                    {INFERENCE_PREREQUISITE_COPY.body}{' '}
                    <Link
                      href="/settings/api-keys"
                      className="font-medium text-primary hover:underline"
                    >
                      {INFERENCE_PREREQUISITE_COPY.linkLabel}
                    </Link>
                  </Callout>
                )}

                {/* Error — inline banner; Alert primitive is a modal dialog, not applicable */}
                {error && (
                  <div
                    role="alert"
                    className="rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error"
                  >
                    {error}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={submitting || !name.trim() || providerConfigured === false}
                    variant="brand"
                    size="sm"
                  >
                    {submitting ? 'Creating...' : 'Create Agent'}
                  </Button>
                  <LinkButton
                    as={Link}
                    href="/agents"
                    appearance="outline"
                    variant="neutral"
                    size="sm"
                  >
                    Cancel
                  </LinkButton>
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
  const className = 'size-4 text-muted-foreground';
  switch (templateKey) {
    case 'content':
      return <IconEdit className={className} aria-hidden="true" />;
    case 'code':
      return <IconCode className={className} aria-hidden="true" />;
    case 'support':
      return <IconUsers className={className} aria-hidden="true" />;
    case 'analytics':
      return <IconMonitor className={className} aria-hidden="true" />;
  }
}
