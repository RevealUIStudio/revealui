'use client';

import type { A2ATask } from '@revealui/contracts';
import { Badge, Button, Textarea } from '@revealui/presentation';
import { Field, Label } from '@revealui/presentation/client';
import { useState } from 'react';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { isAiLicenseDenial } from '@/lib/components/agents/ai-license-denial';
import { apiFetch } from '@/lib/utils/csrf';

interface TaskTesterProps {
  agentId: string;
  agentName: string;
  onComplete?: () => void;
}

type TesterState = 'idle' | 'submitting' | 'polling' | 'done' | 'error';

const TASK_STATE_BADGE_COLOR = {
  submitted: 'muted',
  working: 'brand',
  'input-required': 'warning',
  completed: 'success',
  canceled: 'muted',
  failed: 'danger',
  unknown: 'muted',
} as const satisfies Record<string, 'muted' | 'brand' | 'warning' | 'success' | 'danger'>;

const TASK_STATE_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  working: 'Working',
  'input-required': 'Input Required',
  completed: 'Completed',
  canceled: 'Canceled',
  failed: 'Failed',
  unknown: 'Unknown',
};

/**
 * Interactive task tester for an A2A agent.
 * Sends a tasks/send JSON-RPC call and streams/polls the result.
 */
export function TaskTester({ agentId, agentName, onComplete }: TaskTesterProps) {
  const [instruction, setInstruction] = useState('');
  const [state, setState] = useState<TesterState>('idle');
  const [task, setTask] = useState<A2ATask | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);

  async function submit() {
    if (!instruction.trim()) return;
    setState('submitting');
    setTask(null);
    setErrorMsg(null);
    setNeedsUpgrade(false);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Agent-ID': agentId,
    };

    try {
      // Same-origin /a2a rewrite so the admin session authenticates AI feature gates.
      const res = await apiFetch('/a2a', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tasks/send',
          params: {
            message: {
              role: 'user',
              parts: [{ type: 'text', text: instruction }],
            },
          },
        }),
      });

      const json = (await res.json()) as {
        result?: A2ATask;
        error?: { code: number; message: string };
      };

      if (json.error) {
        if (isAiLicenseDenial(json.error.message)) {
          setErrorMsg(null);
          setState('error');
          setTask(null);
          setNeedsUpgrade(true);
          return;
        }
        setNeedsUpgrade(false);
        setErrorMsg(json.error.message);
        setState('error');
        return;
      }

      if (json.result) {
        setTask(json.result);
        setState('done');
        onComplete?.();
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'An unexpected error occurred';
      setErrorMsg(
        `Unable to send task. ${message}. Contact support@revealui.com if this persists.`,
      );
      setState('error');
    }
  }

  const responseText =
    task?.artifacts?.[0]?.parts
      .filter((p) => p.type === 'text')
      .map((p) => ('text' in p ? p.text : ''))
      .join('\n') ??
    task?.status.message?.parts
      .filter((p) => p.type === 'text')
      .map((p) => ('text' in p ? p.text : ''))
      .join('\n') ??
    null;

  return (
    <div className="flex flex-col gap-4">
      <Field>
        <Label>
          Send a task to <span className="text-foreground">{agentName}</span>
        </Label>
        <Textarea
          name="instruction"
          rows={4}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder={`Tell ${agentName} what to do...`}
        />
      </Field>

      <Button
        type="button"
        onClick={submit}
        disabled={state === 'submitting' || state === 'polling' || !instruction.trim()}
        variant="brand"
        size="sm"
        className="self-start"
      >
        {state === 'submitting' ? 'Sending...' : state === 'polling' ? 'Working...' : 'Send Task'}
      </Button>

      {/* Status badge */}
      {task && (
        <div className="flex items-center gap-2">
          <TaskStateBadge state={task.status.state} />
          {task.id && (
            <span className="font-mono text-xs text-muted-foreground">
              task:{task.id.slice(0, 8)}
            </span>
          )}
        </div>
      )}

      {/* Response — bg-muted (not bg-card); Card would apply bg-card, behavioral mismatch */}
      {responseText && (
        <div className="rounded-lg border border-border bg-muted p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Response
          </p>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{responseText}</p>
        </div>
      )}

      {needsUpgrade && (
        <UpgradePrompt
          feature="ai"
          description="Sending a task runs the agent. This account is not entitled to AI yet. Upgrade or ask an operator to grant the plan on the account. There is no founder bypass."
        />
      )}

      {/* Inline error — Alert primitive is a modal dialog, not applicable */}
      {errorMsg && (
        <div role="alert" className="rounded-lg border border-error/30 bg-error/10 p-4">
          <p className="text-sm text-error">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}

function TaskStateBadge({ state }: { state: string }) {
  const color = TASK_STATE_BADGE_COLOR[state as keyof typeof TASK_STATE_BADGE_COLOR] ?? 'muted';
  const label = TASK_STATE_LABEL[state] ?? state;
  return <Badge intent={color}>{label}</Badge>;
}
